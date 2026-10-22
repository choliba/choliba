import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** Where cursor-agent keeps the socket of its worker when the path under `projects/` would not fit a unix socket. */
const SOCKET_FALLBACK_DIR = '/tmp/.cursor';
const SOCKET_BASE_MAX = 84;
const SOCKET_DIR_MAX = 92;

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() === '' ? undefined : value;
}

/** Cursor's name for a workspace under `projects/`: every run of non-alphanumerics becomes one `-`. */
export function cursorProjectSlug(workspace: string): string {
  return workspace
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dataDir(env: NodeJS.ProcessEnv, home: string): string {
  return nonEmpty(env['CURSOR_DATA_DIR']) ?? join(home, '.cursor');
}

function configDir(env: NodeJS.ProcessEnv, home: string): string {
  const xdg = nonEmpty(env['XDG_CONFIG_HOME']);
  return nonEmpty(env['CURSOR_CONFIG_DIR']) ?? (xdg === undefined ? join(home, '.cursor') : join(xdg, 'cursor'));
}

/** The folder of the worker's socket: the project folder, or a shortened name with a hash when it is too long. */
function socketDir(workspace: string, data: string): string {
  const projects = join(data, 'projects');
  const base = [projects, data].find((dir) => dir.length <= SOCKET_BASE_MAX) ?? SOCKET_FALLBACK_DIR;
  const dir = join(base, cursorProjectSlug(workspace));
  if (dir.length <= SOCKET_DIR_MAX) {
    return dir;
  }
  const hash = createHash('sha256').update(dir).digest('hex').substring(0, 7);
  return `${dir.substring(0, SOCKET_BASE_MAX)}-${hash}`;
}

/**
 * What cursor-agent keeps outside the workspace for each workspace it runs in, so for each run dir: the project
 * (trust, transcripts, worker log), the folder of the worker's socket and the chats. Mirrors the rules of
 * cursor-agent 2026.10.01 (`cursor-config/dist/paths.js`, `utils/dist/workspace-paths.js`, `src/state`).
 */
export function cursorStatePaths(
  workspace: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): readonly string[] {
  const data = dataDir(env, home);
  const chat = createHash('md5').update(resolve(workspace)).digest('hex');
  const paths = [
    join(data, 'projects', cursorProjectSlug(workspace)),
    socketDir(workspace, data),
    join(configDir(env, home), 'chats', chat),
  ];
  return [...new Set(paths)];
}

/**
 * Removes what cursor-agent kept for `workspace` (`cursorStatePaths`): each run has a folder of its own, so
 * nothing of it is used again, and left alone it would pile up in `~/.cursor`.
 */
export function clearCursorState(
  workspace: string,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): void {
  for (const path of cursorStatePaths(workspace, env, home)) {
    rmSync(path, { recursive: true, force: true });
  }
}
