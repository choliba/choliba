import { Inject } from '@nestjs/common';
import { RootCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import type { CliRuntime } from '../runtime/interfaces/runtime.interface';
import { RUNTIME } from '../runtime/runtime.constants';
import { CLI_HELP } from './cli.help';
import { versionLine } from './version';

const HELP_WORDS: readonly string[] = ['help', '--help', '-h'];

/** `choliba-cli` with no command or with `help`/`--help`/`-h`: the help; `--version`: the version; anything else: an error. */
@RootCommand({ arguments: '[words...]', allowUnknownOptions: true, allowExcessArgs: true })
export class CholibaCliRootCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
  ) {
    super();
  }

  run(): Promise<void> {
    const [first] = this.io.args();
    if (first === undefined || HELP_WORDS.includes(first)) this.io.printHelp(CLI_HELP);
    else if (first === '--version') this.io.write(versionLine(this.runtime.packageDir));
    else this.io.usageError(`comando desconhecido: ${first}.`, 'choliba-cli');
    return Promise.resolve();
  }
}
