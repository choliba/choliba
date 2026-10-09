import { UsageError } from '../../common';

/** `generate project`, validated: the project's name, its application folder (absolute) and base URL. */
export class GenerateProjectDto {
  constructor(
    readonly project: string,
    readonly appDir: string,
    readonly baseUrl: string | undefined,
  ) {}
}

/** What `generate project` was given, before the questions fill in what is missing. */
export interface GenerateProjectInput {
  readonly project: string | undefined;
  readonly appDir: string | undefined;
  readonly baseUrl: string | undefined;
  readonly noInput: boolean;
}

/** `--flag value`: the value; `undefined` when the flag is absent; throws when it has no value. */
function flagValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new UsageError(`Missing value for ${name}.`);
  return value;
}

/** The first word that is neither a flag nor the value of one of `valueFlags`. */
function positional(args: readonly string[], valueFlags: readonly string[]): string | undefined {
  return args.find((arg, index) => !arg.startsWith('--') && !valueFlags.includes(args[index - 1] ?? ''));
}

/**
 * `generate project [PROJECT] [--app-dir DIR] [--base-url URL] [--no-input]`. A missing `--app-dir` stays
 * missing: the command asks for it on a terminal. A flag with no value is still an error.
 */
export function parseGenerateProjectArgs(args: readonly string[]): GenerateProjectInput {
  return {
    project: positional(args, ['--base-url', '--app-dir']),
    appDir: flagValue(args, '--app-dir'),
    baseUrl: flagValue(args, '--base-url'),
    noInput: args.includes('--no-input'),
  };
}
