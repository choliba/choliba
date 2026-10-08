import type { CommandEntry, CommandSpec, FlagSpec, FlagValueSpec, Suggestions } from './interfaces/help.interface';

const NONE: Suggestions = { kind: 'values', values: [] };

/** Printed instead of a list when the shell should fall back to completing file names. */
export const FILES_MARKER = ':files';

function findFlag(flags: readonly FlagSpec[], word: string): FlagSpec | undefined {
  return flags.find((flag) => flag.name === word || (flag.aliases ?? []).includes(word));
}

function findCommand(entries: readonly CommandEntry[], word: string): CommandEntry | undefined {
  return entries.find((entry) => entry.name === word || (entry.asFlag === true && word === `--${entry.name}`));
}

/**
 * Suggestions for the last item of `words` (the word being typed, `''` right after a space),
 * given the words before it. Walks the words through `spec`: a known command descends into its
 * own spec, a flag that takes a value swallows the next word, anything else is a positional.
 */
export function complete(root: CommandSpec, words: readonly string[]): Suggestions {
  const typed = words.slice(0, -1);
  const current = words.at(-1) ?? '';

  let spec = root;
  let entries = spec.commands?.() ?? [];
  let used = new Set<string>();
  let positionals: string[] = [];
  let pendingValue: FlagValueSpec | undefined;
  let pendingFlag = '';
  let values = new Map<string, string>();

  for (const word of typed) {
    if (pendingValue !== undefined) {
      values.set(pendingFlag, word);
      pendingValue = undefined;
      continue;
    }
    const flag = findFlag(spec.flags ?? [], word);
    if (flag?.terminal === true) {
      return NONE;
    }
    if (flag !== undefined) {
      used.add(flag.name);
      pendingValue = flag.value;
      pendingFlag = flag.name;
      continue;
    }
    const entry = positionals.length === 0 ? findCommand(entries, word) : undefined;
    if (entry !== undefined) {
      spec = entry.spec;
      entries = spec.commands?.() ?? [];
      used = new Set();
      values = new Map();
      positionals = [];
      continue;
    }
    if (!word.startsWith('-')) {
      positionals.push(word);
    }
  }

  const byPrefix = (values: readonly string[]): Suggestions => ({
    kind: 'values',
    values: values.filter((value) => value.startsWith(current)),
  });

  if (pendingValue !== undefined) {
    const suggestions = pendingValue.suggest?.(values) ?? NONE;
    return suggestions.kind === 'files' ? suggestions : byPrefix(suggestions.values);
  }

  // Short aliases too (`-h`), so the prefix every suggestion shares — which bash types on its own —
  // is `-`, not `--`.
  const availableFlags = (spec.flags ?? [])
    .filter((flag) => flag.repeatable === true || !used.has(flag.name))
    .flatMap((flag) => [flag.name, ...(flag.aliases ?? [])]);

  if (current.startsWith('-')) {
    const commandFlags =
      positionals.length === 0
        ? entries.filter((entry) => entry.asFlag === true).map((entry) => `--${entry.name}`)
        : [];
    return byPrefix([...commandFlags, ...availableFlags]);
  }

  const commands = positionals.length === 0 ? entries.map((entry) => entry.name) : [];
  const positional = spec.positionals?.(positionals, current) ?? NONE;
  if (positional.kind === 'files') {
    return commands.length === 0 ? positional : byPrefix(commands);
  }
  const candidates = [...commands, ...positional.values];
  // Nothing else fits an empty word (e.g. a free-text task comes next): show the flags instead of nothing.
  if (candidates.length === 0 && current === '') {
    return byPrefix(availableFlags);
  }
  return byPrefix(candidates);
}

/**
 * One-line description of what `words` select: the deepest command they name (its summary as
 * listed by the parent), or the CLI's own description when they name none. Flags and other words
 * are skipped. This is what a CLI prints for `__describe`.
 */
export function describe(root: CommandSpec, words: readonly string[]): string {
  let spec = root;
  let description = root.description ?? '';
  for (const word of words) {
    const entry = findCommand(spec.commands?.() ?? [], word);
    if (entry !== undefined) {
      spec = entry.spec;
      description = entry.description;
    }
  }
  return description;
}

/** One suggestion per line, or `FILES_MARKER` — the format the bash completion script reads. */
export function formatSuggestions(suggestions: Suggestions): string {
  return suggestions.kind === 'files' ? FILES_MARKER : suggestions.values.join('\n');
}
