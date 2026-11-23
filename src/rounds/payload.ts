/**
 * What the rounds' pages fetch when they need it: the records of
 * `rounds.data` (`rounds.json`) and the files of `rounds.definitions`
 * (`definitions.json`), served by `choliba rounds:web` (pages.ts) and, in
 * this repository's development, by the pages' Vite. Only the disk, no
 * server: Vite's config imports it too.
 */

import {
  join,
  listDirectory,
  pathExists,
  readText,
} from '../filesystem/index.ts';
import { listDefinitions } from './definitions.ts';

/** Every record of `data`, by file name, as the pages read them. */
export function roundsPayload(data: string): string {
  const records = pathExists(data)
    ? listDirectory(data)
        .filter((name) => name.endsWith('.json'))
        .toSorted()
        .map((file) => ({
          file,
          record: JSON.parse(readText(join(data, file))) as unknown,
        }))
    : [];
  return JSON.stringify(records);
}

/** A round of `rounds.definitions` as the pages read it: its files, as text. */
export interface DefinitionFiles {
  readonly id: string;
  /** The file with `defineRound`: `<id>.ts`, alone or in its folder. */
  readonly entry: string;
  /** Every `.ts` of the round, by name: the entry and, in a folder, its pieces. */
  readonly files: Readonly<Record<string, string>>;
}

/** The files of round `id` in `dir`: `<id>.ts`, or every `.ts` of `<id>/`. */
function definitionFiles(dir: string, id: string): DefinitionFiles {
  const entry = `${id}.ts`;
  const single = join(dir, entry);
  if (pathExists(single)) {
    return { id, entry, files: { [entry]: readText(single) } };
  }
  const folder = join(dir, id);
  const names = listDirectory(folder)
    .filter((name) => name.endsWith('.ts'))
    .toSorted();
  return {
    id,
    entry,
    files: Object.fromEntries(
      names.map((name) => [name, readText(join(folder, name))]),
    ),
  };
}

/** Every round declared in `definitions`, with its files as text. */
export function definitionsPayload(definitions: string): string {
  return JSON.stringify(
    listDefinitions(definitions).map((id) => definitionFiles(definitions, id)),
  );
}
