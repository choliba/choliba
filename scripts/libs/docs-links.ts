import path from 'node:path';

/** The files of the repository root that the site also publishes, by the page they become there. */
const SITE_PAGES: Readonly<Record<string, string>> = { 'PHILOSOPHY.md': '/filosofia' };

/**
 * A link of a page of `docs/` that leaves the folder (`../PHILOSOPHY.md` from the index), as the file on GitHub at
 * `repository/blob/master/`: the site only has the documentation, and the same Markdown keeps working when read on
 * GitHub. A file the site publishes too (`SITE_PAGES`) goes to its page on the site. `undefined` for any other link
 * (inside `docs/`, absolute, an anchor or another site).
 */
export function outsideLink(href: string, page: string, repository: string): string | undefined {
  if (/^[a-z]+:|^#|^\//i.test(href)) return undefined;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), href));
  if (!resolved.startsWith('../')) return undefined;
  const file = resolved.slice('../'.length);
  return SITE_PAGES[file] ?? `${repository}/blob/master/${file}`;
}

/**
 * A heading's anchor as GitHub makes it (`A aplicação do projeto` → `a-aplicação-do-projeto`): lowercase, accents
 * kept, punctuation dropped, each space a hyphen. The site uses the same, so a link like `comandos.md#variáveis` works
 * both on GitHub and on the site.
 */
export function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}
