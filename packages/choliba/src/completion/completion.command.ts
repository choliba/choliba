import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { commandHelp } from '../help/app.help';
import { COMPLETION_BASH } from './completion';

/** `choliba completion bash`: the bash completion script, on stdout. */
@Command({
  name: 'completion',
  description: 'Imprime o script de autocomplete do bash',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class CompletionCommand extends CliCommand {
  constructor(@Inject(CommandIo) private readonly io: CommandIo) {
    super();
  }

  run(): Promise<void> {
    const args = this.io.args('completion');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(commandHelp('completion'));
    } else if (args[0] === 'bash') {
      this.io.write(COMPLETION_BASH);
    } else {
      this.io.fail('Só o bash é suportado: choliba completion bash');
    }
    return Promise.resolve();
  }
}
