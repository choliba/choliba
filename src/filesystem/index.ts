import {
  appendFileSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHOLIBA_CACHE_NAME, XDG_DEFAULTS } from './constants.ts';

/**
 * Disk access. Nothing else imports `node:fs`: what goes to the disk goes
 * through here, the same way processes go through `execute` and messages to
 * the user through `output`.
 */

/**
 * Path text (no disk access), from here too: nothing else imports
 * `node:path` either.
 */
export {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';

/**
 * The path of a file next to a module, from the module's `import.meta.url`:
 * `besideModule(import.meta.url, './hook-main.ts')`. Decoded, unlike a URL's
 * `pathname`, which keeps a space as `%20` and an accent as `%C3%81`, so a
 * project in "Área de Trabalho" is found.
 */
export function besideModule(moduleUrl: string, relativePath: string): string {
  return fileURLToPath(new URL(relativePath, moduleUrl));
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function isDirectory(path: string): boolean {
  return statSync(path).isDirectory();
}

export function isSymlink(path: string): boolean {
  return lstatSync(path).isSymbolicLink();
}

/** Last modification time, in milliseconds. */
export function modifiedAt(path: string): number {
  return statSync(path).mtimeMs;
}

/** Sets a file's modification time, in milliseconds (a copy keeps its age). */
export function setModifiedAt(path: string, ms: number): void {
  utimesSync(path, ms / 1000, ms / 1000);
}

/** Size of a file, in bytes. */
export function fileSize(path: string): number {
  return statSync(path).size;
}

/** A file's content as bytes (compressed files, binaries). */
export function readBytes(path: string): Uint8Array {
  return readFileSync(path);
}

export function writeBytes(
  path: string,
  content: Uint8Array,
  mode?: number,
): void {
  writeFileSync(path, content, mode === undefined ? {} : { mode });
}

export function readLink(path: string): string {
  return readlinkSync(path);
}

/** Absolute path with every symlink resolved. */
export function realPath(path: string): string {
  return realpathSync(path);
}

/**
 * `realPath` of a path that may not exist yet: the nearest existing
 * ancestor resolved, with the missing rest appended as written.
 */
export function realPathOfNearest(path: string): string {
  const missing: string[] = [];
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    missing.unshift(basename(current));
    current = parent;
  }
  return join(realpathSync(current), ...missing);
}

/** Whether `path` is `dir` or inside it, by the text of both (absolute). */
export function isWithin(path: string, dir: string): boolean {
  const fromDir = relative(dir, path);
  return (
    fromDir === '' ||
    (fromDir !== '..' && !fromDir.startsWith('../') && !isAbsolute(fromDir))
  );
}

export function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Everything readable from an open file descriptor, as text: `0` is stdin
 * (the request a hook receives, a piped input).
 */
export function readDescriptor(descriptor: number): string {
  return readFileSync(descriptor, 'utf8');
}

export function listDirectory(path: string): string[] {
  return readdirSync(path);
}

/** Whether `path` can be opened for reading by this process. */
export function canOpen(path: string): boolean {
  try {
    closeSync(openSync(path, 'r'));
    return true;
  } catch {
    return false;
  }
}

/** Creates the directory and its parents, if missing. */
export function ensureDirectory(path: string, mode?: number): void {
  mkdirSync(path, { recursive: true, ...(mode === undefined ? {} : { mode }) });
}

export function writeText(path: string, content: string, mode?: number): void {
  writeFileSync(path, content, mode === undefined ? {} : { mode });
}

/** `mode` applies when the file is created. */
export function appendText(path: string, content: string, mode?: number): void {
  appendFileSync(path, content, { mode });
}

export function createSymlink(target: string, path: string): void {
  symlinkSync(target, path);
}

/** Copies a directory tree into `to`, which is created if missing. */
export function copyDirectory(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
}

/** Removes a file or directory tree; missing paths are ignored. */
export function removePath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

/** An environment to read paths from: `environment()`, or one made by hand. */
type PathEnv = Readonly<Record<string, string | undefined>>;

/** The XDG base directories `xdgDir` knows. */
export type XdgDirName = keyof typeof XDG_DEFAULTS;

/** The user's home in `env`: its `HOME`, or the system's when unset. */
export function homeOf(env: PathEnv): string {
  return env['HOME'] ?? homedir();
}

/**
 * An XDG base directory in `env`: the variable, or its default under the
 * home (`homeOf`) when unset or empty, as the specification says.
 */
export function xdgDir(env: PathEnv, name: XdgDirName): string {
  const value = env[name];
  return value === undefined || value.length === 0
    ? join(homeOf(env), XDG_DEFAULTS[name])
    : value;
}

/**
 * Choliba's cache directory: `$XDG_CACHE_HOME/choliba`, or
 * `$HOME/.cache/choliba`, both read from `env` (`environment()`).
 */
export function cholibaCacheDir(env: PathEnv): string {
  return join(xdgDir(env, 'XDG_CACHE_HOME'), CHOLIBA_CACHE_NAME);
}
