/**
 * The site's home (VitePress `layout: home`): its hero and a card per section. It lives here, with the site's
 * config, so that `docs/` keeps only documentation; `scripts/docs-home.ts` writes it to `docs/index.md` (ignored by
 * git) before `docs:dev` and `docs:build`.
 */
/**
 * The site's description: the home's `<meta name="description">` and share card, which has no text of its own to
 * quote. From 100 to 160 characters, like every page's (scripts/libs/docs-share.ts).
 */
export const description =
  'Agentes que transformam um pedido em ticket, testes E2E e código, dentro das permissões e dos portões que o choliba aplica.';

export const home = {
  layout: 'home',
  hero: {
    name: 'choliba',
    text: 'Testes E2E operados por agentes',
    tagline: 'Observe com atenção. Aja com precisão. Deixe evidências.',
    image: { src: '/owl-logo-choliba.svg', alt: 'A coruja do choliba' },
    actions: [
      { theme: 'brand', text: 'Começar', link: '/primeiros-passos' },
      { theme: 'alt', text: 'Referência', link: '/referencia/cli' },
      { theme: 'alt', text: 'GitHub', link: 'https://github.com/choliba/choliba' },
    ],
  },
  features: [
    {
      title: 'Começar',
      details:
        'Instale o choliba, crie a pasta de trabalho e leve o primeiro pedido até o código implementado, com ticket e testes no caminho.',
      link: '/primeiros-passos',
      linkText: 'Primeiros passos',
    },
    {
      title: 'Guias',
      details:
        'Escrever um agente e instalar agentes, skills e MCPs.',
      link: '/guias/escrever-um-agente',
      linkText: 'Ver os guias',
    },
    {
      title: 'Referência',
      details:
        'Cada comando da CLI, a segurança de cada agente, cada chave do <code>agent.yaml</code> e cada variável do <code>.env</code>.',
      link: '/referencia/cli',
      linkText: 'Consultar',
    },
  ],
} as const;
