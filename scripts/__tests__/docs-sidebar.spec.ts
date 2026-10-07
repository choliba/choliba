import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildSidebar, readDocPages } from '../libs/docs-sidebar';

const README = [
  '| começar | [Primeiros passos](primeiros-passos.md) |',
  '| tarefa | [B](guias/b.md#parte), [A](guias/a.md), [de novo](guias/b.md) |',
  '| fora | [Filosofia](../PHILOSOPHY.md) |',
].join('\n');

describe('buildSidebar', () => {
  it('groups the pages by folder, in the order the index links them, then the others by name', () => {
    const pages = [
      { file: 'README.md', title: 'Documentação' },
      { file: 'primeiros-passos.md', title: 'Primeiros passos' },
      { file: 'guias/a.md', title: 'Guia A' },
      { file: 'guias/b.md', title: 'O `b`' },
      { file: 'guias/novo.md', title: 'Novo' },
      { file: 'guias/c.md', title: 'C' },
      { file: 'referencia/cli.md', title: 'CLI' },
    ];

    expect(buildSidebar(README, pages)).toEqual([
      { text: 'Começar', items: [{ text: 'Primeiros passos', link: '/primeiros-passos' }] },
      {
        text: 'Guias',
        items: [
          { text: 'O b', link: '/guias/b' },
          { text: 'Guia A', link: '/guias/a' },
          { text: 'C', link: '/guias/c' },
          { text: 'Novo', link: '/guias/novo' },
        ],
      },
      { text: 'Referência', items: [{ text: 'CLI', link: '/referencia/cli' }] },
    ]);
  });
});

describe('readDocPages', () => {
  it('reads every Markdown page outside .vitepress, titled by its heading or, without one, its file', () => {
    const docs = mkdtempSync(path.join(tmpdir(), 'docs-pages-'));
    try {
      mkdirSync(path.join(docs, 'guias'));
      mkdirSync(path.join(docs, '.vitepress'));
      writeFileSync(path.join(docs, 'guias', 'a.md'), 'texto\n\n# Guia A\n');
      writeFileSync(path.join(docs, 'sem-titulo.md'), 'só texto\n');
      writeFileSync(path.join(docs, '.vitepress', 'x.md'), '# fora\n');
      writeFileSync(path.join(docs, 'logo.svg'), '<svg/>');

      expect([...readDocPages(docs)].sort((a, b) => a.file.localeCompare(b.file))).toEqual([
        { file: 'guias/a.md', title: 'Guia A' },
        { file: 'sem-titulo.md', title: 'sem-titulo.md' },
      ]);
    } finally {
      rmSync(docs, { recursive: true, force: true });
    }
  });
});
