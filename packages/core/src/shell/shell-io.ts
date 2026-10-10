import { formatHelp, wantsHelp, type CommandSpec } from '../help';
import { rawArgsAfter, type Writable } from '../platform';

/** Where a shell command reads its arguments and writes: the command line, stdout and stderr. */
export interface ShellStreams {
  readonly argv: readonly string[];
  readonly stdout: Writable;
  readonly stderr: Writable;
}

/**
 * What a shell command reads and writes: its arguments as typed, stdout for the result, stderr for messages, its help,
 * and the exit code.
 */
export class ShellIo {
  private code = 0;

  constructor(private readonly streams: ShellStreams) {}

  /** The arguments after the command `path` (`'projects', 'list'`), as typed. */
  args(...path: readonly string[]): readonly string[] {
    return rawArgsAfter(this.streams.argv, ...path);
  }

  wantsHelp(args: readonly string[]): boolean {
    return wantsHelp(args);
  }

  /** `--help`, on stdout. */
  printHelp(spec: CommandSpec): void {
    this.streams.stdout.write(`${formatHelp(spec)}\n`);
  }

  /** The result, on stdout. */
  write(text: string): void {
    this.streams.stdout.write(text);
  }

  /** The command failed: `message` on stderr, exit code 1. */
  fail(message: string): void {
    this.streams.stderr.write(`${message}\n`);
    this.code = 1;
  }

  /** The exit code of a command that ran something else (a child process) and passes its code on. */
  exit(code: number): void {
    this.code = code;
  }

  /** The command line is wrong: `message` and where to read the usage of `command`, exit code 1. */
  usageError(message: string, command: string): void {
    this.streams.stderr.write(`${message}\nRun '${command} --help' for usage.\n`);
    this.code = 1;
  }

  /** The exit code the command chose: 0 until it says otherwise. */
  exitCode(): number {
    return this.code;
  }
}
