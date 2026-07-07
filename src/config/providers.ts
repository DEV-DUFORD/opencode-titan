import type { ChildAgentConfig } from './schema';

/**
 * Resolve the logical provider for a child agent.
 *
 * A "provider" here represents the physical backend (machine/host) that serves
 * the model. Multiple child agents may share a provider when they run on the
 * same hardware — in which case only one of them can be active at a time (e.g.
 * because only one model fits in that machine's VRAM at any moment).
 *
 * Falls back to the provider prefix of the `provider/model` string when no
 * explicit `provider` is configured.
 */
export function resolveChildProvider(child: ChildAgentConfig): string {
  return child.provider ?? child.model.split('/')[0];
}

/**
 * Build a map from child agent name (`child-0`, `child-1`, ...) to its resolved
 * provider. The index in the array determines the agent name, matching
 * `createChildAgent`.
 */
export function buildAgentProviderMap(
  children: ChildAgentConfig[],
): Map<string, string> {
  const map = new Map<string, string>();
  children.forEach((child, idx) => {
    map.set(`child-${idx}`, resolveChildProvider(child));
  });
  return map;
}

/**
 * Runtime lock metadata for a child agent.
 *
 * `provider` is the physical backend; `model` identifies what is loaded into
 * that backend's VRAM. Multiple instances of the *same* model may run
 * concurrently on a provider (up to `maxInstances`), but different models on the
 * same provider must be serialized.
 */
export interface AgentLockInfo {
  provider: string;
  model: string;
  maxInstances: number;
}

/**
 * Build a map from child agent name to the lock metadata used to enforce the
 * per-provider, per-model concurrency constraint at runtime.
 */
export function buildAgentLockInfoMap(
  children: ChildAgentConfig[],
): Map<string, AgentLockInfo> {
  const map = new Map<string, AgentLockInfo>();
  children.forEach((child, idx) => {
    map.set(`child-${idx}`, {
      provider: resolveChildProvider(child),
      model: child.model,
      maxInstances: child.maxInstances ?? 1,
    });
  });
  return map;
}
