import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * One page of `docs/`: its path from there (`guias/escrever-um-agente.md`), its title (its `# ` heading) and, for a
 * generated command page, its group and place in the reference (the `group` and `order` of its frontmatter).
 */
export interface DocPage {
  readonly file: string;
  readonly title: string;
  readonly group?: string;
  readonly order?: number;
}

export interface SidebarLink {
  readonly text: string;
  readonly link: string;
}

export interface SidebarSection {
  readonly text: string;
  /** Set for Comandos: the section heading opens the index, as `@yarnpkg/cli` opens the Yarn CLI reference. */
  readonly link?: string;
  readonly items: readonly SidebarLink[];
}

/** The sections of the site, by folder of `docs/` (`''` is the root), in the order the site shows them. */
const SECTIONS: readonly { readonly folder: string; readonly text: string }[] = [
  { folder: '', text: 'Começar' },
  { folder: 'guias', text: 'Guias' },
  { folder: 'comandos', text: 'Comandos' },
  { folder: 'referencia', text: 'Referência' },
];

/**
 * The pages of the root the sidebar leaves out: the index is the first page of the documentation (the Documentação
 * item), the home is the hero and the philosophy is in the footer. The command index is the Comandos heading.
 */
const OFF_SIDEBAR: ReadonlySet<string> = new Set(['README.md', 'index.md', 'filosofia.md', 'comandos/index.md']);

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
  const rank = (page: DocPage): number => {
    const index = order.indexOf(page.file);
    return page.order ?? (index === -1 ? order.length : index);
  };
  return SECTIONS.map(({ folder, text }) => {
    const inFolder = pages
      .filter((page) => path.posix.dirname(page.file) === (folder === '' ? '.' : folder))
      .filter((page) => !OFF_SIDEBAR.has(page.file))
      .toSorted((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file));
    return {
      text,
      ...(folder === 'comandos' ? { link: '/comandos/' } : {}),
      items: inFolder.map(link),
    };
  }).filter((section) => section.items.length > 0);
}

/** A page as a link: its title without the code marks, at its address (`choliba run`, not a nested group). */
function link(page: DocPage): SidebarLink {
  return {
    text: page.title.replaceAll('`', ''),
    link: `/${page.file.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')}`,
  };
}

/** The pages under `docsDir` (Markdown, outside `.vitepress/`), each with its `# ` heading as title. */
export function readDocPages(docsDir: string): readonly DocPage[] {
  return readdirSync(docsDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.md') && !file.startsWith('.vitepress'))
    .map((file) => {
      const text = readFileSync(path.join(docsDir, file), 'utf8');
      const heading = /^# (.+)$/m.exec(text);
      const group = /^group: (.+)$/m.exec(text)?.[1];
      const order = /^order: (\d+)$/m.exec(text)?.[1];
      return {
        file: file.split(path.sep).join('/'),
        title: heading?.[1]?.trim() ?? file,
        ...(group === undefined ? {} : { group }),
        ...(order === undefined ? {} : { order: Number(order) }),
      };
    });
}
