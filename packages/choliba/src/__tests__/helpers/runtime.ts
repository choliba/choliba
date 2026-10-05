import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CapturedRun, Runtime } from '../../runtime/interfaces/runtime.interface';

/** A command the runtime was asked to run, and where. */
export interface RecordedRun {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface FakeRuntime extends Runtime {
  readonly runs: RecordedRun[];
  readonly detached: { readonly command: readonly string[]; readonly cwd: string }[];
  readonly terminal: string[];
}

const SRC = join(__dirname, '..', '..');

/**
 * A `Runtime` that resolves dependencies as the package itself would (from `src/`), and records what it
 * would run instead of running it: exit code `status` for each run, `captured` for each capture.
 */
export function fakeRuntime(
  overrides: Partial<Runtime> & { status?: number; captured?: CapturedRun; tty?: boolean } = {},
): FakeRuntime {
  const runs: RecordedRun[] = [];
  const detached: { command: readonly string[]; cwd: string }[] = [];
  const terminal: string[] = [];
  const { status = 0, captured = { status: 0, stderr: '' }, tty = false, ...rest } = overrides;
  return {
    entryDir: SRC,
    script: '/bin/choliba.js',
    execPath: '/usr/bin/bun',
    home: '/home/ninguem',
    resolve: (specifier) => require.resolve(specifier, { paths: [SRC] }),
    run: (command, args, cwd, env) => {
      runs.push({ command, args, cwd, ...(env === undefined ? {} : { env }) });
      return status;
    },
    capture: (command, args, cwd) => {
      runs.push({ command, args, cwd });
      return captured;
    },
    spawnDetached: (command, cwd) => {
      detached.push({ command, cwd });
    },
    sleep: () => Promise.resolve(),
    writeTerminal: (text) => {
      if (tty) terminal.push(text);
      return tty;
    },
    ...rest,
    runs,
    detached,
    terminal,
  };
}

/** A temp workspace (its package.json depends on choliba) with `files`, relative to its root. */
export async function withWorkspace(
  fn: (root: string) => Promise<void>,
  files: Readonly<Record<string, string>> = {},
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'choliba-cmd-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(join(root, relative, '..'), { recursive: true });
    writeFileSync(join(root, relative), content);
  }
  try {
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A temp folder that is no workspace. */
export async function withFolder(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'choliba-outside-'));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
