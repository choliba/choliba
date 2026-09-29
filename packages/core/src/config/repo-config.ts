import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILE } from './files';

/** Parses a `.env` file body into key/value pairs (no variable expansion). */
export function parseConfigFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

export function mergeConfig(
  fileConfig: Readonly<Record<string, string>>,
  processConfig: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return { ...fileConfig, ...processConfig };
}

export function loadRepoConfig(
  repoRoot: string,
  processConfig: Readonly<Record<string, string | undefined>> = process.env,
  readFile: (path: string) => string | undefined = readConfigFile,
): Readonly<Record<string, string | undefined>> {
  const content = readFile(join(repoRoot, ENV_FILE));
  if (content === undefined) {
    return { ...processConfig };
  }
  return mergeConfig(parseConfigFile(content), processConfig);
}

function readConfigFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf8');
}
