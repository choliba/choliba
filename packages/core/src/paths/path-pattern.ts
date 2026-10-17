import { ExpectedError } from '../common';

/**
 * Path patterns: the one format every search of choliba uses, to find (`pattern`) and to skip (`ignore`).
 *
 * The format is gitignore's "PATTERN FORMAT" (https://git-scm.com/docs/gitignore); the pieces of a name (`*`, `?`,
 * `[...]`, `\`) follow POSIX fnmatch with FNM_PATHNAME and without FNM_PERIOD (IEEE Std 1003.1, Shell and Utilities
 * §2.13; https://www.man7.org/linux/man-pages/man3/fnmatch.3p.html). Paths are relative to the folder searched, with
 * `/`, and matching is case-sensitive. A pattern the format leaves unclear is refused instead of read as text.
 */

/** A list of patterns, compiled once: whether a path (a folder, or a file) is in it. */
export interface PathPatterns {
  /** True when the last pattern that matches `path`, or one of its folders, is not a `!` one. */
  readonly matches: (path: string, isDirectory: boolean) => boolean;
}

interface CompiledPattern {
  readonly negated: boolean;
  readonly directoryOnly: boolean;
  readonly regExp: RegExp;
}

/** The POSIX character classes a `[...]` may hold, as they read in a regular expression's class. */
const CHARACTER_CLASSES: Readonly<Record<string, string>> = {
  alnum: 'a-zA-Z0-9',
  alpha: 'a-zA-Z',
  blank: ' \\t',
  cntrl: '\\x00-\\x1f\\x7f',
  digit: '0-9',
  graph: '!-~',
  lower: 'a-z',
  print: ' -~',
  punct: '!-\\/:-@\\[-`{-~',
  space: '\\s',
  upper: 'A-Z',
  xdigit: '0-9A-Fa-f',
};

function invalid(pattern: string, reason: string): never {
  throw new ExpectedError(`padrão inválido "${pattern}": ${reason}`);
}

/** `char` as itself in a regular expression. */
function literal(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** A `[:name:]` inside a `[...]` starting at `at`: its class and where it ends; nothing when there is none. */
function characterClass(pattern: string, segment: string, at: number): { text: string; end: number } | undefined {
  if (!segment.startsWith('[:', at)) return undefined;
  const end = segment.indexOf(':]', at + 2);
  if (end === -1) return undefined;
  const name = segment.slice(at + 2, end);
  const text = CHARACTER_CLASSES[name];
  if (text === undefined) invalid(pattern, `a classe [:${name}:] não existe`);
  return { text, end: end + 2 };
}

/** The `[...]` of `segment` opened at `open`: a class that never matches `/`, and where it ends. */
function bracket(pattern: string, segment: string, open: number): { text: string; end: number } {
  let at = open + 1;
  const negated = segment[at] === '!' || segment[at] === '^';
  if (negated) at++;
  let text = '';
  for (let first = true; at < segment.length; first = false) {
    const char = segment.charAt(at);
    if (char === ']' && !first) return { text: `(?!/)[${negated ? '^' : ''}${text}]`, end: at + 1 };
    const named = characterClass(pattern, segment, at);
    if (named !== undefined) {
      text += named.text;
      at = named.end;
      continue;
    }
    const escaped = char === '\\' && at + 1 < segment.length;
    const value = escaped ? segment.charAt(at + 1) : char;
    text += value === '-' ? '-' : literal(value);
    at += escaped ? 2 : 1;
  }
  return invalid(pattern, 'um [ sem o ] que o fecha');
}

/** One name of a path (no `/` in it) as a regular expression: `*` and `?` never match `/`. */
function nameSource(pattern: string, segment: string): string {
  let source = '';
  for (let at = 0; at < segment.length;) {
    const char = segment.charAt(at);
    if (char === '*') {
      source += '[^/]*';
      while (segment[at] === '*') at++;
      continue;
    }
    if (char === '?') source += '[^/]';
    if (char === '[') {
      const part = bracket(pattern, segment, at);
      source += part.text;
      at = part.end;
      continue;
    }
    if (char === '\\') {
      if (at + 1 === segment.length) invalid(pattern, 'termina com \\ sem o caractere que ela escapa');
      source += literal(segment.charAt(at + 1));
      at += 2;
      continue;
    }
    if (char !== '?') source += literal(char);
    at++;
  }
  return source;
}

/** The names of `body` split at each `/` outside a `[...]`; a `/` inside one is refused, as it never matches. */
function segmentsOf(pattern: string, body: string): readonly string[] {
  const segments: string[] = [];
  let current = '';
  let inBracket = false;
  for (let at = 0; at < body.length; at++) {
    const char = body.charAt(at);
    if (char === '\\' && at + 1 < body.length) {
      current += body.slice(at, at + 2);
      at++;
      continue;
    }
    if (char === '[' && !inBracket) inBracket = true;
    else if (char === ']' && inBracket) inBracket = false;
    if (char === '/' && inBracket) invalid(pattern, 'um [...] não casa /');
    if (char === '/') {
      segments.push(current);
      current = '';
    } else current += char;
  }
  segments.push(current);
  if (segments.includes('')) invalid(pattern, 'tem // ou um nome vazio');
  return segments;
}

/** The names as one regular expression: `**` alone in a name is any number of folders. */
function pathSource(pattern: string, segments: readonly string[]): string {
  let source = '';
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') {
      if (index === 0) source += last ? '.+' : '(?:.*/)?';
      else source += last ? '/.+' : '/(?:.*/)?';
      return;
    }
    const afterGlobstar = index > 0 && segments[index - 1] === '**';
    source += (index === 0 || afterGlobstar ? '' : '/') + nameSource(pattern, segment);
  });
  return source;
}

