/** The flags every choliba command takes, read once before any command parses its own arguments. */
export interface GlobalFlags {
  /** The command line without them. */
  readonly argv: readonly string[];
  readonly noColorFlag: boolean;
}

/**
 * Takes `--no-color` out of the command line, wherever it is before `--` (what follows `--` belongs to the
 * command being run, as in `terminal run … -- tool --no-color`).
 */
export function takeGlobalFlags(argv: readonly string[]): GlobalFlags {
  const end = argv.indexOf('--');
  const head = end === -1 ? argv : argv.slice(0, end);
  const tail = end === -1 ? [] : argv.slice(end);
  const kept = head.filter((arg) => arg !== '--no-color');
  return { argv: [...kept, ...tail], noColorFlag: kept.length !== head.length };
}
