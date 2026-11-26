import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import {
  commandsPage,
  editLinkOf,
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

test('o link de edição de um curso leva ao README do módulo; o de outra página, ao docs/', () => {
  expect(editLinkOf({ filePath: 'guias/policy.md' })).toBe(
    `${REPOSITORY_URL}/edit/develop/guides/policy/README.md`,
  );
  expect(editLinkOf({ filePath: 'primeiros-passos.md' })).toBe(
    `${REPOSITORY_URL}/edit/develop/docs/primeiros-passos.md`,
  );
});

test('o link de edição funciona refeito do texto da função, como o VitePress faz no navegador', async () => {
  // O VitePress guarda o texto da função e a refaz no navegador, longe deste
  // módulo: num arquivo só com ela, ela precisa dar o mesmo link.
  const dir = mkdtempSync(join(tmpdir(), 'choliba-edit-link-'));
  try {
    const file = join(dir, 'edit-link.js');
    writeFileSync(file, `export default ${editLinkOf.toString()}\n`);
    const loaded: unknown = await import(file);
    const rebuilt =
      typeof loaded === 'object' && loaded !== null && 'default' in loaded
        ? loaded.default
        : undefined;
    if (typeof rebuilt !== 'function') throw new Error('não é uma função');

    expect(
      Reflect.apply(rebuilt, undefined, [{ filePath: 'guias/policy.md' }]),
    ).toBe(`${REPOSITORY_URL}/edit/develop/guides/policy/README.md`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('o índice dos cursos e a página de comandos, gerados, não têm link de edição', () => {
  const noEditLink = '---\neditLink: false\n---\n\n# ';

  expect(guidesIndexPage([GUIDE]).startsWith(noEditLink)).toBe(true);
  expect(commandsPage({}).startsWith(noEditLink)).toBe(true);
  expect(guidePage(GUIDE)).not.toContain('editLink');
});
