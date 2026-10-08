import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { entryHelp, type CommandEntry, type HelpContributor } from '@choliba/core';

import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { COMPLETION_BASH } from './completion';

/** How `choliba --help` lists `completion`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'completion',
  description: 'Imprime o script de autocomplete do bash',
  group: 'Commands',
  spec: {
    usage: 'choliba completion bash',
    positionals: (previous) => ({ kind: 'values', values: previous.length === 0 ? ['bash'] : [] }),
  },
};

/** `choliba completion bash`: the bash completion script, on stdout. */
@RegisterHelp()
@Command({
  name: 'completion',
  description: 'Imprime o script de autocomplete do bash',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class CompletionCommand extends CliCommand implements HelpContributor {
  constructor(@Inject(CommandIo) private readonly io: CommandIo) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    const args = this.io.args('completion');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(entryHelp(ENTRY));
    } else if (args[0] === 'bash') {
      this.io.write(COMPLETION_BASH);
    } else {
      this.io.fail('Só o bash é suportado: choliba completion bash');
    }
    return Promise.resolve();
  }
}
