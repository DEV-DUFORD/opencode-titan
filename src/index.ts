import type { Plugin } from '@opencode-ai/plugin';
import { createAgents, getAgentConfigs } from './agents';
import {
  buildAgentProviderMap,
  loadPluginConfig,
  TITAN_AGENT_NAME,
} from './config';
import {
  DELEGATION_REMINDER,
  PER_MESSAGE_DELEGATION_REMINDER,
} from './config/constants';
import { ProviderLockManager } from './utils/provider-lock';

// Safety net: auto-release a provider lock if `tool.execute.after` never fires
// (e.g. the task was interrupted/cancelled) so a provider can't deadlock.
const PROVIDER_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

const OpenCodeDistributedDelegation: Plugin = async (ctx) => {
  let config: ReturnType<typeof loadPluginConfig>;
  let agents: ReturnType<typeof getAgentConfigs>;
  let agentDefs: ReturnType<typeof createAgents>;
  let sessionAgentMap: Map<string, string>;
  // Runtime enforcement of the `provider` constraint: serialize child agents
  // that share a provider so only one runs on a given backend at a time.
  let providerLocks: ProviderLockManager;
  let agentProviderMap: Map<string, string>;

  try {
    config = loadPluginConfig(ctx.directory);
    agentDefs = createAgents(config, { projectDirectory: ctx.directory });
    agents = getAgentConfigs(config, { projectDirectory: ctx.directory });
    sessionAgentMap = new Map<string, string>();
    providerLocks = new ProviderLockManager();
    agentProviderMap = buildAgentProviderMap(config.children ?? []);
  } catch (err) {
    console.error(
      `[opencode-distributed-delegation] FATAL: init failed: ${err}`,
    );
    throw err;
  }

  // Validate that we have at least Titan + 1 child
  const childCount = agentDefs.length - 1; // minus Titan
  if (childCount < 1) {
    console.warn(
      '[opencode-distributed-delegation] WARN: No child agents configured. ' +
        'Titan cannot delegate without children. Add children to your config.',
    );
  }

  // Locks currently held by an in-flight task, keyed by `${sessionID}:${callID}`.
  interface HeldLock {
    provider: string;
    release: () => void;
    timer: ReturnType<typeof setTimeout>;
  }
  const heldLocks = new Map<string, HeldLock>();
  const lockKey = (sessionID: string, callID: string): string =>
    `${sessionID}:${callID}`;

  const releaseLock = (key: string): void => {
    const held = heldLocks.get(key);
    if (!held) return;
    heldLocks.delete(key);
    clearTimeout(held.timer);
    held.release();
  };

  return {
    name: 'opencode-distributed-delegation',

    agent: agents,

    // Enforce the `provider` constraint at runtime. A child agent's provider
    // represents the physical backend serving its model; when several children
    // share a provider only one can be active at a time (e.g. limited VRAM).
    // Acquiring a per-provider lock before the subagent starts, and releasing it
    // after it finishes, serializes same-provider children even when Titan
    // dispatches them "in parallel".
    'tool.execute.before': async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: unknown },
    ): Promise<void> => {
      if (input.tool !== 'task') return;

      const args = output.args as { subagent_type?: string } | undefined;
      const subagentType = args?.subagent_type;
      if (!subagentType) return;

      const provider = agentProviderMap.get(subagentType);
      if (!provider) return; // Unknown/unmanaged agent — don't gate it.

      const key = lockKey(input.sessionID, input.callID);
      // Guard against re-entrant hook invocation for the same call.
      if (heldLocks.has(key)) return;

      const release = await providerLocks.acquire(provider);
      const timer = setTimeout(() => {
        if (heldLocks.has(key)) {
          console.warn(
            `[opencode-distributed-delegation] WARN: provider lock for ` +
              `"${provider}" (${key}) auto-released after timeout; ` +
              'the task may have been interrupted.',
          );
          releaseLock(key);
        }
      }, PROVIDER_LOCK_TIMEOUT_MS);
      // Don't keep the process alive just for this safety timer.
      (timer as { unref?: () => void }).unref?.();

      heldLocks.set(key, { provider, release, timer });
    },

    // Release the provider lock once the subagent task completes (or errors).
    'tool.execute.after': async (input: {
      tool: string;
      sessionID: string;
      callID: string;
    }): Promise<void> => {
      if (input.tool !== 'task') return;
      releaseLock(lockKey(input.sessionID, input.callID));
    },

    config: async (opencodeConfig: Record<string, unknown>) => {
      // Set Titan as the default agent
      if (!(opencodeConfig as { default_agent?: string }).default_agent) {
        (opencodeConfig as { default_agent?: string }).default_agent =
          TITAN_AGENT_NAME;
      }

      // Merge agent configs
      if (!opencodeConfig.agent) {
        opencodeConfig.agent = { ...agents };
      } else {
        for (const [name, pluginAgent] of Object.entries(agents)) {
          const existing = (opencodeConfig.agent as Record<string, unknown>)[
            name
          ] as Record<string, unknown> | undefined;
          if (existing) {
            (opencodeConfig.agent as Record<string, unknown>)[name] = {
              ...pluginAgent,
              ...existing,
            };
          } else {
            (opencodeConfig.agent as Record<string, unknown>)[name] = {
              ...pluginAgent,
            };
          }
        }
      }
    },

    // Track which agent each session uses for serve-mode prompt injection,
    // and re-assert the delegation directive on every user turn to Titan.
    'chat.message': async (
      input: { sessionID: string; agent?: string },
      output?: {
        message?: { id?: string; agent?: string };
        parts?: Array<Record<string, unknown>>;
      },
    ) => {
      const agent = input.agent ?? output?.message?.agent;
      if (agent) {
        sessionAgentMap.set(input.sessionID, agent);
      }

      if (agent !== TITAN_AGENT_NAME || !output?.parts) {
        return;
      }

      // Avoid double-injection (e.g. hook re-runs on the same message).
      const alreadyInjected = output.parts.some(
        (p) =>
          p &&
          p.type === 'text' &&
          typeof p.text === 'string' &&
          (p.text as string).includes('<delegation_directive>'),
      );
      if (alreadyInjected) {
        return;
      }

      // Append a synthetic text part after the user's content so the directive
      // is the most recent instruction Titan sees before responding.
      output.parts.push({
        id: `prt_deleg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        sessionID: input.sessionID,
        messageID: output.message?.id ?? '',
        type: 'text',
        text: PER_MESSAGE_DELEGATION_REMINDER,
        synthetic: true,
      });
    },

    // Inject delegation reminder for Titan in serve-mode sessions
    'experimental.chat.system.transform': async (
      input: { sessionID?: string },
      output: { system: string[] },
    ): Promise<void> => {
      const agentName = input.sessionID
        ? sessionAgentMap.get(input.sessionID)
        : undefined;

      if (agentName === TITAN_AGENT_NAME) {
        // Inject the delegation reminder at the end of the system prompt
        const alreadyInjected = output.system.some(
          (s) =>
            typeof s === 'string' &&
            s.includes('DELEGATE EVERYTHING POSSIBLE TO CHILDREN'),
        );

        if (!alreadyInjected) {
          if (output.system.length > 0) {
            const lastIdx = output.system.length - 1;
            const last = output.system[lastIdx];
            if (typeof last === 'string') {
              output.system[lastIdx] = `${last}\n\n${DELEGATION_REMINDER}`;
            }
          }
        }
      }
    },

    // Clean up session tracking on deletion
    event: async (input) => {
      const event = input.event as {
        type: string;
        properties?: {
          info?: { id?: string };
          sessionID?: string;
        };
      };

      if (event.type === 'session.deleted') {
        const props = event.properties;
        const sessionID = props?.info?.id ?? props?.sessionID;
        if (sessionID) {
          sessionAgentMap.delete(sessionID);
          // Release any provider locks still held by this session's tasks.
          for (const key of [...heldLocks.keys()]) {
            if (key.startsWith(`${sessionID}:`)) {
              releaseLock(key);
            }
          }
        }
      }
    },
  };
};

export default OpenCodeDistributedDelegation;

export type { ChildAgentConfig, ModelType, PluginConfig } from './config';
