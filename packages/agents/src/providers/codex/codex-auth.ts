import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { ExpectedError } from '@choliba/core';

const AUTH_FILE = 'auth.json';

export class CodexAuthenticationError extends ExpectedError {}

/** The user's Codex home, where `codex login` keeps its authentication. */
export function userCodexHome(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const configured = env['CODEX_HOME'];
  return configured === undefined || configured.trim() === '' ? join(home, '.codex') : configured;
}

/** The isolated Codex home for one run. It disappears with the run directory. */
export function runCodexHome(runDir: string): string {
  return join(runDir, '.codex');
}

/** Copies only the login created by `codex login`, never the user's config, history, plugins or skills. */
export function prepareCodexAuthentication(runDir: string, sourceHome: string = userCodexHome()): () => void {
  const source = join(sourceHome, AUTH_FILE);
  if (!existsSync(source)) {
    throw new CodexAuthenticationError(
      `O provider codex precisa de uma sessão autenticada: rode \`codex login\` (${source} não existe).`,
    );
  }
  const targetHome = runCodexHome(runDir);
  mkdirSync(targetHome, { recursive: true });
  const target = join(targetHome, AUTH_FILE);
  copyFileSync(source, target);
  chmodSync(target, 0o600);
  return () => {
    // The run directory owns the copy and `runAgent` removes it after every outcome.
  };
}
