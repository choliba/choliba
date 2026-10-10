import { frontmatterPage } from './docs-home';

/**
 * A link of a file at the repository root as seen from `docs/`: `docs/referencia/x.md` becomes `referencia/x.md`,
 * any other relative path goes up a folder (`../CONTRIBUTING.md`, which the site sends to GitHub). An anchor, an
 * absolute path or another site stays as it is.
 */
function fromDocs(href: string): string {
  if (/^[a-z]+:|^#|^\//i.test(href)) return href;
  return href.startsWith('docs/') ? href.slice('docs/'.length) : `../${href}`;
}

/**
 * A Markdown file of the repository root (`PHILOSOPHY.md`) as a page of `docs/`: its links fixed to the new folder,
 * without the `---` between sections (the site already draws a line above each `## `), and a frontmatter with
 * `description`, for a file whose quote under the title is not one, and no previous or next page, since the page is
 * outside the sequence of the documentation, nor a link to edit it, since GitHub has no file at its path.
 */
export function rootPage(markdown: string, description: string): string {
  const body = markdown
    .replace(/\]\(([^)\s]+)\)/g, (_link, href: string) => `](${fromDocs(href)})`)
    .replace(/\n---\n\n/g, '\n');
  return `${frontmatterPage({ description, prev: false, next: false, editLink: false })}\n${body}`;
}
