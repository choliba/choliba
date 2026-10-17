import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

import { CACHE_DIR } from '../agent-layout';

import type { AgentStep } from '../../common';
import { READ_FILES_FIELDS, READ_FILES_USAGE, readFiles } from './step-read-files';
import { recordGitHead } from './git-state';
import { WRITE_FILES_FIELDS, WRITE_FILES_USAGE, writeFiles } from './step-write-files';
import { fieldsError, listField, type FieldSpec } from './step-fields';
import { SEARCH_FILES_FIELDS, SEARCH_FILES_USAGE, searchFiles } from './step-search-files';
import { spawnToEnd } from './step-spawn';
import { GIT_DIFF_USAGE, parseGitDiffArgs, runGitDiff } from './working-tree-diff';

export type StepPhase = 'before_execute' | 'after_execute';

export interface StepSpawnResult {
  readonly status: number | null;
}

/**
 * Runs the command with its stdout and stderr both written to one open file (`fd`), in the order it wrote them, and
 * resolves once it ends; `signal` stops it.
 */
export type StepSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; stdio: ['ignore', number, number]; shell: false; signal?: AbortSignal },
) => Promise<StepSpawnResult>;

export interface StepContext {
  readonly repoRoot: string;
  /** `--since` from the command line, for `git_diff`. */
  readonly since: string | undefined;
  readonly spawn?: StepSpawn;
  /** Where a `run` keeps what its command printed; `.cache/steps/` of the workspace when absent. */
  readonly logDir?: string;
  /** Stops the command of the step running (Ctrl+C in the panel); the step then fails. */
  readonly signal?: AbortSignal;
  /** The agent's final answer, after it ran clean: what `write_files` saves. */
  readonly answer?: string;
}

export interface AgentAction {
  readonly usage: string;
  /** The lists this action may appear in. */
  readonly phases: readonly StepPhase[];
  /** Why `step` does not fit the action (its arguments, or its named fields), or nothing; checked on load. */
  readonly check: (step: AgentStep) => string | undefined;
  /** Whether the action adds a section to the prompt (`--dry-run` shows a marker in its place). */
  readonly producesSection: boolean;
  /** Runs the action; a `before_execute` action may return a section for the prompt. */
  readonly run: (context: StepContext, step: AgentStep) => string | undefined | Promise<string | undefined>;
}

/** The check of an action written as a list: no named fields, and arguments `accepts` takes. */
function listCheck(accepts: (args: readonly string[]) => boolean, usage: string): AgentAction['check'] {
  return (step) => (step.options === undefined && accepts(step.args) ? undefined : `esperado "${usage}"`);
}

/** The check of an action written with named fields, saying which field is wrong. */
function fieldsCheck(spec: FieldSpec, usage: string): AgentAction['check'] {
  return (step) => {
    const error = fieldsError(step, spec);
    return error === undefined ? undefined : `${error}: esperado "${usage}"`;
  };
}

function argAt(args: readonly string[], index: number, usage: string): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`argumento faltando: ${usage}`);
  }
  return value;
}

/** The lines of a failed step's output worth showing: the last ones, where the verdict usually is. */
const OUTPUT_TAIL_LINES = 12;

/** The end of what a command printed, without blank ends; the whole of it is in its log. */
function outputTail(output: string): string {
  const trimmed = output.trim();
  return trimmed === '' ? '' : trimmed.split('\n').slice(-OUTPUT_TAIL_LINES).join('\n');
}

/** How many logs this process has written, so two steps of one second never share a file. */
let logCount = 0;

