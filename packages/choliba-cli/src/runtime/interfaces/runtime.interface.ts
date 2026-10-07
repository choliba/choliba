import type { Prompter } from '../../new/prompter';

/** Runs a command in `cwd`, its output on stderr (stdout is for the result); resolves to its exit code. */
export type RunCommand = (command: string, args: readonly string[], cwd: string) => number;

/** What `main.ts` gives the commands besides the platform: the real commands, the questions and where this package is. */
export interface CliRuntime {
  readonly run: RunCommand;
  /** The questions on a terminal (`@clack/prompts`). */
  readonly prompter: Prompter;
  /** Whether stdin and stdout are a terminal: without one, nothing is asked. */
  readonly interactive: boolean;
  /** The folder of this package's `package.json` (the installed one, or the sources'), for `--version`. */
  readonly packageDir: string;
}
