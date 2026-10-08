import { fail } from './tests-error';

/** What `choliba tests` was asked to run: `project[:ticket][/path]`, as typed. */
export interface TestsTarget {
  readonly project: string;
  /** The ticket selector as typed: one ticket, a list, a glob or a range; empty for the whole project. */
  readonly rawTicket: string;
  /** `/tests/a.spec.ts` of `demo/tests/a.spec.ts`; empty without a path. */
  readonly pathSuffix: string;
  /** How many words of the command line the target took (a list may span several). */
  readonly consumedArgs: number;
}

/** `T-01 - 02` typed with spaces around the dash of a range: the three words are one selector. */
function isSpacedRange(argv: readonly string[]): boolean {
  const third = argv[2];
  return argv.length >= 3 && argv[1] === '-' && third !== undefined && !third.startsWith('-') && !third.includes('/');
}

/** Whether `arg` still belongs to a ticket list typed with spaces after its commas. */
function continuesList(arg: string | undefined): arg is string {
  return (
    arg !== undefined &&
    arg !== '' &&
    !arg.startsWith('--') &&
    !(arg.startsWith('-') && arg !== '-') &&
    !arg.includes('/')
  );
}

/** A list typed as `T-01, T-02` (with spaces): its words joined back, and how many words it took. */
function joinList(argv: readonly string[], typed: string): { readonly rawTicket: string; readonly consumed: number } {
  let rawTicket = typed;
  let index = /,\s*$/.test(rawTicket) ? 1 : 2;
  for (let arg = argv[index]; continuesList(arg); arg = argv[index]) {
    rawTicket = rawTicket.endsWith(',') ? `${rawTicket}${arg}` : `${rawTicket},${arg}`;
    index += 1;
  }
  return { rawTicket, consumed: index };
}

/** The ticket selector of the target, joining the words a range or a list was typed across. */
function ticketSelector(
  argv: readonly string[],
  typed: string,
): { readonly rawTicket: string; readonly consumed: number } {
  if (isSpacedRange(argv)) return { rawTicket: `${typed} - ${String(argv[2])}`, consumed: 3 };
  if (typed.includes(',')) return joinList(argv, typed);
  return { rawTicket: typed, consumed: 1 };
}

/** The text before the first `separator` of `text`, and the text after it (empty without one). */
function splitAt(text: string, separator: string): readonly [string, string] {
  const at = text.indexOf(separator);
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + separator.length)];
}

/**
 * The target `argv` starts with (`target`, its first word); throws, saying how to write it, when it is not
 * one.
 */
export function parseTestsTarget(target: string, argv: readonly string[]): TestsTarget {
  const slashIndex = target.indexOf('/');
  const firstSegment = slashIndex === -1 ? target : target.slice(0, slashIndex);
  const pathSuffix = slashIndex === -1 ? '' : target.slice(slashIndex);
  const [project, afterColon] = splitAt(firstSegment, ':');
  const [typedTicket] = splitAt(afterColon, ':');
  const { rawTicket, consumed } = ticketSelector(argv, typedTicket);

  const next = argv[1];
  if (!rawTicket && next && !next.startsWith('-') && next.startsWith(`${project}-`)) {
    fail(
      `erro: "${project} ${next}" parece projeto e ticket separados por espaço — use ":" (ex.: ${project}:${next}).`,
    );
  }
  if (!project) {
    fail('erro: informe um projeto (ex.: demo, demo:T-01 ou demo/tests/a.spec.ts).');
  }
  return { project, rawTicket, pathSuffix, consumedArgs: consumed };
}
