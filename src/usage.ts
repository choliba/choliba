import { loadConfig, type LoadConfigOptions } from './config/index';
import { UsageError } from './errors';
import { listenForInterrupt } from './execute/interrupt';
import { exitProgram, onUncaughtError, setExitCode } from './execute/process';
import { closeLogger, log, openLogger } from './logger/index';
import { writeErr } from './output/stdio';
import { StdioAdapter } from './adapters/stdio/index';
import { Conversation, type Interaction } from './interaction/index';

export { UsageError };

export interface ScriptContext {
  /** Aborted on the first Ctrl+C; agents created in the script use it by default. */
  readonly signal: AbortSignal;
}

export interface RunScriptOptions {
  /**
   * Where usage errors are shown, as errors (`error`; stderr without it): a
   * conversation on stdio by default, whose errors go to stderr.
   */
  readonly output?: Interaction;
  /** Which choliba.config to load; defaults to the one found from the cwd. */
  readonly config?: LoadConfigOptions;
  /** How a usage error ends the program; with exit code 1 by default. */
  readonly onFailure?: () => void;
}

let current: AbortSignal | undefined;

/** Signal of the running script, if any. */
export function scriptSignal(): AbortSignal | undefined {
  return current;
}

export async function runScript(
  start: (context: ScriptContext) => Promise<void>,
  {
    output = new Conversation(new StdioAdapter()),
    config = {},
    onFailure = () => setExitCode(1),
  }: RunScriptOptions = {},
): Promise<void> {
  const interrupt = listenForInterrupt();
  current = interrupt.signal;

  try {
    await loadConfig(config);
    // One log for the whole script, shared by every agent it runs.
    openLogger();
    await start({ signal: interrupt.signal });
  } catch (error) {
    log.failure(error);

    if (error instanceof UsageError) {
      showUsageError(output, error.message);
      onFailure();
      return;
    }

    throw error;
  } finally {
    closeLogger();
    interrupt.dispose();
    current = undefined;
  }
}

/**
 * A usage error where errors go: the interaction's `error` (stderr, on
 * stdio), or stderr itself when it has none. Never stdout: that is the
 * program's result.
 */
export function showUsageError(output: Interaction, message: string): void {
  if (output.error === undefined) writeErr(`${message}\n`);
  else output.error(message);
}

let handling = false;

/**
 * Errors nobody caught, as `runScript` shows them: a usage error (a policy
 * Choliba cannot apply, a busy port, a wrong root) is its message, without a
 * stack trace; anything else, its stack. Either ends the program with 1.
 * Installed once, when Choliba is imported, so an agent file needs no
 * `runScript` for it.
 */
export function showUncaughtErrors(): void {
  if (handling) return;
  handling = true;

  onUncaughtError((error) => {
    log.failure(error);
    closeLogger();
    if (error instanceof UsageError) {
      writeErr(`${error.message}\n`);
    } else {
      writeErr(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
    }
    exitProgram(1);
  });
}
