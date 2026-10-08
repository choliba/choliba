import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { entryHelp, messageOf, type CommandEntry, type HelpContributor, type Suggestions } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { InstallService } from './install.service';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `install`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'install',
  description:
    'Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm',
  group: 'Commands',
  spec: {
    usage: 'choliba install <origem> [OPTIONS]',
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
@Command({
  name: 'install',
  description: 'Instala um agente (com suas skills e MCPs), uma skill ou um MCP',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class InstallCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(InstallService) private readonly installer: InstallService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    const args = this.io.args('install');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(entryHelp(ENTRY));
      return Promise.resolve();
    }
    try {
      this.io.write(`${this.installer.install(args)}\n`);
    } catch (error) {
      this.io.fail(messageOf(error));
    }
    return Promise.resolve();
  }
}
