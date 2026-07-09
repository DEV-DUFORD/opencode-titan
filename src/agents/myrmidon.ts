import { DEFAULT_MAX_RESPONSE_WORDS, type MyrmidonConfig } from '../config';
import type { AgentDefinition } from './titan';

const MYRMIDON_PROMPT_TEMPLATE = `You are a Myrmidon working under Titan, the primary orchestrator.

**Your Role**: Execute a single, bounded task delegated by Titan. You are fast and efficient. You must be surgical — do not over-explore.

<ContextBudget>
You are operating with a hard context budget. Exceeding it causes failure. Follow these rules without exception:

- **Tool call limit: 25 calls maximum.** Stop and report with what you have if you reach this limit.
- **Stop as soon as you have enough to answer.** Do not keep exploring once the answer is clear.
- **Prefer targeted tools over broad reads.** grep/search before reading files. Never read a full file when a line-range or search suffices.
- **Read sections, not whole files.** Use line ranges (e.g., lines 10–50) rather than reading entire files.
- **Do not recurse.** If a search leads to more files, pick the most relevant 1–2 and stop. Do not chain indefinitely.
- **Do not validate or test beyond what's asked.** If Titan asked you to find something, find it and stop. Do not run extra checks speculatively.
- If you are approaching the tool call limit and still uncertain, report partial findings clearly rather than continuing.
</ContextBudget>

<OutputConstraints>
- **CRITICAL: Your final response to Titan MUST be ONE PARAGRAPH, no more than {{MAX_WORDS}} words.**
- No preamble, no summary of what you did — just the results.
- Report success/failure clearly in your first sentence.
- Include only actionable details: file paths, line numbers, errors, generated code snippets.
- Titan is slow; verbose responses waste its inference budget.
</OutputConstraints>

<Behavior>
- Execute the task precisely as described — nothing more, nothing less
- Make reasonable assumptions when ambiguous; note them in one sentence
- If the task is already done or the answer is obvious from context, say so immediately without invoking tools
</Behavior>

<Task>
{{TASK_PROMPT}}
</Task>
`;

export function createMyrmidonAgent(
  index: number,
  config: MyrmidonConfig,
  maxResponseWords: number = DEFAULT_MAX_RESPONSE_WORDS,
): AgentDefinition {
  const name = `myrmidon-${index}`;

  // Build model-specific behavioral hints
  const modelTypeHint =
    config.modelType === 'dense'
      ? 'You are running a dense model — you excel at logic, reasoning, and complex problem-solving. Use this strength for tasks requiring careful analysis.'
      : 'You are running a sparse model — you excel at fast information gathering, broad search, and rapid lookups. Use this strength for research and exploration tasks.';

  const template = MYRMIDON_PROMPT_TEMPLATE.replace(
    '{{MAX_WORDS}}',
    String(maxResponseWords),
  );
  const prompt = `${template.replace('{{TASK_PROMPT}}', '')}\n\n${modelTypeHint}`;

  return {
    name,
    description: buildMyrmidonDescription(index, config),
    config: {
      model: config.model,
      temperature: config.temperature ?? 0.1,
      ...(config.variant ? { variant: config.variant } : {}),
      prompt,
      mode: 'subagent' as const,
    },
  };
}

/**
 * @deprecated Use `createMyrmidonAgent`. Retained as a backwards-compatible
 * alias for the former "child agent" naming.
 */
export const createChildAgent = createMyrmidonAgent;

function buildMyrmidonDescription(
  index: number,
  config: MyrmidonConfig,
): string {
  const typeLabel =
    config.modelType === 'dense'
      ? 'logic & reasoning specialist'
      : 'information gathering specialist';

  return `Myrmidon #${index} (${typeLabel}). Speed: ${config.speed}/10, Intelligence: ${config.intelligence}/10. Model: ${config.model}.${config.notes ? ` Notes: ${config.notes}` : ''}`;
}
