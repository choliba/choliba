import type { AgentDefinition, AgentPhase } from './agent.types';

export class PhaseError extends Error {}

/** The flag that runs only `phase`: `--<name>`. */
export function phaseFlag(phase: Pick<AgentPhase, 'name'>): string {
  return `--${phase.name}`;
}

/**
 * The agent as one run of `phase`: the phase's instructions, policy and steps in place of the
 * agent's. What the run needs from the agent (models, skills, mcps, project, tickets) stays.
 */
export function agentInPhase(agent: AgentDefinition, phase: AgentPhase): AgentDefinition {
  const { phases: _phases, beforeExecute: _before, afterExecute: _after, ...base } = agent;
  return {
    ...base,
    systemPromptPath: phase.systemPromptPath,
    instructions: phase.instructions,
    policy: phase.policy,
    ...(phase.beforeExecute === undefined ? {} : { beforeExecute: phase.beforeExecute }),
    ...(phase.afterExecute === undefined ? {} : { afterExecute: phase.afterExecute }),
  };
}

/** Why `phase` is off for the run's project (its `project_switch` is not `true` in config.json); `undefined` when on. */
export type PhaseSwitch = (phase: AgentPhase) => string | undefined;

export interface PhaseSelection {
  readonly run: readonly AgentPhase[];
  /** Phases left out because the project turns them off, each with why. */
  readonly skipped: readonly { readonly phase: AgentPhase; readonly reason: string }[];
}

/**
 * The phases a run goes through, in the declared order: the ones named by `requested`, or all of
 * them. A phase the project turns off is skipped, unless it was asked for by name: then the run stops.
 */
export function selectPhases(
  phases: readonly AgentPhase[],
  requested: readonly string[],
  offReason: PhaseSwitch,
): PhaseSelection {
  const wanted = requested.length === 0 ? phases : phases.filter((phase) => requested.includes(phase.name));
  const run: AgentPhase[] = [];
  const skipped: { phase: AgentPhase; reason: string }[] = [];
  for (const phase of wanted) {
    const reason = offReason(phase);
    if (reason === undefined) {
      run.push(phase);
      continue;
    }
    if (requested.includes(phase.name)) {
      throw new PhaseError(`a fase ${phase.name} está ${reason}.`);
    }
    skipped.push({ phase, reason });
  }
  if (run.length === 0) {
    throw new PhaseError('nenhuma fase para rodar: todas estão desligadas neste projeto.');
  }
  return { run, skipped };
}
