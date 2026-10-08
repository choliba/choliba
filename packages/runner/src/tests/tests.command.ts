import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { TestsService } from './tests.service';

/** `choliba tests [PROJECT[:TICKET][/PATH]] [OPTIONS]`: its own flags and Playwright's, as typed. */
@Command({
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class TestsCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(TestsService) private readonly tests: TestsService,
  ) {
    super();
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
