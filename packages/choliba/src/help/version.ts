import { findManifest, resourceStarts, shippedDir, versionLine, type PackageManifest } from '@choliba/kernel';

/** The package `--version` describes; its name skips any other package.json on the way (a test runner's). */
export const PACKAGE_NAME = 'choliba';

/**
 * choliba's own package.json, found up from the running script (the installed `bin/choliba.js`) and then from
 * `sourceDir`; `undefined` when neither leads to it. Bundled, `sourceDir` is frozen to where it was built, so the
 * directory the bundle loaded takes its place: imported by another tool (`openCholiba` in a Vite plugin), the running
 * script is that tool's and only the loaded file still leads to the package.
 */
export function cholibaManifest(
  sourceDir: string = __dirname,
  argv: readonly string[] = process.argv,
): PackageManifest | undefined {
  return findManifest(PACKAGE_NAME, resourceStarts(shippedDir() ?? sourceDir, argv));
}

/** The version as `--version` shows it, without the name: `0.0.1-dev.62+27dbedb`. */
export function shownVersion(manifest: PackageManifest | undefined): string {
  return versionLine(PACKAGE_NAME, manifest).slice(PACKAGE_NAME.length + 1);
}
