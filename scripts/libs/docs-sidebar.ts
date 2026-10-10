import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** One page of `docs/`: its path from there (`guias/escrever-um-agente.md`) and its title (its `# ` heading). */
export interface DocPage {
  readonly file: string;
  readonly title: string;
}

export interface SidebarSection {
  readonly text: string;
  readonly items: readonly { readonly text: string; readonly link: string }[];
}

/** The sections of the site, by folder of `docs/` (`''` is the root), in the order the site shows them. */
const SECTIONS: readonly { readonly folder: string; readonly text: string }[] = [
  { folder: '', text: 'Começar' },
  { folder: 'guias', text: 'Guias' },
  { folder: 'referencia', text: 'Referência' },
];

/** The pages `readme` links to, in the order it links them (each once). */
function linkOrder(readme: string): readonly string[] {
  const links = [...readme.matchAll(/\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)].map((match) =>
    path.posix.normalize(match[1] ?? ''),
  );
  return [...new Set(links)];
}

/**
 * The site's sidebar: a section per folder of `docs/`, each page under it in the order `docs/README.md` (the
 * index) links them, then any page it does not link, by file name. A new page shows up without touching the
 * config; the index decides where. The title is the page's `# ` heading, without the code marks.
 */
export function buildSidebar(readme: string, pages: readonly DocPage[]): readonly SidebarSection[] {
  const order = linkOrder(readme);
  const rank = (file: string): number => {
    const index = order.indexOf(file);
    return index === -1 ? order.length : index;
  };
  return SECTIONS.map(({ folder, text }) => ({
    text,
    items: pages
      .filter((page) => path.posix.dirname(page.file) === (folder === '' ? '.' : folder))
      // The index is the first page of the documentation (the Documentação item) and the home is the
      // hero; neither is listed here.
      .filter((page) => page.file !== 'README.md' && page.file !== 'index.md')
      .toSorted((a, b) => rank(a.file) - rank(b.file) || a.file.localeCompare(b.file))
      .map((page) => ({ text: page.title.replaceAll('`', ''), link: `/${page.file.replace(/\.md$/, '')}` })),
  })).filter((section) => section.items.length > 0);
}

/** The pages under `docsDir` (Markdown, outside `.vitepress/`), each with its `# ` heading as title. */
export function readDocPages(docsDir: string): readonly DocPage[] {
  return readdirSync(docsDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.md') && !file.startsWith('.vitepress'))
    .map((file) => {
      const heading = /^# (.+)$/m.exec(readFileSync(path.join(docsDir, file), 'utf8'));
      return { file: file.split(path.sep).join('/'), title: heading?.[1]?.trim() ?? file };
    });
}
