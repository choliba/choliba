import { spawnSync } from 'node:child_process';

import type { AgentStep } from '../agent.types';
import { ADD_FILES_USAGE, addFiles } from './add-files';
import { recordGitHead } from './git-state';
import { GIT_DIFF_USAGE, parseGitDiffArgs, runGitDiff } from './working-tree-diff';

export type StepPhase = 'before_execute' | 'after_execute';

export interface StepSpawnResult {
  readonly status: number | null;
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

function runCommand(context: StepContext, args: readonly string[]): undefined {
  const command = argAt(args, 0, 'run <comando> [args...]');
  const spawn: StepSpawn = context.spawn ?? spawnSync;
  const result = spawn(command, args.slice(1), { cwd: context.repoRoot, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    throw new Error(`run "${args.join(' ')}" falhou: ${result.stderr.trim()}`);
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
    run: runCommand,
  },
  git_diff: {
    usage: GIT_DIFF_USAGE,
    phases: ['before_execute'],
    accepts: (args) => parseGitDiffArgs(args) !== undefined,
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
    run: (context, args) => addFiles(context.repoRoot, argAt(args, 0, ADD_FILES_USAGE), args.slice(1)),
  },
  record_git_head: {
    usage: 'record_git_head <arquivo>',
    phases: ['after_execute'],
    accepts: (args) => args.length === 1,
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

/**
 * The format before `<action>: [args]`, still accepted: a string (`"bun x prettier --write docs"`, run
 * through the shell) or a list (run without one), where a first word naming a registered method calls it.
 */
export function legacyStep(line: string | readonly string[]): AgentStep {
  const argv = typeof line === 'string' ? line.trim().split(/\s+/) : line;
  const [name = '', ...args] = argv;
  if (findAction(name) !== undefined) {
    return { action: name, args };
  }
  return typeof line === 'string' ? { action: 'run', args: ['sh', '-c', line] } : { action: 'run', args: argv };
}

/** Runs `steps` in order and returns the prompt sections they produced. The first failure throws. */
export function runSteps(context: StepContext, steps: readonly AgentStep[], phase: StepPhase): readonly string[] {
  const sections: string[] = [];
  for (const step of steps) {
    const checked = checkStep(step, phase);
    if ('error' in checked) {
      throw new Error(`${phase}: ${checked.error}`);
    }
    const section = checked.action.run(context, step.args);
    if (section !== undefined) {
      sections.push(section);
    }
  }
  return sections;
}
