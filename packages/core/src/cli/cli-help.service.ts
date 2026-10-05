import { Inject, Injectable } from '@nestjs/common';

import type { Writable } from '../platform/interfaces/platform.interface';
import { STDERR, STDOUT } from '../platform/platform.constants';
import { complete, describe, formatSuggestions } from './complete';
import { formatHelp } from './help';
import type { CommandSpec } from './interfaces/cli.interface';
import { wantsHelp } from './wants-help';

/** What every command prints from its `CommandSpec`: its help, its completions and its one-line summary. */
@Injectable()
export class CliHelpService {
  constructor(
    @Inject(STDOUT) private readonly stdout: Writable,
    @Inject(STDERR) private readonly stderr: Writable,
  ) {}

  wantsHelp(args: readonly string[]): boolean {
    return wantsHelp(args);
  }

  /** `--help`, on stdout. */
  printHelp(spec: CommandSpec): void {
    this.stdout.write(`${formatHelp(spec)}\n`);
  }

  /** `__complete <words…>`: one suggestion per line (nothing at all when there is none). */
  printCompletions(spec: CommandSpec, words: readonly string[]): void {
    const output = formatSuggestions(complete(spec, words));
    if (output !== '') {
      this.stdout.write(`${output}\n`);
    }
  }

  /** `__describe <words…>`: one line saying what the words select (the examples a description may go on with stay out). */
  printDescription(spec: CommandSpec, words: readonly string[]): void {
    const [line] = describe(spec, words).split('\n');
    this.stdout.write(`${String(line)}\n`);
  }

  /** A usage error: the message and where to read the usage, on stderr; returns the exit code (1). */
  usageError(message: string, command: string): number {
    this.stderr.write(`${message}\nRun '${command} --help' for usage.\n`);
    return 1;
  }
}
