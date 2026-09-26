import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findReadme, readText, readmeSummary } from '../index';

function comPasta(arquivos: Readonly<Record<string, string | Buffer>>, fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-readme-'));
  try {
    for (const [nome, conteudo] of Object.entries(arquivos)) fs.writeFileSync(path.join(dir, nome), conteudo);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('findReadme', () => {
  it('finds a README in any case, preferring markdown, and nothing without one', () => {
    comPasta({ 'readme.txt': 'a', 'Readme.md': 'b', README: 'c', 'readme-old.md': 'd' }, (dir) => {
      expect(findReadme(dir)).toBe(path.join(dir, 'Readme.md'));
    });
    comPasta({ README: 'c', 'readme.txt': 'a' }, (dir) => {
      expect(findReadme(dir)).toBe(path.join(dir, 'README'));
    });
    comPasta({ 'main.ts': '' }, (dir) => {
      expect(findReadme(dir)).toBeUndefined();
    });
  });
});

describe('readText', () => {
  it('reads UTF-8, and Latin-1 when the bytes are not valid UTF-8', () => {
    comPasta({ 'utf8.md': 'gestão', 'latin1.md': Buffer.from('gest\xe3o', 'latin1') }, (dir) => {
      expect(readText(path.join(dir, 'utf8.md'))).toBe('gestão');
      expect(readText(path.join(dir, 'latin1.md'))).toBe('gestão');
    });
  });
});

describe('readmeSummary', () => {
  it('joins the title and the first paragraph, skipping badges, headings, lists, tables and code', () => {
    const readme = [
      '[![build](https://ci/badge.svg)](https://ci)',
      '',
      '# Trade **Tools**',
      '',
      '```sh',
      'npm install',
      '```',
      '| a | b |',
      '- item',
      '',
      'Sistema de `gestão` de [pedidos](https://x) para',
      'distribuidores. ![logo](l.png)',
      '',
      'Outro parágrafo.',
    ].join('\r\n');

    expect(readmeSummary(readme)).toBe('Trade Tools: Sistema de gestão de pedidos para distribuidores.');
  });

  it('uses the title or the paragraph alone when the other is missing, and nothing when both are', () => {
    expect(readmeSummary('# Só título\n\n## Seção\n')).toBe('Só título');
    expect(readmeSummary('Só um parágrafo.\n')).toBe('Só um parágrafo.');
    expect(readmeSummary('## Seção\n\n- item\n')).toBeUndefined();
  });

  it('stops at the end of the first paragraph, even if a second title comes later', () => {
    expect(readmeSummary('Primeiro.\n# Título tardio\n\nDepois.')).toBe('Título tardio: Primeiro.');
  });

  it('keeps it short: whole sentences up to 400 characters, else cut at a word with an ellipsis', () => {
    const frase = `${'palavra '.repeat(30).trim()}.`;
    const semPonto = 'palavra '.repeat(80).trim();

    const curto = readmeSummary(`# T\n\n${frase} ${frase} ${frase}`);
    expect(curto?.endsWith('.')).toBe(true);
    expect(curto?.length).toBeLessThanOrEqual(400);
    const cortado = readmeSummary(semPonto);
    expect(cortado?.endsWith('…')).toBe(true);
    expect(cortado?.length).toBeLessThanOrEqual(401);
  });
});
