/**
 * The site's home (VitePress `layout: home`): its hero and a card per section. It lives here, with the site's
 * config, so that `docs/` keeps only documentation; `scripts/docs-home.ts` writes it to `docs/index.md` (ignored by
 * git) before `docs:dev` and `docs:build`.
 */
export const home = {
  layout: 'home',
  hero: {
    name: 'choliba',
    text: 'Testes E2E operados por agentes',
    tagline: 'Observe com atenção. Aja com precisão. Deixe evidências.',
    image: { src: '/owl-logo-choliba.svg', alt: 'A coruja do choliba' },
    actions: [
      { theme: 'brand', text: 'Começar', link: '/primeiros-passos' },
      { theme: 'alt', text: 'Índice', link: '/indice' },
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
        'Escrever um agente, instalar agentes, skills e MCPs, e ver o que uma execução faria com <code>--dry-run</code>.',
      link: '/guias/escrever-um-agente',
      linkText: 'Ver os guias',
    },
    {
      title: 'Conceitos',
      details: 'A pasta de trabalho, o que acontece numa execução, os critérios e portões dos testes e a segurança.',
      link: '/conceitos/execucao',
      linkText: 'Entender como funciona',
    },
    {
      title: 'Referência',
      details: 'Cada comando da CLI, cada chave do <code>agent.yaml</code> e cada variável do <code>.env</code>.',
      link: '/referencia/cli',
      linkText: 'Consultar',
    },
  ],
} as const;
