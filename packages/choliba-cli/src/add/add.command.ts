import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { entryHelp, messageOf, type CommandEntry, type HelpContributor, type Suggestions } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { AddService } from './add.service';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `add`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'add',
  description:
    'Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm',
  group: 'Commands',
  spec: {
    usage: 'choliba add <origem> [OPTIONS]',
    positionals: FILES,
    flags: [
      {
        name: '--path',
        value: { name: 'caminho', suggest: () => ({ kind: 'files' }) },
        description: 'Item dentro da origem (ex.: .choliba/agents/test-writer)',
      },
      { name: '--dry-run', description: 'Mostra o que instalaria, sem gravar' },
    ],
  },
};

@RegisterHelp()
/** `choliba add <origem> [--path P] [--dry-run]`: installs into the workspace the command runs in. */
@Command({
  name: 'add',
  description: 'Instala um agente (com suas skills e MCPs), uma skill ou um MCP',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class AddCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AddService) private readonly adder: AddService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    const args = this.io.args('add');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(entryHelp(ENTRY));
      return Promise.resolve();
    }
    try {
      this.io.write(`${this.adder.add(args)}\n`);
    } catch (error) {
      this.io.fail(messageOf(error));
    }
    return Promise.resolve();
  }
}
