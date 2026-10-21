import { ExpectedError } from '../../common/index';
import { compilePathPatterns, pathPatternError } from '../../paths/index';

/** Whether the one `pattern` takes in the file (or, with `isDirectory`, the folder) `path`. */
function matches(pattern: string, path: string, isDirectory = false): boolean {
  return compilePathPatterns([pattern]).matches(path, isDirectory);
}

describe('compilePathPatterns', () => {
  it('reads a pattern without / as a name at any depth, and one with / as a path from the folder searched', () => {
    expect(matches('package.json', 'package.json')).toBe(true);
    expect(matches('package.json', 'app/package.json')).toBe(true);
    expect(matches('package.json', 'packageXjson')).toBe(false);
    expect(matches('/package.json', 'package.json')).toBe(true);
    expect(matches('/package.json', 'app/package.json')).toBe(false);
    expect(matches('docs/api', 'docs/api')).toBe(true);
    expect(matches('docs/api', 'x/docs/api')).toBe(false);
  });

  it('reads * and ? as fnmatch with FNM_PATHNAME: never across a /, and * takes a leading dot', () => {
    expect(matches('*.png', 'img/a.png')).toBe(true);
    expect(matches('*.png', 'a.png.bak')).toBe(false);
    expect(matches('src/*.ts', 'src/a.ts')).toBe(true);
    expect(matches('src/*.ts', 'src/deep/a.ts')).toBe(false);
    expect(matches('Dockerfile?', 'Dockerfile8')).toBe(true);
    expect(matches('a?b', 'a/b')).toBe(false);
    expect(matches('*', '.env')).toBe(true);
    expect(matches('a**b', 'axyb')).toBe(true);
  });

  it('reads ** alone in a name as any number of folders', () => {
    expect(matches('**/*.ts', 'a.ts')).toBe(true);
    expect(matches('**/*.ts', 'src/deep/a.ts')).toBe(true);
    expect(matches('src/**', 'src/a/b.ts')).toBe(true);
    expect(matches('src/**', 'src', true)).toBe(false);
    expect(matches('a/**/b', 'a/b')).toBe(true);
    expect(matches('a/**/b', 'a/x/y/b')).toBe(true);
    expect(matches('**', 'anything/at/all')).toBe(true);
  });

  it('reads [...] as a class of one character, with [!...], [^...], ranges and [:name:], never matching /', () => {
    expect(matches('file[0-9].txt', 'file7.txt')).toBe(true);
    expect(matches('file[!0-9].txt', 'file7.txt')).toBe(false);
    expect(matches('file[^0-9].txt', 'fileA.txt')).toBe(true);
    expect(matches('[]a]', ']')).toBe(true);
    expect(matches('[a-]', '-')).toBe(true);
    expect(matches('v[[:digit:]]', 'v2')).toBe(true);
    expect(matches('[\\]]', ']')).toBe(true);
    expect(matches('[[:x]', ':')).toBe(true);
    expect(matches('a[!x]b', 'a/b')).toBe(false);
  });

  it('takes the character after \\ as it is, and trailing spaces off unless escaped', () => {
    expect(matches('\\*.md', '*.md')).toBe(true);
    expect(matches('\\*.md', 'a.md')).toBe(false);
    expect(matches('\\!keep', '!keep')).toBe(true);
    expect(matches('\\#x', '#x')).toBe(true);
    expect(matches('a+(b)', 'a+(b)')).toBe(true);
    expect(matches('name  ', 'name')).toBe(true);
    expect(matches('name\\ ', 'name ')).toBe(true);
  });

  it('keeps a pattern ending in / to folders, and takes in all under a folder it takes in', () => {
    expect(matches('tests/', 'tests', true)).toBe(true);
    expect(matches('tests/', 'tests')).toBe(false);
    expect(matches('tests/', 'app/tests/a.php')).toBe(true);
    expect(matches('vendor', 'vendor/x/y.php')).toBe(true);
  });

  it('lets the last pattern that matches decide, and a ! cannot take a file out of a folder that is in', () => {
    const patterns = compilePathPatterns(['*.log', '!keep.log', 'lib/', '!lib/keep.php']);

    expect(patterns.matches('a.log', false)).toBe(true);
    expect(patterns.matches('keep.log', false)).toBe(false);
    expect(patterns.matches('lib/keep.php', false)).toBe(true);
    expect(patterns.matches('src/a.ts', false)).toBe(false);
    expect(compilePathPatterns([]).matches('a', false)).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(matches('README.md', 'readme.md')).toBe(false);
  });

  it('refuses a pattern outside the format, with ExpectedError', () => {
    expect(() => compilePathPatterns(['ok', '[a-z'])).toThrow(ExpectedError);
  });
});

describe('pathPatternError', () => {
  it('says why a pattern is outside the format, and nothing for a valid one', () => {
    expect(pathPatternError('**/*.php')).toBeUndefined();
    expect(pathPatternError('')).toBe('padrão inválido "": está vazio');
    expect(pathPatternError('   ')).toBe('padrão inválido "   ": está vazio');
    expect(pathPatternError('#x')).toContain('é um comentário');
    expect(pathPatternError('[a-z')).toContain('um [ sem o ] que o fecha');
    expect(pathPatternError('[[:word:]]')).toContain('a classe [:word:] não existe');
    expect(pathPatternError('[a/b]')).toContain('um [...] não casa /');
    expect(pathPatternError('a\\')).toContain('termina com \\');
    expect(pathPatternError('a//b')).toContain('tem // ou um nome vazio');
    expect(pathPatternError('/')).toContain('não tem nome');
    expect(pathPatternError('!')).toContain('não tem nome');
  });
});
