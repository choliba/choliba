import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliCommand, ExitStatus } from '@choliba/core/nest';
import { ARGV, STDERR, rawArgsAfter, type Writable } from '@choliba/core/platform';

import { parseRunArgs, type RunDto } from './dto/run.dto';
import { TerminalService } from './terminal.service';

/** `choliba terminal run --label <name> -- <command…>`: hidden, for scripts that label a process's output. */
@Command({
  name: 'terminal',
  description: 'Roda um comando com as linhas rotuladas',
  options: { hidden: true },
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class TerminalCommand extends CliCommand {
  constructor(
    @Inject(TerminalService) private readonly terminal: TerminalService,
    @Inject(ExitStatus) private readonly exit: ExitStatus,
    @Inject(ARGV) private readonly argv: readonly string[],
    @Inject(STDERR) private readonly stderr: Writable,
  ) {
    super();
  }

  async run(): Promise<void> {
    const dto = this.parse(rawArgsAfter(this.argv, 'terminal'));
    this.exit.set(dto === undefined ? 1 : await this.terminal.run(dto));
  }

  private parse(args: readonly string[]): RunDto | undefined {
    try {
      return parseRunArgs(args);
    } catch (error) {
      this.stderr.write(`${String(error)}\n`);
      return undefined;
    }
  }
}