/** The file a `run` keeps its command's output in: one per step, under `logDir`. */
function stepLog(context: StepContext): string {
  const dir = context.logDir ?? join(context.repoRoot, CACHE_DIR, 'steps');
  mkdirSync(dir, { recursive: true });
  logCount += 1;
  const stamp = new Date().toISOString().replaceAll(':', '-');
  return join(dir, `${stamp}-${String(process.pid)}-${String(logCount)}.log`);
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

/**
 * Runs the command with its stdout and stderr in one log, so they keep the order it wrote them in. A failure shows the
 * last lines and where the log is; a success leaves no log.
 */
async function runCommand(context: StepContext, args: readonly string[]): Promise<undefined> {
  const command = argAt(args, 0, 'run <comando> [args...]');
  const spawn: StepSpawn = context.spawn ?? spawnToEnd;
  const log = stepLog(context);
  const fd = openSync(log, 'w');
  let result: StepSpawnResult;
  try {
    result = await spawn(command, args.slice(1), {
      cwd: context.repoRoot,
      stdio: ['ignore', fd, fd],
      shell: false,
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
  } finally {
    closeSync(fd);
  }
  if (result.status === 0) {
    rmSync(log, { force: true });
    return undefined;
  }
  const tail = outputTail(readFileSync(log, 'utf8'));
  const where = `saída completa: ${relative(context.repoRoot, log)}`;
  throw new StepCommandError(tail === '' ? where : `${tail}\n${where}`, result.status ?? undefined);
}

/**
 * Every action an agent.yaml line can name: `<action>: [args]`, or `<action>: { field: value }` for the file actions.
 * `run` is the only external one; a new method of the CLI is just an entry here.
 */
export const ACTIONS: Readonly<Record<string, AgentAction>> = {
  run: {
    usage: 'run <comando> [args...]',
    phases: ['before_execute', 'after_execute'],
    check: listCheck((args) => args.length > 0, 'run <comando> [args...]'),
    producesSection: false,
    run: (context, step) => runCommand(context, step.args),
  },
  git_diff: {
    usage: GIT_DIFF_USAGE,
    phases: ['before_execute'],
    check: listCheck((args) => parseGitDiffArgs(args) !== undefined, GIT_DIFF_USAGE),
    producesSection: true,
    run: (context, step) => {
      const config = parseGitDiffArgs(step.args);
      if (config === undefined) {
        throw new Error(`argumentos inválidos: ${GIT_DIFF_USAGE}`);
      }
      return runGitDiff(config, context);
    },
  },
  search_files: {
    usage: SEARCH_FILES_USAGE,
    phases: ['before_execute'],
    check: fieldsCheck(SEARCH_FILES_FIELDS, SEARCH_FILES_USAGE),
    producesSection: true,
    run: (context, step) => searchFiles(context.repoRoot, step),
  },
  read_files: {
    usage: READ_FILES_USAGE,
    phases: ['before_execute'],
    check: fieldsCheck(READ_FILES_FIELDS, READ_FILES_USAGE),
    producesSection: true,
    run: (context, step) => readFiles(context.repoRoot, step),
  },
  record_git_head: {
    usage: 'record_git_head <arquivo>',
    phases: ['after_execute'],
    check: listCheck((args) => args.length === 1, 'record_git_head <arquivo>'),
    producesSection: false,
    run: (context, step) => {
      recordGitHead(context.repoRoot, argAt(step.args, 0, 'record_git_head <arquivo>'));
      return undefined;
    },
  },
  write_files: {
    usage: WRITE_FILES_USAGE,
    phases: ['after_execute'],
    check: fieldsCheck(WRITE_FILES_FIELDS, WRITE_FILES_USAGE),
    producesSection: false,
    run: (context, step) => {
      writeFiles(context.repoRoot, context.answer, listField(step, 'files'));
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
  const error = action.check(step);
  return error === undefined ? { action } : { error };
}

/** A step that failed: where it is (`execute.before 1/2`), what it ran, its exit status and what it said. */
export interface StepFailure {
  readonly label: string;
  readonly step: AgentStep;
  /** The exit status of a `run`; `undefined` for any other failure (a missing file, an invalid step). */
  readonly status: number | undefined;
  readonly output: string;
}

/** `run: bun choliba …`, or `read_files: tag=manifestos dirs=…`: a step as the user wrote it. */
export function describeStep(step: AgentStep): string {
  if (step.options === undefined) return `${step.action}: ${step.args.join(' ')}`;
  const fields = Object.entries(step.options).map(
    ([name, value]) => `${name}=${typeof value === 'string' ? value : value.join(',')}`,
  );
  return `${step.action}: ${fields.join(' ')}`;
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
async function runStep(
  context: StepContext,
  step: AgentStep,
  phase: StepPhase,
  label: string,
): Promise<{ readonly section: string | undefined } | { readonly failure: StepFailure }> {
  const checked = checkStep(step, phase);
  if ('error' in checked) {
    return { failure: { label, step, status: undefined, output: checked.error } };
  }
  try {
    return { section: await checked.action.run(context, step) };
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
export async function runBeforeSteps(
  context: StepContext,
  steps: readonly AgentStep[],
  prefix: string,
): Promise<readonly string[]> {
  const sections: string[] = [];
  for (const [index, step] of steps.entries()) {
    const result = await runStep(context, step, 'before_execute', stepLabel(prefix, index, steps.length));
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
export async function runAfterSteps(
  context: StepContext,
  steps: readonly AgentStep[],
  prefix: string,
): Promise<readonly StepFailure[]> {
  const failures: StepFailure[] = [];
  for (const [index, step] of steps.entries()) {
    const result = await runStep(context, step, 'after_execute', stepLabel(prefix, index, steps.length));
    if ('failure' in result) failures.push(result.failure);
  }
  return failures;
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
