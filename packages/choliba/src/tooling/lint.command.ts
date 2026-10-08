import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor, Suggestions } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { passOn, PASS_THROUGH } from './tool-pass-on';
import { ToolsService } from './tools.service';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `lint`; its own `--help` is the tool's. */
const ENTRY: CommandEntry = {
  name: 'lint',
  description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
  group: 'Commands',
  spec: { usage: 'choliba lint [ESLINT_ARGS]', positionals: FILES },
};

@RegisterHelp()
@Command({
  name: 'lint',
  description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
  ...PASS_THROUGH,
})
export class LintCommand extends CliCommand implements HelpContributor {
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
    passOn(this.io, () => this.tools.lint(this.io.args('lint')));
    return Promise.resolve();
  }
}
