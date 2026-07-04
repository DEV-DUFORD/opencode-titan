import type { Plugin } from '@opencode-ai/plugin';
import { createAgents, getAgentConfigs } from './agents';
import { loadPluginConfig, TITAN_AGENT_NAME } from './config';
import { DELEGATION_REMINDER } from './config/constants';

const OpenCodeDistributedDelegation: Plugin = async (ctx) => {
  let config: ReturnType<typeof loadPluginConfig>;
  let agents: ReturnType<typeof getAgentConfigs>;
  let agentDefs: ReturnType<typeof createAgents>;
  let sessionAgentMap: Map<string, string>;

  try {
    config = loadPluginConfig(ctx.directory);
    agentDefs = createAgents(config, { projectDirectory: ctx.directory });
    agents = getAgentConfigs(config, { projectDirectory: ctx.directory });
    sessionAgentMap = new Map<string, string>();
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

  return {
    name: 'opencode-distributed-delegation',

    agent: agents,

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

    // Track which agent each session uses for serve-mode prompt injection
    'chat.message': async (
      input: { sessionID: string; agent?: string },
      output?: { message?: { agent?: string } },
    ) => {
      const agent = input.agent ?? output?.message?.agent;
      if (agent) {
        sessionAgentMap.set(input.sessionID, agent);
      }
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
        }
      }
    },
  };
};

export default OpenCodeDistributedDelegation;

export type { ChildAgentConfig, ModelType, PluginConfig } from './config';
