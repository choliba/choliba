import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type MarkdownEnv } from 'vitepress';

import { googleAnalyticsTags } from '../../scripts/libs/docs-analytics';
import { robotsTxt } from '../../scripts/libs/docs-crawlers';
import { githubSlug, outsideLink } from '../../scripts/libs/docs-links';
import {
  checkDescription,
  pageDescription,
  pageUrl,
  publishedTime,
  shareTags,
  SITE_URL,
} from '../../scripts/libs/docs-share';
import { buildSidebar, readDocPages } from '../../scripts/libs/docs-sidebar';
import { description as DESCRIPTION } from './home';

/** The `docs/` folder, this config's parent. */
const DOCS = fileURLToPath(new URL('..', import.meta.url));

const REPOSITORY = 'https://github.com/choliba/choliba';

/** The Google Analytics property that measures the site's visits. */
const GOOGLE_ANALYTICS = 'G-TMCFNCED9F';

const TITLE = 'choliba';
/** When this build publishes the site: each release builds it again, so every publication has its own date. */
const PUBLISHED = publishedTime(new Date());

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
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/owl-logo-choliba.svg' }]],
  sitemap: { hostname: SITE_URL },
  // Each page's description is the quote under its title (scripts/libs/docs-share.ts), which also becomes its
  // `<meta name="description">`; a page without one, or with one too short or too long, stops the build. The home,
  // generated from home.ts, has the site's.
  transformPageData(pageData) {
    if (pageData.relativePath === 'index.md') return { description: DESCRIPTION };
    const source = readFileSync(path.join(DOCS, pageData.filePath), 'utf8');
    return { description: checkDescription(pageData.filePath, pageDescription(source)) };
  },
  // Built pages only, so serving the site locally sends no visits: Google Analytics on every page, the 404 too, and
  // each page's share card (Open Graph, the article's author and date, X's card and the canonical URL).
  transformHead({ page, pageData, description }) {
    const analytics = googleAnalyticsTags(GOOGLE_ANALYTICS);
    if (page === '404.md') return analytics;
    return [
      ...analytics,
      ...shareTags({
        siteName: TITLE,
        title: pageData.title === '' ? TITLE : pageData.title,
        description,
        url: pageUrl(pageData.relativePath),
        published: PUBLISHED,
      }),
    ];
  },
  buildEnd(siteConfig) {
    writeFileSync(path.join(siteConfig.outDir, 'robots.txt'), robotsTxt(SITE_URL));
  },
  markdown: {
    // The anchors GitHub makes, which the pages already link to (`cli.md#a-aplicação-do-projeto`).
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
      { text: 'Referência', link: '/referencia/cli', activeMatch: '^/referencia/' },
      { text: 'Releases', link: `${REPOSITORY}/releases/tag/v0.0.1-dev` },
    ],
    // From the index: a new page shows up on its own, where docs/README.md links it (scripts/libs/docs-sidebar.ts).
    sidebar: buildSidebar(readFileSync(path.join(DOCS, 'README.md'), 'utf8'), readDocPages(DOCS)).map((section) => ({
      text: section.text,
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
    footer: { message: 'Pré-lançamento: muda a cada release.' },
  },
});
