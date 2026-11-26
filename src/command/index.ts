import { UsageError } from '../errors';
import { programArguments, setExitCode } from '../execute/process';
import { StdioAdapter } from '../adapters/stdio/index';
import { Conversation } from '../interaction/index';
import { runScript, showUsageError, type RunScriptOptions } from '../usage';
import { helpText } from './help';
import { parseCommandLine, type CommandLine } from './parse';
import type { ArgSpecs, CommandDefinition, OptionSpecs } from './types';

export type * from './types';
export { helpText } from './help';
export { parseCommandLine } from './parse';

export interface RunCommandOptions extends RunScriptOptions {
  /** The command line; defaults to the program's. */
  readonly argv?: readonly string[];
}

/** Types `args` and `options` of `run` from the declaration itself. */
export function defineCommand<
  const TArgs extends ArgSpecs,
  const TOptions extends OptionSpecs,
>(
  definition: CommandDefinition<TArgs, TOptions>,
): CommandDefinition<TArgs, TOptions> {
  return definition;
}

/**
 * Runs a command as a script. The command line is read and checked against
 * the declaration first: `--help` and usage errors are answered right away,
 * without loading the config or opening the log. A valid one runs in
 * `runScript` (config, log, Ctrl+C). A usage error, of the line, of the config
 * or of `run`, is shown on stderr and ends by `onFailure` (code 1).
 */
export async function runCommand<
  TArgs extends ArgSpecs,
  TOptions extends OptionSpecs,
>(
  definition: CommandDefinition<TArgs, TOptions>,
  {
    argv = programArguments(),
    onFailure = () => setExitCode(1),
    output: given,
    ...options
  }: RunCommandOptions = {},
): Promise<void> {
  const output = given ?? new Conversation(new StdioAdapter());

  try {
    let line: CommandLine;
    try {
      line = parseCommandLine(definition, argv);
    } catch (error) {
      if (!(error instanceof UsageError)) throw error;
      showUsageError(output, error.message);
      onFailure();
      return;
    }

    if (line.help) {
      output.write(helpText(definition));
      return;
    }

    const { args, options: values } = line;
    await runScript(
      async ({ signal }) => {
        // `parseCommandLine` shapes args and options from the same
        // declaration their types come from.
        await Reflect.apply(definition.run, undefined, [
          { args, options: values, signal, output },
        ]);
      },
      { ...options, output, onFailure },
    );
  } finally {
    // Releases the terminal it opened, or the process stays alive.
    if (given === undefined) output.close?.();
  }
}
