import { CommandRunner } from 'nest-commander';

type CommanderCommand = Parameters<CommandRunner['setCommand']>[0];

/**
 * Base of every choliba command. Turns off the parser's own help (`-h`, `--help`, `help`), so they reach
 * `run()` and the command prints its pt-BR help from its `CommandSpec`, like everything else it prints.
 */
export abstract class CliCommand extends CommandRunner {
  override setCommand(command: CommanderCommand): this {
    command.helpOption(false);
    command.addHelpCommand(false);
    return super.setCommand(command);
  }
}
