export const TITAN_AGENT_NAME = 'titan' as const;

export const ALL_AGENT_NAMES = [TITAN_AGENT_NAME] as const;
export type AgentName = (typeof ALL_AGENT_NAMES)[number];

/** Agents that cannot be disabled. */
export const PROTECTED_AGENTS = new Set([TITAN_AGENT_NAME]);

// Workflow reminders injected into Titan's context
export const DELEGATION_REMINDER = `<internal_reminder>DELEGATE EVERYTHING POSSIBLE TO CHILDREN. You are the slowest agent by far - your only job is planning, routing, and synthesizing results. Never do work a child can handle. Parallelize aggressively: tool calls made in the SAME response turn run concurrently — always batch all ready task() dispatches into ONE response, never one per turn. SAY WHAT YOU DO: if you announce launching N children, emit exactly N task() calls in that same response — never announce multiple then dispatch only one. Before ending a dispatch turn, count your task() calls and confirm they match the number of children you named. The task() tool takes only subagent_type, description, and prompt — never pass any other parameters. </internal_reminder>`;
