import { Inject } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { RootCommand as NestRootCommand } from 'nest-commander';

import { discover } from '../common/nest';
import { HelpRegistryService } from '../help/nest';
import { CliCommand } from './cli-command';
import { CommandIo } from './command-io.service';
import { messageOf } from './message-of';
import type { RootFallback, RootOptions } from './interfaces/root.interface';
import { RegisterRootFallback } from './register-root-fallback.decorator';
import { ROOT_OPTIONS } from './root.constants';

const HELP_WORDS: readonly string[] = ['help', '--help', '-h'];
const VERSION_WORDS: readonly string[] = ['version', '--version'];

function isRootFallback(value: unknown): value is RootFallback {
  return typeof (value as Partial<RootFallback> | undefined)?.runUnknown === 'function';
}

/** The program's name, the first word of its usage (`choliba` of `choliba COMMAND [ARGS]`). */
function programOf(options: RootOptions): string {
  return options.spec.usage.split(' ', 1).join('');
}

/**
 * The app with no command, or with `help`/`--help`/`-h`: its help, listing the registered commands; `version` or
 * `--version`: its version. Any other first word goes to the `RootFallback`, or is a usage error when there is none.
 */
@NestRootCommand({ arguments: '[words...]', allowUnknownOptions: true, allowExcessArgs: true })
export class RootCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(HelpRegistryService) private readonly registry: HelpRegistryService,
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(ROOT_OPTIONS) private readonly options: RootOptions,
  ) {
    super();
  }

  async run(): Promise<void> {
    const argv = this.io.args();
    const [first] = argv;
    if (first === undefined || HELP_WORDS.includes(first)) {
      this.io.printHelp(this.registry.spec(this.options.spec, this.options));
      return;
    }
    if (VERSION_WORDS.includes(first)) {
      this.io.write(`${this.options.version()}\n`);
      return;
    }
    const [fallback] = discover(this.discovery, RegisterRootFallback, isRootFallback);
    if (fallback === undefined) {
      this.io.usageError(`comando desconhecido: ${first}.`, programOf(this.options));
      return;
    }
    try {
      this.io.exit(await fallback.runUnknown(argv));
    } catch (error) {
      this.io.fail(messageOf(error));
    }
  }
}
