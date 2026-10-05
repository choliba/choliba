import { spawnSync } from 'node:child_process';

import type { AgentStep } from '../agents/interfaces/agent.interface';
import { ADD_FILES_USAGE, addFiles } from './add-files';
import { recordGitHead } from './git-state';
import { GIT_DIFF_USAGE, parseGitDiffArgs, runGitDiff } from './working-tree-diff';

export type StepPhase = 'before_execute' | 'after_execute';

export interface StepSpawnResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type StepSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; encoding: 'utf8'; shell: false },
) => StepSpawnResult;

export interface StepContext {
  readonly repoRoot: string;
  /** `--since` from the command line, for `git_diff`. */
  readonly since: string | undefined;
  readonly spawn?: StepSpawn;
}

export interface AgentAction {
  readonly usage: string;
  /** The lists this action may appear in. */
  readonly phases: readonly StepPhase[];
  /** Whether `args` fit `usage`; checked when agent.yaml is loaded. */
  readonly accepts: (args: readonly string[]) => boolean;
  /** Whether the action adds a section to the prompt (`--dry-run` shows a marker in its place). */
  readonly producesSection: boolean;
  /** Runs the action; a `before_execute` action may return a section for the prompt. */
  readonly run: (context: StepContext, args: readonly string[]) => string | undefined;
}

function argAt(args: readonly string[], index: number, usage: string): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`argumento faltando: ${usage}`);
  }
  return value;
}

/** The lines of a failed step's output worth showing: the last ones, where the reason usually is. */
const OUTPUT_TAIL_LINES = 20;

/** The end of what a command printed, its stdout then its stderr, without blank ends. */
function outputTail(...outputs: readonly string[]): string {
  const text = outputs
    .map((output) => output.trim())
    .filter((output) => output !== '')
    .join('\n');
  return text.split('\n').slice(-OUTPUT_TAIL_LINES).join('\n');
}

/** A `run` whose command exited with a status other than 0 (`undefined` when a signal ended it). */
class StepCommandError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
  ) {
    super(message);
  }
}

