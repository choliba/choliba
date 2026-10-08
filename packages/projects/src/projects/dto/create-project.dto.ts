import path from 'node:path';

import { UsageError } from '../../common';

/** `create-project`, validated: the project's name, its application folder (absolute) and base URL. */
export class CreateProjectDto {
  constructor(
    readonly project: string,
    readonly appDir: string,
    readonly baseUrl: string | undefined,
  ) {}
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
 * `create-project [PROJECT] --app-dir DIR [--base-url URL]`. A relative `--app-dir` means "from `cwd`", as
 * anywhere on a command line; it is kept absolute, so config.json does not depend on where the project lives.
 * Without a name, the project is named after that folder.
 */
export function parseCreateProjectArgs(args: readonly string[], cwd: string): CreateProjectDto {
  const baseUrl = flagValue(args, '--base-url');
  const appDirArg = flagValue(args, '--app-dir');
  if (appDirArg === undefined) {
    throw new UsageError('Missing --app-dir for create-project: the folder with the application code.');
  }
  const appDir = path.resolve(cwd, appDirArg);
  const project = positional(args, ['--base-url', '--app-dir']) ?? path.basename(appDir);
  return new CreateProjectDto(project, appDir, baseUrl);
}
