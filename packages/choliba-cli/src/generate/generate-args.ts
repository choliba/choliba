/** The words after `generate <type>` (or its alias `g <type>`), as typed: what a generate command reads. */
export function generateArgs(argv: readonly string[], type: string): readonly string[] {
  const at = argv.findIndex((word, index) => (word === 'generate' || word === 'g') && argv[index + 1] === type);
  return at === -1 ? [] : argv.slice(at + 2);
}
