import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PACKAGE_FILE, resourceStarts } from '@choliba/core/config';

/** What `--version` reads from choliba's own package.json: the release build writes `version` and `gitHead`. */
export interface CholibaManifest {
  readonly version: string;
  readonly gitHead?: string;
}

/** Looked for in the package.json up from each place, so the one of another package (a test runner's) is skipped. */
const NAME = 'choliba';

function readManifest(file: string): Readonly<Record<string, unknown>> {
  return JSON.parse(readFileSync(file, 'utf8')) as Readonly<Record<string, unknown>>;
}

function manifestUp(start: string): CholibaManifest | undefined {
  for (let dir = start; ; dir = join(dir, '..')) {
    const file = join(dir, PACKAGE_FILE);
    const manifest = existsSync(file) ? readManifest(file) : {};
    if (manifest['name'] === NAME && typeof manifest['version'] === 'string') {
      const gitHead = manifest['gitHead'];
      return { version: manifest['version'], ...(typeof gitHead === 'string' ? { gitHead } : {}) };
    }
    if (join(dir, '..') === dir) return undefined;
  }
}

/**
 * choliba's own package.json, found up from the running script (the installed `bin/choliba.js`) and then from
 * `sourceDir`; `undefined` when neither leads to it.
 */
export function cholibaManifest(
  sourceDir: string = __dirname,
  argv: readonly string[] = process.argv,
): CholibaManifest | undefined {
  for (const start of resourceStarts(sourceDir, argv)) {
    const manifest = manifestUp(start);
    if (manifest !== undefined) return manifest;
  }
  return undefined;
}

/** `choliba 0.0.1-dev.16+1a2b3c4`: the SemVer version, with the commit it was built from as build metadata. */
export function versionLine(manifest: CholibaManifest | undefined): string {
  if (manifest === undefined) return `${NAME} (versão desconhecida)\n`;
  const build = manifest.gitHead === undefined ? '' : `+${manifest.gitHead.slice(0, 7)}`;
  return `${NAME} ${manifest.version}${build}\n`;
}
