/**
 * The arguments after the command `path` (`['projects', 'create-project']`), exactly as typed: commands read
 * their own flags from here, since the command-line parser reorders unknown options and drops `--`. Only the
 * leading words that match the path, in order, are dropped, so the default command (`choliba <agent>`, whose
 * name is not on the line) gets everything.
 */
export function rawArgsAfter(argv: readonly string[], ...path: readonly string[]): readonly string[] {
  let at = 0;
  while (at < path.length && argv[at] === path[at]) {
    at += 1;
  }
  return argv.slice(at);
}
