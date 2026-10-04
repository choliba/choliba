/**
 * The arguments after the top-level `command` (the first word, which chose it), exactly as typed: for commands
 * that parse their own flags (`agents`, `tests`, `terminal run`), since the command-line parser reorders unknown
 * options and drops `--`. Everything when the first word is not `command` (the default command:
 * `choliba <agent>`).
 */
export function rawArgsAfter(argv: readonly string[], command: string): readonly string[] {
  return argv[0] === command ? argv.slice(1) : argv;
}
