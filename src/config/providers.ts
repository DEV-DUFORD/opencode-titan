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