function runCommand(context: StepContext, args: readonly string[]): undefined {
  const command = argAt(args, 0, 'run <comando> [args...]');
  const spawn: StepSpawn = context.spawn ?? spawnSync;
  const result = spawn(command, args.slice(1), { cwd: context.repoRoot, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    throw new StepCommandError(outputTail(result.stdout, result.stderr), result.status ?? undefined);
  }
  return undefined;
}

/**
 * Every action an agent.yaml line can name: `<action>: [args]`. `run` is the only external one; a new
 * method of the CLI is just an entry here.
 */
export const ACTIONS: Readonly<Record<string, AgentAction>> = {
  run: {
    usage: 'run <comando> [args...]',
    phases: ['before_execute', 'after_execute'],
    accepts: (args) => args.length > 0,
    producesSection: false,
    run: runCommand,
  },
  git_diff: {
    usage: GIT_DIFF_USAGE,
    phases: ['before_execute'],
    accepts: (args) => parseGitDiffArgs(args) !== undefined,
    producesSection: true,
    run: (context, args) => {
      const config = parseGitDiffArgs(args);
      if (config === undefined) {
        throw new Error(`argumentos inválidos: ${GIT_DIFF_USAGE}`);
      }
      return runGitDiff(config, context);
    },
  },
  add_files: {
    usage: ADD_FILES_USAGE,
    phases: ['before_execute'],
    accepts: (args) => args.length >= 2,
    producesSection: true,
    run: (context, args) => addFiles(context.repoRoot, argAt(args, 0, ADD_FILES_USAGE), args.slice(1)),
  },
  record_git_head: {
    usage: 'record_git_head <arquivo>',
    phases: ['after_execute'],
    accepts: (args) => args.length === 1,
    producesSection: false,
    run: (context, args) => {
      recordGitHead(context.repoRoot, argAt(args, 0, 'record_git_head <arquivo>'));
      return undefined;
    },
  },
};

/** The registered action called `name`; own keys only, so `toString` and friends are not actions. */
export function findAction(name: string): AgentAction | undefined {
  return Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
}

/** The action `step` calls, or why it cannot appear in `phase`. */
export function checkStep(
  step: AgentStep,
  phase: StepPhase,
): { readonly action: AgentAction } | { readonly error: string } {
  const action = findAction(step.action);
  if (action === undefined) {
    return { error: `ação desconhecida "${step.action}" (esperado: ${Object.keys(ACTIONS).join(', ')})` };
  }
  if (!action.phases.includes(phase)) {
    return { error: `"${step.action}" não pode ser usado em ${phase}` };
  }
  if (!action.accepts(step.args)) {
    return { error: `esperado "${action.usage}"` };
  }
  return { action };
}

/** A step that failed: where it is (`execute.before 1/2`), what it ran, its exit status and what it said. */
export interface StepFailure {
  readonly label: string;
  readonly step: AgentStep;
  /** The exit status of a `run`; `undefined` for any other failure (a missing file, an invalid step). */
  readonly status: number | undefined;
  readonly output: string;
}

/** `add_files: falhas_red .cache/…`: a step as the user wrote it. */
export function describeStep(step: AgentStep): string {
  return `${step.action}: ${step.args.join(' ')}`;
}

/** The exit code a run ends with when `failure` stops it: the status of the command, else 1. */
export function stepExitCode(failure: StepFailure): number {
  return failure.status ?? 1;
}

/** The message for a failed step: which one, what it ran, its status, then the end of its output. */
export function formatStepFailure(failure: StepFailure): string {
  const status = failure.status === undefined ? '' : ` (código ${String(failure.status)})`;
  const detail = failure.output === '' ? [] : failure.output.split('\n').map((line) => `  ${line}`);
  return [`✗ ${failure.label} falhou — ${describeStep(failure.step)}${status}`, ...detail].join('\n');
}

/** A `before` step failed: the run stops there, and the agent does not run. */
export class StepFailedError extends Error {
  constructor(readonly failure: StepFailure) {
    super(formatStepFailure(failure));
  }
}

/** What a failed action said: its message, without the `Error: ` that `String` puts before it. */
function errorOutput(error: unknown): string {
  return String(error).replace(/^Error: /, '');
}

/** Runs one step; the section it produced (if any), or how it failed. */
function runStep(
  context: StepContext,
  step: AgentStep,
  phase: StepPhase,
  label: string,
): { readonly section: string | undefined } | { readonly failure: StepFailure } {
  const checked = checkStep(step, phase);
  if ('error' in checked) {
    return { failure: { label, step, status: undefined, output: checked.error } };
  }
  try {
    return { section: checked.action.run(context, step.args) };
  } catch (error) {
    const status = error instanceof StepCommandError ? error.status : undefined;
    return { failure: { label, step, status, output: errorOutput(error) } };
  }
}

/** `execute.before 2/3`: the position of the step `index` in a list of `total` under `prefix`. */
function stepLabel(prefix: string, index: number, total: number): string {
  return `${prefix} ${String(index + 1)}/${String(total)}`;
}

/**
 * Runs the `before` steps in order and returns the prompt sections they produced. The first
 * failure stops everything: it throws `StepFailedError`, and the steps after it do not run.
 */
export function runBeforeSteps(context: StepContext, steps: readonly AgentStep[], prefix: string): readonly string[] {
  const sections: string[] = [];
  for (const [index, step] of steps.entries()) {
    const result = runStep(context, step, 'before_execute', stepLabel(prefix, index, steps.length));
    if ('failure' in result) {
      throw new StepFailedError(result.failure);
    }
    if (result.section !== undefined) {
      sections.push(result.section);
    }
  }
  return sections;
}

/** Runs the `after` steps in order, every one of them even when one fails, and returns those that failed. */
export function runAfterSteps(
  context: StepContext,
  steps: readonly AgentStep[],
  prefix: string,
): readonly StepFailure[] {
  return steps.flatMap((step, index) => {
    const result = runStep(context, step, 'after_execute', stepLabel(prefix, index, steps.length));
    return 'failure' in result ? [result.failure] : [];
  });
}

/**
 * `--dry-run`: what the `before` steps would add to the prompt, one marker per step that adds a
 * section, since none of them runs.
 */
export function previewBeforeSteps(steps: readonly AgentStep[], prefix: string): readonly string[] {
  return steps.flatMap((step, index) =>
    findAction(step.action)?.producesSection === true
      ? [`[${stepLabel(prefix, index, steps.length)} — ${describeStep(step)}: produzido aqui na execução real]`]
      : [],
  );
}
