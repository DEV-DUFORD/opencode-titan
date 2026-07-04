import type { AgentConfig as SDKAgentConfig } from '@opencode-ai/sdk/v2';
import {
  loadAgentPrompt,
  type PluginConfig,
  TITAN_AGENT_NAME,
} from '../config';
import { createChildAgent } from './child';
import { type AgentDefinition, createTitanAgent, resolvePrompt } from './titan';

/**
 * Create all agent definitions: Titan + N children.
 */
export function createAgents(
  config?: PluginConfig,
  options?: { projectDirectory?: string },
): AgentDefinition[] {
  const children = config?.children ?? [];

  // Resolve Titan model
  const titanModel = config?.titan?.model;

  // Load custom prompts for titan
  const titanPrompts = loadAgentPrompt('titan', {
    projectDirectory: options?.projectDirectory,
  });

  // Create Titan
  const titan = createTitanAgent(
    children,
    typeof titanModel === 'string' ? titanModel : undefined,
    config?.titan?.prompt,
    undefined,
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

  // Create children
  const childAgents = children.map((childConfig, idx) =>
    createChildAgent(idx, childConfig),
  );

  return [titan, ...childAgents];
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
