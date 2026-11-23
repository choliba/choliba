import { UsageError } from '../../errors';
import {
  basename,
  dirname,
  isDirectory,
  isWithin,
  join,
  pathExists,
  realPath,
} from '../../filesystem/index';
import { runtimeExecutable } from '../../execute/process';
import { STANDARD_PROGRAM_DIRS, USER_PROGRAM_DIRS } from '../constants';

/**
 * A program as the sandbox finds it: its `name`, where a search of the
 * `PATH` finds it (`path`, with the directory's links resolved, so it is a
 * real place to mount on) and the file it runs (`file`, every link resolved).
 */
export interface FoundProgram {
  readonly name: string;
  readonly path: string;
  readonly file: string;
}

/** What `findPrograms` found of the names asked, and what it did not. */
export interface ProgramCheck {
  readonly found: readonly FoundProgram[];
  readonly missing: readonly string[];
}

/** An executable's name, as a shell runs it: no folder, no spaces. */
const PROGRAM_NAME = /^[^/\s]+$/;

/**
 * Refuses what is not an executable's name (`php`, not `/usr/bin/php` nor
 * `php cli`); the error names the offending entry.
 */
export function validateProgramNames(names: readonly string[]): void {
  const invalid = names.find(
    (name) => !PROGRAM_NAME.test(name) || name === '.' || name === '..',
  );
  if (invalid === undefined) return;
  throw new UsageError(
    `Programa inválido em programs: "${invalid}". Use o nome do executável, como php (não o caminho nem o pacote).`,
  );
}

/** Each of `names` in the directories of `searchPath`, as a shell finds it. */
export function findPrograms(
  names: readonly string[],
  searchPath: string | undefined,
): ProgramCheck {
  validateProgramNames(names);
  const found: FoundProgram[] = [];
  const missing: string[] = [];
  for (const name of new Set(names)) {
    const program = findProgram(name, searchPath);
    if (program === undefined) missing.push(name);
    else found.push(program);
  }
  return { found, missing };
}

/**
 * The programs of `names`, or a `UsageError` naming each one the sandbox
 * would not find: before anything starts in it.
 */
export function requirePrograms(
  names: readonly string[],
  searchPath: string | undefined,
): readonly FoundProgram[] {
  const { found, missing } = findPrograms(names, searchPath);
  if (missing.length === 0) return found;
  throw new UsageError(
    `Programas selecionados que a sandbox não encontra: ${missing.join(', ')}. Instale no host, numa pasta do PATH, ou tire da lista programs.`,
  );
}

/**
 * The program at the absolute `executable` (Choliba's runtime): where it is,
 * and the file it runs.
 */
export function programAt(executable: string): FoundProgram | undefined {
  if (!pathExists(executable) || isDirectory(executable)) return undefined;
  const name = basename(executable);
  return {
    name,
    path: join(realPath(dirname(executable)), name),
    file: realPath(executable),
  };
}

/** The first `name` in the directories of `searchPath`, as a shell finds it. */
export function findInPath(
  name: string,
  searchPath: string | undefined,
): string | undefined {
  for (const dir of (searchPath ?? '').split(':')) {
    if (dir.length === 0) continue;
    const candidate = join(dir, name);
    if (pathExists(candidate) && !isDirectory(candidate)) return candidate;
  }
  return undefined;
}

function findProgram(
  name: string,
  searchPath: string | undefined,
): FoundProgram | undefined {
  const path = findInPath(name, searchPath);
  return path === undefined ? undefined : programAt(path);
}

/**
 * Where programs live, emptied in a sandbox that shows only the selected
 * ones: the system's program folders, the user's (`~/.local/bin`,
 * `~/.bun/bin`) and every folder of `searchPath`, each by its real path
 * (`/bin` is often a link to `/usr/bin`). A folder the sandbox mounts
 * writable is left alone: it is the agent's to write.
 */
export function programDirs(
  searchPath: string | undefined,
  home: string,
  writable: readonly string[],
): string[] {
  const candidates = [
    ...STANDARD_PROGRAM_DIRS,
    ...USER_PROGRAM_DIRS.map((dir) => join(home, dir)),
    ...(searchPath ?? '').split(':'),
  ];
  const dirs: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.startsWith('/') || !pathExists(candidate)) continue;
    if (!isDirectory(candidate)) continue;
    const dir = realPath(candidate);
    if (dir === '/' || dirs.includes(dir)) continue;
    if (writable.some((mount) => isWithin(dir, mount))) continue;
    dirs.push(dir);
  }
  return dirs;
}

/**
 * What a sandbox with `programs` shows: the selected ones (each must exist),
 * the `base` that is there (Choliba's own needs and the shell) and Choliba's
 * runtime. One mount per place: a program asked twice comes once.
 */
export function visiblePrograms(
  selected: readonly string[],
  searchPath: string | undefined,
  base: readonly string[],
): readonly FoundProgram[] {
  const runtime = programAt(runtimeExecutable());
  const programs = [
    ...requirePrograms(selected, searchPath),
    ...findPrograms(base, searchPath).found,
    ...(runtime === undefined ? [] : [runtime]),
  ];
  return programs.filter(
    (program, index) =>
      programs.findIndex((other) => other.path === program.path) === index,
  );
}
