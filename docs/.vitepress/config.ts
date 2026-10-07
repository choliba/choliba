import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type MarkdownEnv } from 'vitepress';

import { githubSlug, outsideLink } from '../../scripts/libs/docs-links';
import { buildSidebar, readDocPages } from '../../scripts/libs/docs-sidebar';

/** The `docs/` folder, this config's parent. */
const DOCS = fileURLToPath(new URL('..', import.meta.url));

const REPOSITORY = 'https://github.com/choliba/choliba';

export default defineConfig({
  base: '/choliba/',
  lang: 'pt-BR',
  title: 'choliba',
  description: 'Agentes que transformam um pedido em ticket, testes e código, com permissões e portões.',
  cleanUrls: true,
  lastUpdated: true,
  // The index of `docs/` is its README, which GitHub shows; on the site it is the home.
  rewrites: { 'README.md': 'index.md' },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/choliba/owl-logo-choliba.svg' }]],
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
      { text: 'Documentação', link: '/primeiros-passos' },
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
