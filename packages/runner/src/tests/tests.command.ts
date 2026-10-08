import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf, type CommandEntry, type HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { TestsService } from './tests.service';

/** How `choliba --help` lists `tests`; its spec is built from the workspace when asked for. */
const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  group: 'Commands',
};

/** `choliba tests [PROJECT[:TICKET][/PATH]] [OPTIONS]`: its own flags and Playwright's, as typed. */
@RegisterHelp()
@Command({
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class TestsCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(TestsService) private readonly tests: TestsService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [{ ...ENTRY, spec: this.tests.helpSpec() }];
  }

  async run(): Promise<void> {
    const args = this.io.args('tests');
    if (args.some((arg) => arg === '--help' || arg === '-h')) {
      this.io.printHelp(this.tests.helpSpec());
      return;
    }
    try {
      this.io.exit(await this.tests.run(args));
    } catch (error) {
      this.io.fail(messageOf(error));
    }
  }
}
