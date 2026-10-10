import { githubSlug, outsideLink } from '../libs/docs-links';

const REPO = 'https://github.com/o/r';

describe('outsideLink', () => {
  it('sends a link that leaves docs/ to the file on GitHub, from any page depth', () => {
    expect(outsideLink('../PHILOSOPHY.md', 'README.md', REPO)).toBe(`${REPO}/blob/master/PHILOSOPHY.md`);
    expect(outsideLink('../../CONTRIBUTING.md', 'guias/x.md', REPO)).toBe(`${REPO}/blob/master/CONTRIBUTING.md`);
  });

  it('leaves alone a link inside docs/, an anchor, an absolute path and another site', () => {
    expect(outsideLink('../referencia/cli.md#a', 'guias/x.md', REPO)).toBeUndefined();
    expect(outsideLink('primeiros-passos.md', 'README.md', REPO)).toBeUndefined();
    expect(outsideLink('#secao', 'README.md', REPO)).toBeUndefined();
    expect(outsideLink('/guias/x', 'README.md', REPO)).toBeUndefined();
    expect(outsideLink('https://semver.org', 'README.md', REPO)).toBeUndefined();
  });
});

describe('githubSlug', () => {
  it('makes the anchors GitHub makes: lowercase, accents kept, punctuation out, spaces as hyphens', () => {
    expect(githubSlug('A aplicação do projeto')).toBe('a-aplicação-do-projeto');
    expect(githubSlug('O servidor do MCP `exemplo`')).toBe('o-servidor-do-mcp-exemplo');
    expect(githubSlug(' `${CHOL_ROOT}` ')).toBe('chol_root');
    expect(githubSlug('Do zero ao primeiro ticket!')).toBe('do-zero-ao-primeiro-ticket');
  });
});
