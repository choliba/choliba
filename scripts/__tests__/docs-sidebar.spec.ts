import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildSidebar, readDocPages } from '../libs/docs';

const README = [
  '| começar | [Primeiros passos](primeiros-passos.md) |',
  '| tarefa | [B](guias/b.md#parte), [A](guias/a.md), [de novo](guias/b.md) |',
  '| fora | [Filosofia](../PHILOSOPHY.md) |',
].join('\n');

describe('buildSidebar', () => {
  it('groups the pages by folder, in the order the index links them, then the others by name, without the index, the home and the philosophy', () => {
    const pages = [
      { file: 'README.md', title: 'Documentação' },
      { file: 'index.md', title: 'index.md' },
      { file: 'filosofia.md', title: 'Filosofia do choliba' },
      { file: 'primeiros-passos.md', title: 'Primeiros passos' },
      { file: 'guias/a.md', title: 'Guia A' },
      { file: 'guias/b.md', title: 'O `b`' },
      { file: 'guias/novo.md', title: 'Novo' },
      { file: 'guias/c.md', title: 'C' },
      { file: 'referencia/comandos.md', title: 'Comandos' },
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
      { text: 'Referência', items: [{ text: 'Comandos', link: '/referencia/comandos' }] },
    ]);
  });
});

describe('buildSidebar commands', () => {
  it('lists each command by its full name, in order, and the heading opens the index', () => {
    const pages = [
      { file: 'comandos/index.md', title: 'Comandos', order: 0 },
      { file: 'comandos/add.md', title: '`choliba add`', group: 'Agentes, skills e MCPs', order: 5 },
      { file: 'comandos/run.md', title: '`choliba run`', group: 'Ticket e testes', order: 1 },
    ];

    expect(buildSidebar('', pages)).toEqual([
      {
        text: 'Comandos',
        link: '/comandos/',
        items: [
          { text: 'choliba run', link: '/comandos/run' },
          { text: 'choliba add', link: '/comandos/add' },
        ],
      },
    ]);
  });
});

describe('readDocPages', () => {
  it('reads every Markdown page outside .vitepress, titled by its heading or, without one, its file', () => {
    const docs = mkdtempSync(path.join(tmpdir(), 'docs-pages-'));
    try {
      mkdirSync(path.join(docs, 'guias'));
      mkdirSync(path.join(docs, 'comandos'));
      mkdirSync(path.join(docs, '.vitepress'));
      writeFileSync(path.join(docs, 'guias', 'a.md'), 'texto\n\n# Guia A\n');
      writeFileSync(path.join(docs, 'sem-titulo.md'), 'só texto\n');
      writeFileSync(
        path.join(docs, 'comandos', 'run-agent.md'),
        '---\ngroup: Ticket e testes\norder: 1\n---\n\n# `choliba run agent`\n',
      );
      writeFileSync(path.join(docs, '.vitepress', 'x.md'), '# fora\n');
      writeFileSync(path.join(docs, 'logo.svg'), '<svg/>');

      expect([...readDocPages(docs)].sort((a, b) => a.file.localeCompare(b.file))).toEqual([
        { file: 'comandos/run-agent.md', title: '`choliba run agent`', group: 'Ticket e testes', order: 1 },
        { file: 'guias/a.md', title: 'Guia A' },
        { file: 'sem-titulo.md', title: 'sem-titulo.md' },
      ]);
    } finally {
      rmSync(docs, { recursive: true, force: true });
    }
  });
});
