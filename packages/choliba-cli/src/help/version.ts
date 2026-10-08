import { findManifest, versionLine as formatVersion } from '@choliba/core';

/**
 * `choliba-cli 0.0.1-dev.24+1a2b3c4`, from the package.json in `packageDir`: the release build writes the version
 * and, as build metadata, the commit; `(versão desconhecida)` when it cannot be read.
 */
export function versionLine(packageDir: string): string {
  return `${formatVersion('choliba-cli', findManifest('choliba-cli', [packageDir]))}\n`;
}
