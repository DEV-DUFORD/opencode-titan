export const TITAN_AGENT_NAME = 'titan' as const;

/**
 * Default maximum word count enforced on a Myrmidon's final response to Titan.
 * Overridable via the `maxResponseWords` plugin config key.
 */
export const DEFAULT_MAX_RESPONSE_WORDS = 1000 as const;

export const ALL_AGENT_NAMES = [TITAN_AGENT_NAME] as const;
export type AgentName = (typeof ALL_AGENT_NAMES)[number];

/** Agents that cannot be disabled. */
export const PROTECTED_AGENTS = new Set([TITAN_AGENT_NAME]);

// Workflow reminders injected into Titan's context
export const DELEGATION_REMINDER = `<internal_reminder>DELEGATE EVERYTHING POSSIBLE TO MYRMIDONS. You are the slowest agent by far - your only job is planning, routing, and synthesizing results. Never do work a Myrmidon can handle. Parallelize aggressively: tool calls made in the SAME response turn run concurrently — always batch all ready task() dispatches into ONE response, never one per turn. SAY WHAT YOU DO: if you announce launching N Myrmidons, emit exactly N task() calls in that same response — never announce multiple then dispatch only one. Before ending a dispatch turn, count your task() calls and confirm they match the number of Myrmidons you named. The task() tool takes only subagent_type, description, and prompt — never pass any other parameters. </internal_reminder>`;

/**
 * Sentinel substring used to detect whether {@link DELEGATION_REMINDER} has
 * already been injected into a system prompt, avoiding double-injection.
 */
export const DELEGATION_REMINDER_SENTINEL =
  'DELEGATE EVERYTHING POSSIBLE TO MYRMIDONS';

/**
 * Per-message reminder injected into EVERY user turn addressed to Titan.
 *
 * The static system prompt reliably drives delegation on the first request, but
 * as a conversation shifts to iterating/tweaking the original task, Titan tends
 * to drift toward doing the work itself. Re-asserting the delegation directive
 * at the point of each new user message keeps that behavior consistent — it
 * mimics the user manually prefixing "delegate this" onto every ask.
 */
export const PER_MESSAGE_DELEGATION_REMINDER = `<delegation_directive>
Before you act on the user's message above, STOP and route it through delegation first.

1. Decompose the request (including any follow-up tweaks, fixes, or refinements to prior work) into concrete units of work.
2. For every unit that would require even a SINGLE tool call — reading/searching/editing files, running commands, testing, validating, looking things up, gathering information, or any mechanical work — you MUST delegate it to Myrmidons via task(). This applies to small iterative changes on the existing task just as much as to brand-new work. Do NOT do it yourself because it "seems quick."
3. Dispatch all independent units in parallel: emit one task() call per unit in a SINGLE response, and make the number of task() calls match the number of Myrmidons you announce.
4. The ONLY time you may answer directly without delegating is when the request is trivially simple, purely conversational, and requires zero tool calls (e.g., clarifying a question, restating a plan, a one-word answer). When in doubt, delegate.

Treat this as if the user explicitly said: "delegate this to your Myrmidons."
</delegation_directive>`;
