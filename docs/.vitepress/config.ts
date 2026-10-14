import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type MarkdownEnv } from 'vitepress';

import {
  buildSidebar,
  checkDescription,
  faviconLink,
  githubSlug,
  googleAnalyticsTags,
  outsideLink,
  pageDescription,
  pageUrl,
  publishedTime,
  readDocPages,
  robotsTxt,
  shareTags,
  SITE_URL,
  websiteJsonLd,
} from '../../scripts/libs/docs';
import { description as DESCRIPTION } from './home';

/** The `docs/` folder, this config's parent. */
const DOCS = fileURLToPath(new URL('..', import.meta.url));

const REPOSITORY = 'https://github.com/choliba/choliba';

/** The Google Analytics property that measures the site's visits. */
const GOOGLE_ANALYTICS = 'G-TMCFNCED9F';

const TITLE = 'choliba';
/** When this build publishes the site: each release builds it again, so every publication has its own date. */
const PUBLISHED = publishedTime(new Date());

/**
 * A page's description: the site's for the home, the frontmatter's when it has one, otherwise the quote under its
 * title (scripts/libs/docs/share.ts). One too short or too long stops the build.
 */
function descriptionOf(relativePath: string, filePath: string, frontmatter: Record<string, unknown>): string {
  if (relativePath === 'index.md') return DESCRIPTION;
  const { description } = frontmatter;
  const source = readFileSync(path.join(DOCS, filePath), 'utf8');
  const own = typeof description === 'string' ? description : pageDescription(source);
  return checkDescription(filePath, own);
}

export default defineConfig({
  base: '/',
  lang: 'pt-BR',
  title: TITLE,
  description: DESCRIPTION,
  cleanUrls: true,
  lastUpdated: true,
  // The index of `docs/` is its README, which GitHub shows. On the site it is the first page of the
  // documentation (`/indice`); the home is index.md.
  rewrites: { 'README.md': 'indice.md' },
  head: [faviconLink()],
  sitemap: { hostname: SITE_URL },
  // Each page's description is the quote under its title (scripts/libs/docs/share.ts), which also becomes its
  // `<meta name="description">`; a page without one, or with one too short or too long, stops the build. The home,
  // generated from home.ts, has the site's; a page generated from a file of the root (/filosofia) has the one in its
  // frontmatter.
  //
  // Each page's share card (Open Graph, the article's author and date, X's card and the canonical URL) goes in its
  // frontmatter's `head`: the built page has it, and VitePress swaps it when a link opens another page, which it does
  // not do for what transformHead adds. No page has a `head` of its own; one would be replaced.
  transformPageData(pageData) {
    const description = descriptionOf(pageData.relativePath, pageData.filePath, pageData.frontmatter);
    const card = shareTags({
      siteName: TITLE,
      title: pageData.title === '' ? TITLE : pageData.title,
      description,
      url: pageUrl(pageData.relativePath),
      published: PUBLISHED,
    });
    const site = pageData.relativePath === 'index.md' ? [websiteJsonLd(TITLE, pageUrl('index.md'))] : [];
    return { description, frontmatter: { ...pageData.frontmatter, head: [...card, ...site] } };
  },
  // Built pages only, so serving the site locally sends no visits: Google Analytics on every page, the 404 too.
  transformHead() {
    return googleAnalyticsTags(GOOGLE_ANALYTICS);
  },
  buildEnd(siteConfig) {
    writeFileSync(path.join(siteConfig.outDir, 'robots.txt'), robotsTxt(SITE_URL));
  },
  markdown: {
    // The anchors GitHub makes, which the pages already link to (`comandos.md#a-aplicação-do-projeto`).
    anchor: { slugify: githubSlug },
    headers: { slugify: githubSlug },
    config: (md) => {
      md.core.ruler.push('choliba-outside-links', (state) => {
        const page = (state.env as MarkdownEnv).relativePath;
        for (const block of state.tokens) {
          for (const token of block.children ?? []) {
            const href = token.type === 'link_open' ? token.attrGet('href') : null;
            const target = href === null ? undefined : outsideLink(href, page, REPOSITORY);
            if (target !== undefined) token.attrSet('href', target);
          }
        }
      });
    },
  },
  themeConfig: {
    logo: '/owl-logo-choliba.svg',
    nav: [
      {
        text: 'Documentação',
        link: '/indice',
        activeMatch: '^/(indice|primeiros-passos|guias)(/|$)',
      },
      { text: 'Comandos', link: '/comandos/', activeMatch: '^/comandos/' },
      { text: 'Referência', link: '/referencia/ciclo-de-execucao-agente', activeMatch: '^/referencia/' },
      { text: 'Releases', link: `${REPOSITORY}/releases/tag/v0.0.1-dev` },
    ],
    // From the index: a new page shows up on its own, where docs/README.md links it (scripts/libs/docs/sidebar.ts).
    sidebar: buildSidebar(readFileSync(path.join(DOCS, 'README.md'), 'utf8'), readDocPages(DOCS)).map((section) => ({
      text: section.text,
      ...(section.link === undefined ? {} : { link: section.link }),
      items: [...section.items],
    })),
    socialLinks: [{ icon: 'github', link: REPOSITORY }],
    editLink: { pattern: `${REPOSITORY}/edit/develop/docs/:path`, text: 'Editar esta página no GitHub' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
          modal: {
            displayDetails: 'Mostrar detalhes',
            resetButtonTitle: 'Limpar a busca',
            backButtonTitle: 'Fechar a busca',
            noResultsText: 'Nenhum resultado para',
            footer: { selectText: 'escolher', navigateText: 'navegar', closeText: 'fechar' },
          },
        },
      },
    },
    outline: { label: 'Nesta página', level: [2, 3] },
    docFooter: { prev: 'Anterior', next: 'Próxima' },
    lastUpdated: { text: 'Atualizado em' },
    returnToTopLabel: 'Voltar ao topo',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Tema claro',
    darkModeSwitchTitle: 'Tema escuro',
    // Two lines, both HTML: the state of the project, then where its principles are.
    footer: {
      message: 'Pré-lançamento: muda a cada release.',
      copyright: '<a href="/filosofia">Filosofia do choliba</a>',
    },
  },
});
