/**
 * Per-provider async mutex.
 *
 * Ensures that at most one task is "active" for a given provider at any moment.
 * This enforces the `provider` constraint at runtime: child agents that share a
 * provider (i.e. run on the same physical backend) are serialized, because that
 * machine can only fit one model in VRAM at a time.
 *
 * Usage:
 *   const release = await locks.acquire('nerd-computer');
 *   try { ...run task... } finally { release(); }
 *
 * Acquisition is FIFO per provider. Acquiring different providers never blocks
 * across each other, so cross-machine parallelism is preserved.
 */
export class ProviderLockManager {
  // For each provider, a promise chain whose tail resolves when the provider
  // becomes free. Awaiting the current tail = waiting your turn.
  private readonly tails = new Map<string, Promise<void>>();

  /**
   * Acquire the lock for `provider`. Resolves with a release function once the
   * provider is free. The release function is idempotent.
   */
  async acquire(provider: string): Promise<() => void> {
    const previous = this.tails.get(provider) ?? Promise.resolve();

    let release!: () => void;
    // The promise the *next* waiter will await. Resolving it hands off the lock.
    const current = new Promise<void>((resolve) => {
      let released = false;
      release = () => {
        if (released) return;
        released = true;
        // If we're the tail, drop the entry so the map doesn't grow unbounded.
        if (this.tails.get(provider) === current) {
          this.tails.delete(provider);
        }
        resolve();
      };
    });

    this.tails.set(provider, current);

    // Wait for the previous holder to release before we take the lock.
    await previous;

    return release;
  }
}
