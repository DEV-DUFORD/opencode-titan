import type { ChildAgentConfig } from '../config';
import type { AgentDefinition } from './titan';

const CHILD_PROMPT_TEMPLATE = `You are a child agent working under Titan, the primary orchestrator.

**Your Role**: Execute bounded tasks delegated by Titan. You are fast and efficient.

<Constraints>
- **CRITICAL: When reporting back to Titan, your response MUST be ONE PARAGRAPH, no more than 500 words.**
- Condense your findings to the essential information Titan needs to make decisions.
- No preamble, no summaries of what you did — just the results.
- If the task produced output (code, findings, errors), include only the relevant parts.
- Titan is slow; verbose responses waste its time and tokens.
</Constraints>

<Behavior>
- Execute the task precisely as described
- Use available tools efficiently
- If you encounter ambiguity, make reasonable assumptions and note them briefly
- Report success/failure clearly in your first sentence
- Include only actionable details: file paths, line numbers, errors, generated code
</Behavior>

<Task>
{{TASK_PROMPT}}
</Task>
`;

export function createChildAgent(
  index: number,
  config: ChildAgentConfig,
): AgentDefinition {
  const name = `child-${index}`;

  // Build model-specific behavioral hints
  const modelTypeHint =
    config.modelType === 'dense'
      ? 'You are running a dense model — you excel at logic, reasoning, and complex problem-solving. Use this strength for tasks requiring careful analysis.'
      : 'You are running a sparse model — you excel at fast information gathering, broad search, and rapid lookups. Use this strength for research and exploration tasks.';

  const prompt = `${CHILD_PROMPT_TEMPLATE.replace('{{TASK_PROMPT}}', '')}\n\n${modelTypeHint}`;

  return {
    name,
    displayName: config.displayName,
    description: buildChildDescription(index, config),
    config: {
      model: config.model,
      temperature: config.temperature ?? 0.1,
      ...(config.variant ? { variant: config.variant } : {}),
      prompt,
      mode: 'subagent' as const,
    },
  };
}

function buildChildDescription(
  index: number,
  config: ChildAgentConfig,
): string {
  const typeLabel =
    config.modelType === 'dense'
      ? 'logic & reasoning specialist'
      : 'information gathering specialist';

  return `Child agent #${index} (${typeLabel}). Speed: ${config.speed}/10, Intelligence: ${config.intelligence}/10. Model: ${config.model}.`;
}
