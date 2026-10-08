import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PACKAGE_FILE } from './files';

/** What `--version` reads from an app's own package.json: the release build writes `version` and `gitHead`. */
export interface PackageManifest {
  readonly version: string;
  readonly gitHead?: string;
}

function readJson(file: string): Readonly<Record<string, unknown>> {
  const value: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  return typeof value === 'object' && value !== null ? (value as Readonly<Record<string, unknown>>) : {};
}

/** The manifest of the package called `name` in the package.json of `dir` or of a folder above it. */
function manifestUp(name: string, dir: string): PackageManifest | undefined {
  const manifest = readJson(join(dir, PACKAGE_FILE));
  const version = manifest['version'];
  if (manifest['name'] === name && typeof version === 'string') {
    const gitHead = manifest['gitHead'];
    return { version, ...(typeof gitHead === 'string' ? { gitHead } : {}) };
  }
  const parent = join(dir, '..');
  return parent === dir ? undefined : manifestUp(name, parent);
}

/**
 * The manifest of the package called `name`, looked for up from each of `starts` in turn (the running script, the
 * package's sources…): the name skips any other package's package.json on the way. `undefined` when none leads to it.
 */
export function findManifest(name: string, starts: readonly string[]): PackageManifest | undefined {
  for (const start of starts) {
    const manifest = manifestUp(name, start);
    if (manifest !== undefined) return manifest;
  }
  return undefined;
}

/** `choliba 0.0.1-dev.16+1a2b3c4`: the SemVer version, with the commit it was built from as build metadata. */
export function versionLine(name: string, manifest: PackageManifest | undefined): string {
  if (manifest === undefined) return `${name} (versão desconhecida)`;
  const build = manifest.gitHead === undefined ? '' : `+${manifest.gitHead.slice(0, 7)}`;
  return `${name} ${manifest.version}${build}`;
}
