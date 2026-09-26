import type { AgentDefinition } from '../agent.types';
import type { CommandPrepareInput, CommandPrepareResult } from '../command.types';
import { runSteps } from './actions';
import { parseGitDiffArgs } from './working-tree-diff';

/**
 * The command's `prepare`: runs `before_execute` and builds the prompt from the sections it produced,
 * plus the user's task as focus. An empty task falls back to `default_task`.
 */
export function buildPrepare(
  agent: AgentDefinition,
): ((input: CommandPrepareInput) => CommandPrepareResult) | undefined {
  const steps = agent.beforeExecute;
  if (steps === undefined && agent.defaultTask === undefined) {
    return undefined;
  }
  return (input) => {
    const sections = runSteps({ repoRoot: input.repoRoot, since: input.since }, steps ?? [], 'before_execute');
    const hasTask = input.task.trim() !== '';
    const focus = hasTask ? [`Foco pedido pelo usuário: ${input.task}`] : [];
    const task = hasTask ? input.task : (agent.defaultTask ?? input.task);
    const parts = [...sections, ...focus];
    return { task, promptBody: parts.length === 0 ? task : parts.join('\n\n') };
  };
}

export function buildAfterExecute(agent: AgentDefinition): ((repoRoot: string) => void) | undefined {
  const steps = agent.afterExecute;
  if (steps === undefined) {
    return undefined;
  }
  return (repoRoot) => {
    runSteps({ repoRoot, since: undefined }, steps, 'after_execute');
  };
}

/** The base of the agent's `git_diff`, or `undefined` when it has none (then `--since` means nothing). */
export function diffBaseOf(agent: AgentDefinition): string | undefined {
  const step = agent.beforeExecute?.find((candidate) => candidate.action === 'git_diff');
  return step === undefined ? undefined : parseGitDiffArgs(step.args)?.defaultBase;
}
