import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `choliba-cli 0.0.1-dev.24+1a2b3c4`, from the package.json in `packageDir`: the release build writes the version
 * and, as build metadata, the commit; `(versão desconhecida)` when it cannot be read.
 */
export function versionLine(packageDir: string): string {
  const file = path.join(packageDir, 'package.json');
  const manifest: unknown = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  if (!isRecord(manifest) || typeof manifest['version'] !== 'string') return 'choliba-cli (versão desconhecida)\n';
  const gitHead = manifest['gitHead'];
  const build = typeof gitHead === 'string' ? `+${gitHead.slice(0, 7)}` : '';
  return `choliba-cli ${manifest['version']}${build}\n`;
}
