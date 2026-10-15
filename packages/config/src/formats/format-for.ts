import { basename } from 'node:path';

import { ConfigError, type ConfigFormat } from '../common';
import { dotenv } from './dotenv-format';
import { json } from './json-format';
import { yaml } from './yaml-format';

/** The formats this package reads, in the order a file name is matched against them. */
export const CONFIG_FORMATS: readonly ConfigFormat[] = [dotenv, json, yaml];

/** Whether `name` ends with `ending`, or is `ending` or starts with it when the ending is a whole name (`.env.local`). */
function matches(name: string, ending: string): boolean {
  return name.endsWith(ending) || name === ending || name.startsWith(`${ending}.`);
}

/** The format of the file at `file`, by its name: `.env` (and `.env.local`…), `.json`, `.yaml` or `.yml`. */
export function formatFor(file: string, formats: readonly ConfigFormat[] = CONFIG_FORMATS): ConfigFormat {
  const name = basename(file);
  const found = formats.find((format) => format.extensions.some((ending) => matches(name, ending)));
  if (found !== undefined) return found;
  const known = formats.flatMap((format) => format.extensions).join(', ');
  throw new ConfigError(`${file}: formato desconhecido. Use um arquivo ${known}, ou diga o formato.`);
}
