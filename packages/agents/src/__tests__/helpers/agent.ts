import type { AgentDefinition, AgentModeSteps, AgentSections } from '../../agent.types';

/** A mode with no steps: nothing before the agent, nothing after it. */
export const NO_STEPS: AgentModeSteps = { before: [], after: { success: [], failure: [], always: [] } };

/** `AgentDefinition.steps` of an agent that declares none. */
export const NO_MODE_STEPS: AgentDefinition['steps'] = { execute: NO_STEPS, plan: NO_STEPS, ask: NO_STEPS };

/** The text of a fake agent, `role` being what the tests look for in the prompt. */
export function fakeSections(role: string): AgentSections {
  return { role, context: [], input: 'The task.', flow: '1. Do it.', output: 'The result.', notes: [] };
}
