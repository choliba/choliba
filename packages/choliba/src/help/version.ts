import { findManifest, resourceStarts, versionLine, type PackageManifest } from '@choliba/core';

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

/** The version as `--version` shows it, without the name: `0.0.1-dev.62+27dbedb`. */
export function shownVersion(manifest: PackageManifest | undefined): string {
  return versionLine(PACKAGE_NAME, manifest).slice(PACKAGE_NAME.length + 1);
}
