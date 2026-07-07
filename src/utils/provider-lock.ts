/**
 * Per-provider, model-aware async scheduler.
 *
 * Enforces the provider constraint at runtime: a provider represents a physical
 * backend (machine/host) that can only fit ONE model in VRAM at a time.
 * Therefore:
 *
 *   - Two tasks running *different models* on the same provider must be
 *     serialized (one must finish before the other's model can be loaded).
 *   - Two tasks running the *same model* on the same provider may run
 *     concurrently, up to that model's `maxInstances` — the model is already
 *     resident in VRAM, so extra instances add no load/unload cost.
 *
 * Tasks on *different* providers never block each other, preserving
 * cross-machine parallelism.
 *
 * Usage:
 *   const release = await locks.acquire('provider-a', 'provider-a/model-x', 2);
 *   try { ...run task... } finally { release(); }
 *
 * Grants are FIFO per provider (the queue head is considered first), which
 * prevents a stream of same-model tasks from starving a waiting different-model
 * task.
 */

interface Waiter {
  model: string;
  maxConcurrent: number;
  grant: (release: () => void) => void;
}

interface ProviderState {
  /** The model currently occupying the provider's VRAM, or null when idle. */
  activeModel: string | null;
  /** Number of in-flight holders for `activeModel`. */
  activeCount: number;
  /** FIFO queue of pending acquirers. */
  queue: Waiter[];
}

export class ProviderLockManager {
  private readonly providers = new Map<string, ProviderState>();

  /**
   * Acquire a slot for `model` on `provider`. Resolves with an idempotent
   * release function once a slot is available.
   *
   * @param provider      Logical provider (physical backend) identifier.
   * @param model         The model to load — same-model acquisitions can share
   *                      the provider concurrently.
   * @param maxConcurrent Maximum concurrent instances of this model (>= 1).
   */
  acquire(
    provider: string,
    model: string,
    maxConcurrent = 1,
  ): Promise<() => void> {
    const state = this.getState(provider);
    return new Promise<() => void>((resolve) => {
      state.queue.push({
        model,
        maxConcurrent: Math.max(1, Math.floor(maxConcurrent)),
        grant: resolve,
      });
      this.pump(provider);
    });
  }

  private getState(provider: string): ProviderState {
    let state = this.providers.get(provider);
    if (!state) {
      state = { activeModel: null, activeCount: 0, queue: [] };
      this.providers.set(provider, state);
    }
    return state;
  }

  /**
   * Grant as many queued waiters as the current provider state allows. Only the
   * queue head is considered each step to preserve FIFO fairness (a different
   * model cannot be skipped by later same-model waiters).
   */
  private pump(provider: string): void {
    const state = this.providers.get(provider);
    if (!state) return;

    while (state.queue.length > 0) {
      const head = state.queue[0];
      const canGrant =
        state.activeModel === null ||
        (state.activeModel === head.model &&
          state.activeCount < head.maxConcurrent);

      if (!canGrant) break;

      state.queue.shift();
      state.activeModel = head.model;
      state.activeCount++;
      head.grant(this.makeRelease(provider, state));
    }
  }

  private makeRelease(provider: string, state: ProviderState): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      state.activeCount--;
      if (state.activeCount <= 0) {
        state.activeCount = 0;
        state.activeModel = null;
        // Drop empty, idle providers so the map doesn't grow unbounded.
        if (
          state.queue.length === 0 &&
          this.providers.get(provider) === state
        ) {
          this.providers.delete(provider);
          return;
        }
      }

      this.pump(provider);
    };
  }
}
