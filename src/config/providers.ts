import type { MyrmidonConfig } from './schema';

/**
 * Resolve the logical provider for a Myrmidon.
 *
 * A "provider" here represents the physical backend (machine/host) that serves
 * the model. Multiple Myrmidons may share a provider when they run on the same
 * hardware — in which case only one of them can be active at a time (e.g.
 * because only one model fits in that machine's VRAM at any moment).
 *
 * Falls back to the provider prefix of the `provider/model` string when no
 * explicit `provider` is configured.
 */
export function resolveMyrmidonProvider(myrmidon: MyrmidonConfig): string {
  return myrmidon.provider ?? myrmidon.model.split('/')[0];
}

/**
 * @deprecated Use `resolveMyrmidonProvider`. Retained as a backwards-compatible
 * alias for the former "child agent" naming.
 */
export const resolveChildProvider = resolveMyrmidonProvider;

/**
 * Build a map from Myrmidon agent name to its resolved provider. Each Myrmidon
 * is registered under its canonical name (`myrmidon-0`, `myrmidon-1`, ...) and
 * its deprecated alias (`child-0`, `child-1`, ...) so routing keeps working for
 * either name. The index in the array determines the agent name, matching
 * `createMyrmidonAgent`.
 */
export function buildAgentProviderMap(
  myrmidons: MyrmidonConfig[],
): Map<string, string> {
  const map = new Map<string, string>();
  myrmidons.forEach((myrmidon, idx) => {
    const provider = resolveMyrmidonProvider(myrmidon);
    map.set(`myrmidon-${idx}`, provider);
    map.set(`child-${idx}`, provider);
  });
  return map;
}

/**
 * Runtime lock metadata for a Myrmidon.
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
 * Build a map from Myrmidon agent name to the lock metadata used to enforce the
 * per-provider, per-model concurrency constraint at runtime. Both the canonical
 * name (`myrmidon-N`) and the deprecated alias (`child-N`) are registered so
 * the runtime lock applies regardless of which routing name is used.
 */
export function buildAgentLockInfoMap(
  myrmidons: MyrmidonConfig[],
): Map<string, AgentLockInfo> {
  const map = new Map<string, AgentLockInfo>();
  myrmidons.forEach((myrmidon, idx) => {
    const info: AgentLockInfo = {
      provider: resolveMyrmidonProvider(myrmidon),
      model: myrmidon.model,
      maxInstances: myrmidon.maxInstances ?? 1,
    };
    map.set(`myrmidon-${idx}`, info);
    map.set(`child-${idx}`, info);
  });
  return map;
}
