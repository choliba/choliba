import { expect, test } from 'bun:test';

import {
  commandsPage,
  guidePage,
  guidesIndexPage,
  guidesSidebar,
  guideTitle,
  REPOSITORY_URL,
} from '../scripts/docs';

const GUIDE = {
  module: 'policy',
  markdown: [
    '<a id="topo"></a>',
    '',
    '# Módulo policy: para que ele existe',
    '',
    'Veja o [índice](#indice), a [rede](../network/README.md#regras),',
    'o [exemplo](exemplos/1-basico.ts), a [pasta](exemplos/), o [site](https://bun.sh)',
    'e o [vizinho](../../tools/fetch.ts).',
    '',
    '```md',
    'Isto [fica](exemplos/x.ts) como está.',
    '```',
    '',
    'Depois do bloco, [vale](exemplos/2.ts) de novo.',
    '',
    'Diz "Olá, <nome>!" e `<isto>` fica, e <details> também.',
  ].join('\n'),
};

test('o título do curso é o primeiro # do README', () => {
  expect(guideTitle(GUIDE)).toBe('Módulo policy: para que ele existe');
  expect(guideTitle({ module: 'sem-titulo', markdown: 'texto' })).toBe(
    'sem-titulo',
  );
});

test('a página liga outro curso à página dele e os arquivos ao GitHub', () => {
  const page = guidePage(GUIDE);

  expect(page).toContain('[índice](#indice)');
  expect(page).toContain('[rede](./network.md#regras)');
  expect(page).toContain(
    `[exemplo](${REPOSITORY_URL}/blob/master/guides/policy/exemplos/1-basico.ts)`,
  );
  expect(page).toContain(
    `[pasta](${REPOSITORY_URL}/tree/master/guides/policy/exemplos/)`,
  );
  expect(page).toContain('[site](https://bun.sh)');
  expect(page).toContain(
    `[vizinho](${REPOSITORY_URL}/blob/master/tools/fetch.ts)`,
  );
});

test('o que está num bloco de código fica como está', () => {
  const page = guidePage(GUIDE);

  expect(page).toContain('Isto [fica](exemplos/x.ts) como está.');
  expect(page).toContain(
    `[vale](${REPOSITORY_URL}/blob/master/guides/policy/exemplos/2.ts)`,
  );
});

test('o que parece uma tag fora de código vira entidade, e o HTML de verdade fica', () => {
  const page = guidePage(GUIDE);

  expect(page).toContain(
    'Diz "Olá, &lt;nome>!" e `<isto>` fica, e <details> também.',
  );
  expect(page).toContain('<a id="topo"></a>');
});

test('o texto todo vai num bloco v-pre', () => {
  const page = guidePage({
    module: 'x',
    markdown: '# X\n\nUsa `{{ valor }}`.',
  });

  expect(page.startsWith('::: v-pre\n\n# X')).toBe(true);
  expect(page.endsWith('\n\n:::\n')).toBe(true);
});

test('o índice e o menu listam os cursos na ordem dada', () => {
  const other = { module: 'network', markdown: '# Módulo network' };

  expect(guidesIndexPage([GUIDE, other])).toContain(
    '- [Módulo policy: para que ele existe](./policy.md)\n- [Módulo network](./network.md)',
  );
  expect(guidesSidebar([GUIDE, other])).toEqual([
    { text: 'policy', link: '/guias/policy' },
    { text: 'network', link: '/guias/network' },
  ]);
});

test('a página de comandos tem uma linha por comando', () => {
  const page = commandsPage({
    rounds: { summary: 'roda uma rodada' },
    clear: { summary: 'apaga tudo' },
    show: { summary: 'mostra: choliba show <id>' },
  });

  expect(page).toContain('| `choliba rounds` | roda uma rodada |');
  expect(page).toContain('| `choliba clear` | apaga tudo |');
  // O texto solto do Markdown que parece uma tag quebra a página: o `<` sai como entidade.
  expect(page).toContain('| `choliba show` | mostra: choliba show &lt;id> |');
});
