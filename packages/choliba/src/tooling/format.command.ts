import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor, Suggestions } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { passOn, PASS_THROUGH } from './tool-pass-on';
import { ToolsService } from './tools.service';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `format`; its own `--help` is the tool's. */
const ENTRY: CommandEntry = {
  name: 'format',
  description: 'Prettier na pasta de trabalho: confere, ou corrige com --write',
  group: 'Commands',
  spec: {
    usage: 'choliba format [--write] [PATHS...]',
    flags: [{ name: '--write', description: 'Corrige em vez de só conferir' }],
    positionals: FILES,
  },
};

@RegisterHelp()
@Command({
  name: 'format',
  description: 'Prettier na pasta de trabalho: confere, ou corrige com --write',
  ...PASS_THROUGH,
})
export class FormatCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ToolsService) private readonly tools: ToolsService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    passOn(this.io, () => this.tools.format(this.io.args('format')));
    return Promise.resolve();
  }
}
