export const TITAN_AGENT_NAME = 'titan' as const;

export const ALL_AGENT_NAMES = [TITAN_AGENT_NAME] as const;
export type AgentName = (typeof ALL_AGENT_NAMES)[number];

/** Agents that cannot be disabled. */
export const PROTECTED_AGENTS = new Set([TITAN_AGENT_NAME]);

// Workflow reminders injected into Titan's context
export const DELEGATION_REMINDER = `<internal_reminder>DELEGATE EVERYTHING POSSIBLE TO CHILDREN. You are the slowest agent by far - your only job is planning, routing, and synthesizing results. Never do work a child can handle. Parallelize aggressively. Launch all independent tasks simultaneously. Check the Background Job Board for idle children before doing any work yourself. DO NOT POLL RUNNING JOBS. Wait for hook-driven completion. </internal_reminder>`;
