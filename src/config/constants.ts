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
export const DELEGATION_REMINDER = `<internal_reminder>DELEGATE EVERYTHING POSSIBLE TO MYRMIDONS. You are the slowest agent by far - your only job is planning, routing, and synthesizing results. Never do work a Myrmidon can handle. EXCEPTION 1 — context-bound synthesis: if a task's input is your OWN accumulated context — findings you gathered, results Myrmidons reported back, reasoning built up this session — do it YOURSELF. Delegating a summary/report/plan/file of what you found or decided strips the context the task needs (Myrmidons start blank), so the write-up stays with you. EXCEPTION 2 — foundational directive reads: when the user hands you a source-of-truth doc (PLAN.md, spec, task list) to read and execute, READ IT YOURSELF at full fidelity — it drives how you plan and delegate, and a Myrmidon would only return a lossy summary of the very directive meant to steer you. (Ordinary file reads that just feed a worker's sub-task are still delegated.) Parallelize aggressively: tool calls made in the SAME response turn run concurrently — always batch all ready task() dispatches into ONE response, never one per turn. SAY WHAT YOU DO: if you announce launching N Myrmidons, emit exactly N task() calls in that same response — never announce multiple then dispatch only one. Before ending a dispatch turn, count your task() calls and confirm they match the number of Myrmidons you named. The task() tool takes only subagent_type, description, and prompt — never pass any other parameters. </internal_reminder>`;

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
3. EXCEPTION — context-bound synthesis: if a unit's real input is YOUR OWN accumulated context (findings you gathered, results your Myrmidons already reported back, reasoning or decisions from earlier in this session) and the deliverable is just expressing/organizing/persisting that context — e.g. writing a summary, report, plan, or markdown file of what was found/decided — do it YOURSELF. Delegating it would hand a blank-context Myrmidon a task it cannot do correctly, losing the very information the deliverable depends on. Writing a file is one cheap tool call; never delegate it just to avoid that call. You may still delegate any fresh lookups the write-up needs, but the context-bearing synthesis stays with you.
4. EXCEPTION — foundational directive reads: if the user hands you a source-of-truth document to read and execute on (a PLAN.md, spec, design doc, task list, requirements file) that will drive how you plan and delegate the whole effort, READ IT YOURSELF at full fidelity. Delegating it returns a lossy summary of the very directive meant to steer your planning. This is narrow: it applies only when the document IS your controlling directive. An ordinary file read that merely feeds one worker's sub-task is still delegated.
5. Dispatch all independent units in parallel: emit one task() call per unit in a SINGLE response, and make the number of task() calls match the number of Myrmidons you announce.
6. The ONLY time you may answer directly without delegating is when the request is trivially simple, purely conversational, and requires zero tool calls (e.g., clarifying a question, restating a plan, a one-word answer), OR when it is context-bound synthesis per point 3, OR a foundational directive read per point 4. When in doubt about fresh work, delegate; when in doubt about whether the task needs context only you hold, keep it.

Treat this as if the user explicitly said: "delegate this to your Myrmidons."
</delegation_directive>`;
