import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliHelpService, CliCommand, CommandIo } from '@choliba/core/nest';

import { AppHelpService } from './app-help.service';

const OPTIONS = { options: { hidden: true }, allowUnknownOptions: true, allowExcessArgs: true } as const;

/**
 * `choliba __complete <words…>`: one suggestion per line for the last word, read by the bash completion script
 * (`choliba completion bash`) and by the `chol:*` scripts of this repository.
 */
@Command({ name: '__complete', description: 'Sugestões para o autocomplete', ...OPTIONS })
export class CompleteCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(CliHelpService) private readonly help: CliHelpService,
    @Inject(AppHelpService) private readonly app: AppHelpService,
  ) {
    super();
  }

  run(): Promise<void> {
    this.help.printCompletions(this.app.spec(), this.io.args('__complete'));
    return Promise.resolve();
  }
}

/** `choliba __describe <words…>`: one line on what the words select, read by `bun chol:help`. */
@Command({ name: '__describe', description: 'O que as palavras selecionam, em uma linha', ...OPTIONS })
export class DescribeCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(CliHelpService) private readonly help: CliHelpService,
    @Inject(AppHelpService) private readonly app: AppHelpService,
  ) {
    super();
  }

  run(): Promise<void> {
    this.help.printDescription(this.app.spec(), this.io.args('__describe'));
    return Promise.resolve();
  }
}
