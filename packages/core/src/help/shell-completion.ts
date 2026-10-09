import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { COMPLETION_BASH } from './completion-bash';

/** Commands the shell runs while completing: they must not rewrite `~/.bashrc`. */
const QUIET_COMMANDS = new Set(['__complete', '__describe', '__entries']);

/** Where the completion script lives: one place for every workspace and for the machine command. */
export function completionFile(home: string): string {
  return join(home, '.local', 'share', 'choliba', 'completion.bash');
}

/** The ~/.bashrc line that loads it; checking the file first keeps a new terminal quiet if it is ever removed. */
export function completionSourceLine(home: string): string {
  const file = completionFile(home);
  return `if [ -f "${file}" ]; then source "${file}"; fi`;
}

/** True when the script is on disk and ~/.bashrc already loads it. */
export function shellCompletionInstalled(home: string): boolean {
  const file = completionFile(home);
  const bashrc = join(home, '.bashrc');
  return existsSync(file) && existsSync(bashrc) && readFileSync(bashrc, 'utf8').includes(file);
}

/**
 * Writes the script (always, so an upgrade refreshes it) and adds the ~/.bashrc line once.
 * Returns the message `choliba setup` prints.
 */
export function installShellCompletion(home: string): string {
  const file = completionFile(home);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, COMPLETION_BASH);

  const bashrc = join(home, '.bashrc');
  const line = completionSourceLine(home);
  // Any line mentioning the script counts, so a line written by an older setup is not duplicated.
  const present = existsSync(bashrc) && readFileSync(bashrc, 'utf8').includes(file);
  if (!present) {
    appendFileSync(bashrc, `\n# Autocomplete do choliba\n${line}\n`);
  }
  const status = present ? 'já estava ligado' : 'ligado';
  return `Autocomplete ${status} no ~/.bashrc: abra um terminal novo (ou rode \`source ~/.bashrc\`).`;
}

/** True when the script on disk is this version, not one an older `choliba setup` left behind. */
function shellCompletionCurrent(home: string): boolean {
  const file = completionFile(home);
  return existsSync(file) && readFileSync(file, 'utf8') === COMPLETION_BASH;
}

/**
 * On a normal run of the machine command, installs completion when the script is missing or stale, or
 * the ~/.bashrc line is missing, and says so. Says nothing when this version is already on.
 * `__complete`, `__describe` and `__entries` never install: Tab must not rewrite `~/.bashrc`.
 */
export function ensureShellCompletion(
  home: string,
  argv: readonly string[],
  stderr: { write(chunk: string): void },
): void {
  const [first] = argv;
  if (first !== undefined && QUIET_COMMANDS.has(first)) return;
  if (shellCompletionInstalled(home) && shellCompletionCurrent(home)) return;
  stderr.write(`${installShellCompletion(home)}\n`);
}
