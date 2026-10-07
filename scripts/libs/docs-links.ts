import path from 'node:path';

/**
 * A link of a page of `docs/` that leaves the folder (`../PHILOSOPHY.md` from the index), as the file on GitHub at
 * `repository/blob/master/`: the site only has the documentation, and the same Markdown keeps working when read on
 * GitHub. `undefined` for any other link (inside `docs/`, absolute, an anchor or another site).
 */
export function outsideLink(href: string, page: string, repository: string): string | undefined {
  if (/^[a-z]+:|^#|^\//i.test(href)) return undefined;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), href));
  return resolved.startsWith('../') ? `${repository}/blob/master/${resolved.slice('../'.length)}` : undefined;
}

/**
 * A heading's anchor as GitHub makes it (`A aplicação do projeto` → `a-aplicação-do-projeto`): lowercase, accents
 * kept, punctuation dropped, each space a hyphen. The site uses the same, so a link like `cli.md#variáveis` works
 * both on GitHub and on the site.
 */
export function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}
