import type { AgentConfig as SDKAgentConfig } from '@opencode-ai/sdk/v2';
import {
  DEFAULT_MAX_RESPONSE_WORDS,
  getMyrmidonConfigs,
  loadAgentPrompt,
  type PluginConfig,
  TITAN_AGENT_NAME,
} from '../config';
import { createMyrmidonAgent } from './myrmidon';
import { type AgentDefinition, createTitanAgent, resolvePrompt } from './titan';

/**
 * Create all agent definitions: Titan + N Myrmidons.
 *
 * Each Myrmidon is also registered under its deprecated `child-N` alias so that
 * existing configs, custom prompts, or sessions that route via the old name
 * keep working.
 */
export function createAgents(
  config?: PluginConfig,
  options?: { projectDirectory?: string },
): AgentDefinition[] {
  const myrmidons = getMyrmidonConfigs(config);
  const maxResponseWords =
    config?.maxResponseWords ?? DEFAULT_MAX_RESPONSE_WORDS;

  // Resolve Titan model
  const titanModel = config?.titan?.model;

  // Load custom prompts for titan
  const titanPrompts = loadAgentPrompt('titan', {
    projectDirectory: options?.projectDirectory,
  });

  // Create Titan
  const titan = createTitanAgent(
    myrmidons,
    typeof titanModel === 'string' ? titanModel : undefined,
    config?.titan?.prompt,
    undefined,
    maxResponseWords,
  );

  // Apply custom prompts
  titan.config.prompt = resolvePrompt(
    titan.config.prompt ?? '',
    titanPrompts.prompt,
    titanPrompts.appendPrompt,
  );

  // Apply Titan overrides
  if (config?.titan) {
    if (config.titan.temperature !== undefined) {
      titan.config.temperature = config.titan.temperature;
    }
    if (config.titan.variant) {
      titan.config.variant = config.titan.variant;
    }
  }

  // Create Myrmidons (canonical `myrmidon-N`)
  const myrmidonAgents = myrmidons.map((myrmidonConfig, idx) =>
    createMyrmidonAgent(idx, myrmidonConfig, maxResponseWords),
  );

  // Register deprecated `child-N` aliases pointing to the same config so old
  // routing names continue to resolve. Docs steer users to `myrmidon-N`.
  const aliasAgents: AgentDefinition[] = myrmidonAgents.map((agent, idx) => ({
    ...agent,
    name: `child-${idx}`,
    description:
      `[Deprecated alias of @myrmidon-${idx}] ${agent.description ?? ''}`.trim(),
  }));

  return [titan, ...myrmidonAgents, ...aliasAgents];
}

/**
 * Get agent configurations formatted for the OpenCode SDK.
 */
export function getAgentConfigs(
  config?: PluginConfig,
  options?: { projectDirectory?: string },
): Record<string, SDKAgentConfig> {
  const agents = createAgents(config, options);

  const entries: Array<[string, SDKAgentConfig]> = [];

  for (const agent of agents) {
    const sdkConfig: SDKAgentConfig = {
      ...agent.config,
      description: agent.description,
    };

    if (agent.name === TITAN_AGENT_NAME) {
      sdkConfig.mode = 'primary' as const;
    } else {
      sdkConfig.mode = 'subagent' as const;
    }

    if (agent.displayName) {
      (sdkConfig as SDKAgentConfig & { displayName?: string }).displayName =
        agent.displayName;
    }

    entries.push([agent.name, sdkConfig]);
  }

  return Object.fromEntries(entries);
}
