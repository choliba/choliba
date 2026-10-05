import type { AgentDefinition, AgentModeSteps, AgentStep } from '../agents/interfaces/agent.interface';
import {
  EXECUTION_MODES,
  type CommandAfterInput,
  type CommandPrepareInput,
  type CommandPrepareResult,
} from '../agents/interfaces/command.interface';
import { expandExitCode } from '../runs/vars';
import { type StepFailure, previewBeforeSteps, runAfterSteps, runBeforeSteps } from './actions';
import { parseGitDiffArgs } from './working-tree-diff';

/** Every step of `agent` in `pick` of each mode, in mode order. */
function allSteps(agent: AgentDefinition, pick: (steps: AgentModeSteps) => readonly AgentStep[]): readonly AgentStep[] {
  return EXECUTION_MODES.flatMap((mode) => pick(agent.steps[mode]));
}

/**
 * The command's `prepare`: runs the `before` steps of the run's mode (or, on `--dry-run`, shows a
 * marker for what each would add) and builds the prompt from the sections they produced, plus the
 * user's task as focus. An empty task falls back to `task.default`. A failed step throws
 * `StepFailedError`.
 */
export function buildPrepare(
  agent: AgentDefinition,
): ((input: CommandPrepareInput) => CommandPrepareResult) | undefined {
  if (allSteps(agent, (steps) => steps.before).length === 0 && agent.defaultTask === undefined) {
    return undefined;
  }
  return (input) => {
    const steps = agent.steps[input.mode].before;
    const prefix = `${input.mode}.before`;
    const sections =
      input.dryRun === true
        ? previewBeforeSteps(steps, prefix)
        : runBeforeSteps({ repoRoot: input.repoRoot, since: input.since }, steps, prefix);
    const hasTask = input.task.trim() !== '';
    const focus = hasTask ? [`Foco pedido pelo usuário: ${input.task}`] : [];
    const task = hasTask ? input.task : (agent.defaultTask ?? input.task);
    const parts = [...sections, ...focus];
    return { task, promptBody: parts.length === 0 ? task : parts.join('\n\n') };
  };
}

/**
 * The command's `after`: in the run's mode, `success` (the agent exited with 0) or `failure`, then
 * `always`, each with `${AGENT_EXIT_CODE}` filled in. Every step runs even when one fails; the ones
 * that failed are returned. `undefined` when the agent has no `after` step in any mode.
 */
export function buildAfter(agent: AgentDefinition): ((input: CommandAfterInput) => readonly StepFailure[]) | undefined {
  const declared = allSteps(agent, (steps) => [...steps.after.success, ...steps.after.failure, ...steps.after.always]);
  if (declared.length === 0) {
    return undefined;
  }
  return (input) => {
    const after = agent.steps[input.mode].after;
    const context = { repoRoot: input.repoRoot, since: undefined };
    const outcome = input.exitCode === 0 ? 'success' : 'failure';
    const run = (block: 'success' | 'failure' | 'always'): readonly StepFailure[] =>
      runAfterSteps(context, expandExitCode(after[block], input.exitCode), `${input.mode}.after.${block}`);
    return [...run(outcome), ...run('always')];
  };
}

/** The base of the agent's `git_diff` (in any mode), or `undefined` when it has none (then `--since` means nothing). */
export function diffBaseOf(agent: AgentDefinition): string | undefined {
  const step = allSteps(agent, (steps) => steps.before).find((candidate) => candidate.action === 'git_diff');
  return step === undefined ? undefined : parseGitDiffArgs(step.args)?.defaultBase;
}