/** The text of `pattern` once its unescaped trailing spaces are gone, as gitignore reads them. */
function withoutTrailingSpaces(pattern: string): string {
  let end = pattern.length;
  while (end > 0 && pattern[end - 1] === ' ' && pattern[end - 2] !== '\\') end--;
  return pattern.slice(0, end);
}

function compilePattern(pattern: string): CompiledPattern {
  const text = withoutTrailingSpaces(pattern);
  if (text === '') invalid(pattern, 'está vazio');
  if (text.startsWith('#'))
    invalid(pattern, 'começa com #, que no formato é um comentário; escreva \\# para o caractere');
  const negated = text.startsWith('!');
  const unnegated = negated ? text.slice(1) : text;
  const directoryOnly = unnegated.endsWith('/') && !unnegated.endsWith('\\/');
  const trimmed = directoryOnly ? unnegated.slice(0, -1) : unnegated;
  // A `/` at the start or in the middle ties the pattern to the folder searched; without one, it is a name anywhere.
  const anchored = trimmed.includes('/');
  const body = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (body === '') invalid(pattern, 'não tem nome');
  const source = pathSource(pattern, segmentsOf(pattern, body));
  return { negated, directoryOnly, regExp: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${source}$`) };
}

/** Whether `patterns` say `path` is in: `undefined` when none matches it, so the decision falls to its folders. */
function decide(patterns: readonly CompiledPattern[], path: string, isDirectory: boolean): boolean | undefined {
  const last = patterns.findLast((pattern) => (isDirectory || !pattern.directoryOnly) && pattern.regExp.test(path));
  return last === undefined ? undefined : !last.negated;
}

/**
 * `patterns` compiled once, in the format above. As in gitignore, the last pattern that matches a path decides,
 * and a path whose folder is in the list is in it too: a `!` cannot take a file out of a folder that is in.
 * A pattern outside the format throws `ExpectedError`, naming it and why.
 */
export function compilePathPatterns(patterns: readonly string[]): PathPatterns {
  const compiled = patterns.map(compilePattern);
  return {
    matches: (path, isDirectory) => {
      const names = path.split('/');
      for (let depth = 1; depth < names.length; depth++) {
        if (decide(compiled, names.slice(0, depth).join('/'), true) === true) return true;
      }
      return decide(compiled, path, isDirectory) === true;
    },
  };
}

/** Why `pattern` is outside the format, or `undefined` when it is a valid path pattern. */
export function pathPatternError(pattern: string): string | undefined {
  try {
    compilePattern(pattern);
    return undefined;
  } catch (error) {
    // compilePattern throws only ExpectedError, from `invalid`.
    return (error as ExpectedError).message;
  }
}
