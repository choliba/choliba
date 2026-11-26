/**
 * The pages of the site (https://choliba.github.io/), built from what the
 * repository already says: the course of each module (`guides/<module>/README.md`)
 * and the commands (`src/cli/commands.ts`). Pure text in, text out: the
 * command that writes them is scripts/docs-pages.ts.
 */

import { join } from '../src/filesystem/index';

/** Where the repository is on GitHub: what a page links to when the target is not a page of the site. */
export const REPOSITORY_URL = 'https://github.com/choliba/choliba';
/** The branch those links point to: the released one. */
const SOURCE_BRANCH = 'master';
/** The frontmatter of a generated page with no source of its own to edit: VitePress then shows no edit link. */
const NO_EDIT_LINK = ['---', 'editLink: false', '---', ''];

/**
 * Where a page's "Editar esta página no GitHub" leads (the `editLink.pattern`
 * of the site). A course page is generated from its module's README, so the
 * link edits that file; any other page is a file in `docs/`. The two generated
 * pages with no file of their own, the index of the courses and the commands,
 * have no link at all.
 *
 * VitePress runs this function in the browser, rebuilt from its source: it
 * must use nothing from outside it, so the repository and the branch are
 * written here.
 */
export function editLinkOf({
  filePath,
}: {
  readonly filePath: string;
}): string {
  const repository = 'https://github.com/choliba/choliba';
  // Every change reaches develop by a pull request.
  const branch = 'develop';
  const course = /^guias\/(?!index\.md$)([^/]+)\.md$/.exec(filePath)?.[1];
  const source =
    course === undefined ? `docs/${filePath}` : `guides/${course}/README.md`;
  return `${repository}/edit/${branch}/${source}`;
}

/** What GitHub drops from a heading to make its id: everything but letters, marks, digits, `_`, `-` and spaces. */
const NOT_IN_SLUG = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;

/**
 * The id GitHub gives a heading (the `markdown.anchor.slugify` of the site),
 * so the index of a course leads to the same place on GitHub and on the site:
 * lower case, without punctuation, with the accents and the leading number
 * kept, each space a hyphen. The anchor plugin adds `-1`, `-2`… to a repeated
 * heading, as GitHub does.
 */
export function githubSlug(heading: string): string {
  return heading.toLowerCase().replace(NOT_IN_SLUG, '').replaceAll(' ', '-');
}

export interface Guide {
  /** The module: the folder in `guides/` and the name of the page. */
  readonly module: string;
  /** The course, as written in `guides/<module>/README.md`. */
  readonly markdown: string;
}

export interface SidebarItem {
  readonly text: string;
  readonly link: string;
}

/** The text of the first `# ` heading, or the module's name when the course has none. */
export function guideTitle(guide: Guide): string {
  const heading = /^# (.+)$/m.exec(guide.markdown)?.[1];
  return heading === undefined ? guide.module : heading.trim();
}

/** A link target that leaves the page: not an anchor, not an absolute URL. */
function isRelative(target: string): boolean {
  return !target.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

/** Where a relative link of a course goes in the site: the other course's page, or the file on GitHub. */
function rewriteTarget(module: string, target: string): string {
  const hash = target.indexOf('#');
  const path = hash < 0 ? target : target.slice(0, hash);
  const suffix = hash < 0 ? '' : target.slice(hash);
  const resolved = join('guides', module, path);
  const course = /^guides\/([^/]+)\/README\.md$/.exec(resolved)?.[1];
  if (course !== undefined) return `./${course}.md${suffix}`;
  const kind = path.endsWith('/') ? 'tree' : 'blob';
  return `${REPOSITORY_URL}/${kind}/${SOURCE_BRANCH}/${resolved}${suffix}`;
}

/** The HTML a course really uses, which stays as it is: the anchor at the top and the folds. */
const REAL_TAGS = /^<\/?(?:a|details|summary|br)(?=[\s>/])/;

/**
 * The `<` that begins something that looks like a tag (`"Olá, <nome>!"`) outside inline code becomes an entity:
 * the site reads Markdown as Vue, where it would be an element missing its end tag.
 */
function escapeTags(line: string): string {
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(/<(?=[a-zA-Z/])/g, (tag, at: number) =>
            REAL_TAGS.test(part.slice(at)) ? tag : '&lt;',
          ),
    )
    .join('');
}

/**
 * A course as a page of the site: the same text, with the links that only
 * work in the repository made to work in the site (to another course, to a
 * file on GitHub). Code blocks stay as they are, and the whole text is
 * `v-pre` so the site does not read `{{ }}` as a Vue expression.
 */
export function guidePage(guide: Guide): string {
  let fenced = false;
  const body = guide.markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return escapeTags(line).replace(
        /\]\(([^)\s]+)\)/g,
        (whole, target: string) =>
          isRelative(target)
            ? `](${rewriteTarget(guide.module, target)})`
            : whole,
      );
    })
    .join('\n');
  // `v-pre`: o Vue não lê `{{ }}` num trecho de código no meio do texto como uma expressão.
  return `::: v-pre\n\n${body}\n\n:::\n`;
}

/** The page that lists the courses, in the order given. */
export function guidesIndexPage(guides: readonly Guide[]): string {
  return [
    ...NO_EDIT_LINK,
    '# Cursos',
    '',
    '> Cada módulo do Choliba tem um curso, com exemplos completos que rodam como estão e passam pelo `bun run check`. Comece pelo módulo que você vai usar.',
    '',
    ...guides.map((guide) => `- [${guideTitle(guide)}](./${guide.module}.md)`),
    '',
  ].join('\n');
}

/** The sidebar entries of the courses, in the order given. */
export function guidesSidebar(
  guides: readonly Guide[],
): readonly SidebarItem[] {
  return guides.map((guide) => ({
    text: guide.module,
    link: `/guias/${guide.module}`,
  }));
}

/** The page of the commands: the table `bin/choliba.ts` prints in its help. */
export function commandsPage(
  commands: Readonly<Record<string, { readonly summary: string }>>,
): string {
  return [
    ...NO_EDIT_LINK,
    '# Comandos',
    '',
    '> O pacote instala o comando `choliba`. Cada comando lê o `choliba.config.ts` do projeto, da pasta atual para cima, e aceita `--help`.',
    '',
    '| Comando | O que faz |',
    '| --- | --- |',
    ...Object.entries(commands).map(
      ([name, { summary }]) =>
        `| \`choliba ${name}\` | ${summary.replaceAll('<', '&lt;')} |`,
    ),
    '',
  ].join('\n');
}
