/** `-h`, `--help` or `help` as the first word: what makes a command print its help and do nothing else. */
export function wantsHelp(args: readonly string[]): boolean {
  return args[0] === 'help' || args.some((arg) => arg === '--help' || arg === '-h');
}
