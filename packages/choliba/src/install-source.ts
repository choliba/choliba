import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';

import type { GitRunner } from '@choliba/core/git';
import { PACKAGE_FILE } from '@choliba/core/config';

/** Where an install comes from: a folder or file on disk, a git repository or an npm package. */
export type SourceKind = 'local' | 'git' | 'npm';

/** The source on disk, and how to remove what fetching it created (nothing, for a local one). */
export interface FetchedSource {
  readonly root: string;
  /**
   * How far up an agent's skills and MCPs are looked for: the clone or the package, or — for a folder on
   * disk, which may be one agent of a larger repository — the whole way up.
   */
  readonly searchUpTo: string;
  readonly cleanup: () => void;
}

export interface SourceDeps {
  /** Where the command runs: a relative local path counts from here. */
  readonly cwd: string;
  readonly git: GitRunner;
  /** `bun add <spec>` in `project`. */
  readonly bunAdd: (project: string, spec: string) => { readonly status: number | null; readonly stderr: string };
}

const GIT_ADDRESS = /^(https?:\/\/|git@|git:\/\/|ssh:\/\/|file:\/\/|github:)|\.git(#.*)?$/;

/** A folder or `.json` on disk is local; a repository address is git; anything else (a name, a `.tgz`) is npm. */
export function sourceKind(spec: string, exists: (path: string) => boolean): SourceKind {
  if (exists(spec) && !spec.endsWith('.tgz')) return 'local';
  return GIT_ADDRESS.test(spec) ? 'git' : 'npm';
}

function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), 'choliba-install-'));
}

function removing(dir: string): () => void {
  return () => {
    rmSync(dir, { recursive: true, force: true });
  };
}

/** `git clone --depth 1` of `spec` (`github:dono/repo` is GitHub's https address; `#ref` picks a branch or tag). */
function cloneGit(spec: string, deps: SourceDeps): FetchedSource {
  const hash = spec.indexOf('#');
  const address = hash === -1 ? spec : spec.slice(0, hash);
  const ref = hash === -1 ? '' : spec.slice(hash + 1);
  const url = address.startsWith('github:') ? `https://github.com/${address.slice('github:'.length)}.git` : address;
  const scratch = scratchDir();
  const root = join(scratch, 'repo');
  const result = deps.git.run(['clone', '--depth', '1', ...(ref ? ['--branch', ref] : []), url, root], scratch);
  if (result.status !== 0) {
    rmSync(scratch, { recursive: true, force: true });
    throw new Error(`git clone ${url} falhou: ${result.stderr.trim()}`);
  }
  return { root, searchUpTo: root, cleanup: removing(scratch) };
}

/** `bun add <spec>` in a scratch project; the source is the folder the package lands in. */
function addNpm(spec: string, deps: SourceDeps): FetchedSource {
  const scratch = scratchDir();
  writeFileSync(join(scratch, PACKAGE_FILE), '{ "name": "choliba-install", "private": true }\n');
  const result = deps.bunAdd(scratch, spec);
  if (result.status !== 0) {
    rmSync(scratch, { recursive: true, force: true });
    throw new Error(`bun add ${spec} falhou: ${result.stderr.trim()}`);
  }
  const manifest = JSON.parse(readFileSync(join(scratch, PACKAGE_FILE), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  // A spec that is a file or folder does not say the package's name: the scratch project does.
  const name = Object.keys(manifest.dependencies ?? {})[0] ?? spec;
  const root = join(scratch, 'node_modules', name);
  return { root, searchUpTo: root, cleanup: removing(scratch) };
}

/** Puts the source on disk; the caller runs `cleanup` when done, whatever happens. */
export function fetchSource(spec: string, deps: SourceDeps): FetchedSource {
  const exists = (path: string): boolean => existsSync(resolve(deps.cwd, path));
  const kind = sourceKind(spec, exists);
  if (kind === 'git') return cloneGit(spec, deps);
  if (kind === 'npm') return addNpm(spec, deps);
  const root = resolve(deps.cwd, spec);
  return { root, searchUpTo: parse(root).root, cleanup: () => undefined };
}
