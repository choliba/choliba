import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

import {
  type BuiltPage,
  checkDescription,
  faviconLink,
  googleAnalyticsTags,
  mainLandmarkMessage,
  pageDescription,
  pagesWithoutOneMain,
  pageUrl,
  publishedTime,
  robotsTxt,
  shareTags,
  SITE_DESCRIPTION,
  SITE_URL,
  websiteJsonLd,
} from '../../scripts/docs-seo';
import guides from './generated/guides-sidebar.json';

/** The `docs/` folder, this config's parent. */
const DOCS = fileURLToPath(new URL('..', import.meta.url));

const REPOSITORY = 'https://github.com/choliba/choliba';

/** The Google Analytics property that measures the site's visits. */
const GOOGLE_ANALYTICS = 'G-TMCFNCED9F';

const TITLE = 'Choliba';

/** When this build publishes the site: each release builds it again, so every publication has its own date. */
const PUBLISHED = publishedTime(new Date());

/** Every page the build wrote, by its path in `outDir`. */
function builtPages(outDir: string): BuiltPage[] {
  return readdirSync(outDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => ({
      path: file,
      html: readFileSync(path.join(outDir, file), 'utf8'),
    }));
}

export default defineConfig({
  lang: 'pt-BR',
  title: TITLE,
  description: SITE_DESCRIPTION,
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  head: [faviconLink()],
  sitemap: { hostname: SITE_URL },
  // O cartão de compartilhamento de cada página (Open Graph, o card do X, o autor e a data do artigo e a URL canônica)
  // vai no `head` do frontmatter: a página buildada o tem, e o VitePress o troca quando um link abre outra página, o
  // que não faz com o que o transformHead acrescenta. Nenhuma página tem `head` próprio; ele seria substituído.
  // A descrição é a do frontmatter ou a citação sob o título; a home tem a do site. Uma página sem ela, ou com uma curta
  // ou longa demais, reprova o build (scripts/docs-seo.ts).
  transformPageData(pageData) {
    const markdown = readFileSync(path.join(DOCS, pageData.filePath), 'utf8');
    const description = checkDescription(
      pageData.filePath,
      pageData.relativePath === 'index.md'
        ? SITE_DESCRIPTION
        : pageDescription(pageData.frontmatter, markdown),
    );
    const card = shareTags({
      siteName: TITLE,
      title: pageData.title === '' ? TITLE : pageData.title,
      description,
      url: pageUrl(pageData.relativePath),
      published: PUBLISHED,
    });
    const site =
      pageData.relativePath === 'index.md'
        ? [websiteJsonLd(TITLE, pageUrl('index.md'))]
        : [];
    return {
      description,
      frontmatter: { ...pageData.frontmatter, head: [...card, ...site] },
    };
  },
  // Só nas páginas buildadas, então servir o site localmente não manda visitas: o Google Analytics vai em todas, na 404 também.
  transformHead() {
    return googleAnalyticsTags(GOOGLE_ANALYTICS);
  },
  // Toda página tem um só landmark main, para leitores de tela: uma sem ele reprova o build. E o robots.txt.
  buildEnd(siteConfig) {
    const missing = pagesWithoutOneMain(builtPages(siteConfig.outDir));
    if (missing.length > 0) throw new Error(mainLandmarkMessage(missing));
    writeFileSync(
      path.join(siteConfig.outDir, 'robots.txt'),
      robotsTxt(SITE_URL),
    );
  },
  // A home e a 404 do tema padrão têm uma div na raiz, então nenhuma tinha o landmark main: estas põem cada uma dentro
  // de um. O padrão é o import exato que o VPContent.vue faz, então o original, importado pelo caminho completo, fica.
  vite: {
    resolve: {
      alias: [
        {
          find: /^\.\/VPHome\.vue$/,
          replacement: fileURLToPath(
            new URL('theme/home-main.vue', import.meta.url),
          ),
        },
        {
          find: /^\.\.\/NotFound\.vue$/,
          replacement: fileURLToPath(
            new URL('theme/not-found-main.vue', import.meta.url),
          ),
        },
      ],
    },
  },
  // Um link quebrado reprova o build: é para isso que o CI roda o docs:build.
  ignoreDeadLinks: false,
  // Os cursos de docs/guias/ e docs/comandos.md são gerados (bun run docs:pages).
  themeConfig: {
    logo: '/owl-logo-choliba.svg',
    nav: [
      { text: 'Primeiros passos', link: '/primeiros-passos' },
      { text: 'Cursos', link: '/guias/' },
      { text: 'Comandos', link: '/comandos' },
    ],
    sidebar: [
      { text: 'Primeiros passos', link: '/primeiros-passos' },
      { text: 'Comandos', link: '/comandos' },
      { text: 'Cursos', link: '/guias/', items: guides },
    ],
    socialLinks: [{ icon: 'github', link: REPOSITORY }],
    editLink: {
      pattern: `${REPOSITORY}/edit/develop/docs/:path`,
      text: 'Editar esta página no GitHub',
    },
    outline: { label: 'Nesta página' },
    docFooter: { prev: 'Anterior', next: 'Próxima' },
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
            footer: {
              selectText: 'escolher',
              navigateText: 'navegar',
              closeText: 'fechar',
            },
          },
        },
      },
    },
    returnToTopLabel: 'Voltar ao topo',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Tema',
    lightModeSwitchTitle: 'Tema claro',
    darkModeSwitchTitle: 'Tema escuro',
  },
});
