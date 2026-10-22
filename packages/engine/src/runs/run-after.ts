import type { ExecutionMode } from '@choliba/domain';
import type { Writable } from '@choliba/kernel';

import { formatStepFailure, stepExitCode } from '../steps';
import type { AgentInvocation } from './invocation.interface';

export interface EndedRun {
  readonly mode: ExecutionMode;
  readonly exitCode: number;
  readonly answer: string | undefined;
}

export interface RunAfterDeps {
  readonly repoRoot: string;
  readonly stderr: Writable;
  readonly signal?: AbortSignal;
  readonly project?: { readonly projectsDir: string; readonly name: string };
}

/** Runs every after-step and preserves an agent failure over a later step failure. */
export async function runAfter(command: AgentInvocation, ended: EndedRun, deps: RunAfterDeps): Promise<number> {
  const input = {
    repoRoot: deps.repoRoot,
    mode: ended.mode,
    exitCode: ended.exitCode,
    ...(deps.signal === undefined ? {} : { signal: deps.signal }),
    ...(ended.answer === undefined ? {} : { answer: ended.answer }),
    ...(deps.project === undefined ? {} : { project: deps.project }),
  };
  const failures = (await command.after?.(input)) ?? [];
  failures.forEach((failure) => {
    deps.stderr.write(`${formatStepFailure(failure)}\n`);
  });
  const [first] = failures;
  if (first !== undefined) {
    const blame = ended.exitCode === 0 ? '; quem falhou foram os steps acima' : '';
    deps.stderr.write(`O agente terminou com código ${String(ended.exitCode)}${blame}.\n`);
  }
  return ended.exitCode !== 0 || first === undefined ? ended.exitCode : stepExitCode(first);
}
