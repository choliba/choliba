import type { Prompter } from '../prompter';

/** Runs a command in `cwd`, its output on stderr (stdout is for the result); resolves to its exit code. */
export type RunCommand = (command: string, args: readonly string[], cwd: string) => number;

/** How a command run in the background ended: its status (`null` when it did not start) and what it wrote. */
export interface CapturedRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** What `main.ts` gives the commands besides the platform: the real commands, the questions and where this package is. */
export interface CliRuntime {
  readonly run: RunCommand;
  /** Runs a command in `cwd`, keeping what it writes (`bun add`, the workspace's `choliba --version`). */
  readonly capture: (command: string, args: readonly string[], cwd: string) => CapturedRun;
  /** Runs a command in `cwd` with the terminal attached (stdin, stdout and stderr); resolves to its exit code. */
  readonly exec: RunCommand;
  /** The questions on a terminal (`@clack/prompts`). */
  readonly prompter: Prompter;
  /** Whether stdin and stdout are a terminal: without one, nothing is asked. */
  readonly interactive: boolean;
  /** The folder of this package's `package.json` (the installed one, or the sources'), for `--version`. */
  readonly packageDir: string;
}
