import { Inject, Injectable } from '@nestjs/common';

import type { CommandSpec } from '../help';
import { CliHelpService } from '../help/nest';
import { ARGV, rawArgsAfter, STDERR, STDOUT, type Writable } from '../platform';
import { ExitStatus } from '../platform/nest';

/**
 * What a command reads and writes: its arguments as typed, stdout for the result, stderr for messages, its
 * help, and the exit code. One injection instead of six in every command.
 */
@Injectable()
export class CommandIo {
  constructor(
    @Inject(ARGV) private readonly argv: readonly string[],
    @Inject(STDOUT) private readonly stdout: Writable,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(ExitStatus) private readonly exitStatus: ExitStatus,
    @Inject(CliHelpService) private readonly help: CliHelpService,
  ) {}

  /** The arguments after the command `path` (`'projects', 'create-project'`), as typed. */
  args(...path: readonly string[]): readonly string[] {
    return rawArgsAfter(this.argv, ...path);
  }

  wantsHelp(args: readonly string[]): boolean {
    return this.help.wantsHelp(args);
  }

  printHelp(spec: CommandSpec): void {
    this.help.printHelp(spec);
  }

  /** The result, on stdout. */
  write(text: string): void {
    this.stdout.write(text);
  }

  /** The command failed: `message` on stderr, exit code 1. */
  fail(message: string): void {
    this.stderr.write(`${message}\n`);
    this.exitStatus.set(1);
  }

  /** The exit code of a command that ran something else (a child process) and passes its code on. */
  exit(code: number): void {
    this.exitStatus.set(code);
  }

  /** The command line is wrong: `message` and where to read the usage of `command`, exit code 1. */
  usageError(message: string, command: string): void {
    this.exitStatus.set(this.help.usageError(message, command));
  }
}
