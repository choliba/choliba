import { findManifest, resourceStarts, type PackageManifest } from '@choliba/core';

/** The package `--version` describes; its name skips any other package.json on the way (a test runner's). */
export const PACKAGE_NAME = 'choliba';

/**
 * choliba's own package.json, found up from the running script (the installed `bin/choliba.js`) and then from
 * `sourceDir`; `undefined` when neither leads to it.
 */
export function cholibaManifest(
  sourceDir: string = __dirname,
  argv: readonly string[] = process.argv,
): PackageManifest | undefined {
  return findManifest(PACKAGE_NAME, resourceStarts(sourceDir, argv));
}
