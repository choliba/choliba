/** Where choliba's documentation is published. */
export const DOCS_URL = 'https://choliba.github.io';

/** A word of a command (`run`, `agent`, `terminal`), as opposed to an argument (`AGENT`, `[OPTIONS]`, `<origem>`). */
const COMMAND_WORD = /^[a-z][a-z-]*$/;

/**
 * Verbs whose next word is a type (`run agent`, `list projects`, `new project`). The type is documented on the
 * verb's page, so `choliba run agent` points at `comandos/run`.
 */
const TYPE_VERBS = new Set(['run', 'new', 'list']);

/**
 * The words of the `choliba` command a usage names (`choliba run agent AGENT …` → `run`, `agent`), up to its first
 * argument; `undefined` for a usage of another program (a script of the repository).
 */
export function commandWords(usage: string): readonly string[] | undefined {
  const [program, ...rest] = usage.split(' ');
  if (program !== 'choliba') return undefined;
  const end = rest.findIndex((word) => !COMMAND_WORD.test(word));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The page of the command reference a usage documents, from the documentation's root: `comandos/run` for a verb,
 * `comandos/terminal-run` for a command of several words, `comandos/` for the root; `undefined` for another program.
 */
export function commandPage(usage: string): string | undefined {
  const words = commandWords(usage);
  if (words === undefined) return undefined;
  const [head, ...rest] = words;
  if (head === undefined) return 'comandos/';
  const page = TYPE_VERBS.has(head) ? [head] : [head, ...rest];
  return `comandos/${page.join('-')}`;
}
