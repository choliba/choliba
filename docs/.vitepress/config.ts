import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

import guides from './generated/guides-sidebar.json';

const REPOSITORY = 'https://github.com/choliba/choliba';

export default defineConfig({
  lang: 'pt-BR',
  title: 'Choliba',
  description:
    'Roda agentes de código (Claude Code, Codex, Cursor e modelos locais pelo Ollama) a partir de scripts TypeScript, sempre dentro de uma sandbox.',
  base: '/',
  cleanUrls: true,
  head: [['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }]],
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
