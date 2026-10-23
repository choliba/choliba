import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listProjectSpecs, readTicket, readTickets } from '@choliba/workspace';

function withProjects<T>(fn: (projectsDir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-info-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The project `app` with `files` relative to its folder. */
function app(projectsDir: string, files: Readonly<Record<string, string>>): string {
  const dir = path.join(projectsDir, 'app');
  fs.mkdirSync(path.join(dir, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), content);
  }
  return dir;
}

const STORY = JSON.stringify({
  ticket: 'app-1',
  tipo: 'story',
  titulo: 'Carrinho',
  contexto: 'Comprar.',
  criterios: [
    {
      id: 'CA-01',
      descricao: ['Dado um produto', 'Quando adiciono', 'Então vejo no carrinho'],
      testes: ['carrinho.spec.ts › adiciona', 'carrinho.spec.ts › remove', 'fluxo/compra.spec.ts › paga'],
    },
    { id: 'CA-02', descricao: 'Dado algo, Então outro' },
  ],
});

describe('readTicket', () => {
  it('reads a ticket typed, by key or by suffix', () => {
    withProjects((projectsDir) => {
      const dir = app(projectsDir, { 'tickets/1.json': STORY });
      const ticket = readTicket(projectsDir, 'app', '1');

      expect(ticket).toEqual({
        id: 'app-1',
        type: 'story',
        title: 'Carrinho',
        criteria: [
          {
            id: 'CA-01',
            description: ['Dado um produto', 'Quando adiciono', 'Então vejo no carrinho'],
            tests: ['carrinho.spec.ts › adiciona', 'carrinho.spec.ts › remove', 'fluxo/compra.spec.ts › paga'],
          },
          { id: 'CA-02', description: ['Dado algo, Então outro'], tests: [] },
        ],
        specs: ['carrinho.spec.ts', 'fluxo/compra.spec.ts'],
        file: path.join(dir, 'tickets', '1.json'),
        fields: JSON.parse(STORY) as unknown,
      });
      expect(readTicket(projectsDir, 'app', 'app-1').id).toBe('app-1');
    });
  });

  it('reads a ticket with no type, title or criteria', () => {
    withProjects((projectsDir) => {
      app(projectsDir, { 'tickets/2.json': '{}' });

      expect(readTicket(projectsDir, 'app', 'app-2')).toMatchObject({ id: 'app-2', criteria: [], specs: [] });
      expect(readTicket(projectsDir, 'app', 'app-2')).not.toHaveProperty('title');
    });
  });

  it('fails naming the file when the ticket is missing', () => {
    withProjects((projectsDir) => {
      const dir = app(projectsDir, {});

      expect(() => readTicket(projectsDir, 'app', 'app-9')).toThrow(
        `Ticket "app-9" não encontrado (${path.join(dir, 'tickets', '9.json')} não existe).`,
      );
    });
  });

  it.each([
    ['[]', 'o ticket deve ser um objeto JSON'],
    ['{"criterios": {}}', '"criterios" deve ser uma lista'],
    ['{"titulo": 1}', '"titulo" deve ser um texto'],
    ['{"criterios": [{"descricao": []}]}', 'criterios[0] deve ser um objeto com "id" (texto)'],
    ['{"criterios": [{"id": "CA-01", "testes": [1]}]}', 'criterios[0].testes deve ser uma lista de textos'],
  ])('fails naming the file and the field for %s', (json, problem) => {
    withProjects((projectsDir) => {
      const dir = app(projectsDir, { 'tickets/1.json': json });

      expect(() => readTicket(projectsDir, 'app', '1')).toThrow(`${path.join(dir, 'tickets', '1.json')}: ${problem}`);
    });
  });
});

describe('readTickets', () => {
  it('reads every ticket of the project, by key', () => {
    withProjects((projectsDir) => {
      app(projectsDir, { 'tickets/2.json': '{"titulo": "Dois"}', 'tickets/1.json': STORY });

      expect(readTickets(projectsDir, 'app').map((ticket) => [ticket.id, ticket.title])).toEqual([
        ['app-1', 'Carrinho'],
        ['app-2', 'Dois'],
      ]);
    });
  });
});

describe('listProjectSpecs', () => {
  it('lists the spec files of tests/, in subfolders too, relative and sorted', () => {
    withProjects((projectsDir) => {
      app(projectsDir, {
        'tests/login.spec.ts': '',
        'tests/carrinho.spec.ts': '',
        'tests/fluxo/compra.test.js': '',
        'tests/helpers.ts': '',
        'tests/pages/base.spec.ts/.keep': '',
      });

      expect(listProjectSpecs(projectsDir, 'app')).toEqual([
        'carrinho.spec.ts',
        'fluxo/compra.test.js',
        'login.spec.ts',
      ]);
    });
  });

  it('has none without a tests folder', () => {
    withProjects((projectsDir) => {
      app(projectsDir, {});

      expect(listProjectSpecs(projectsDir, 'app')).toEqual([]);
    });
  });
});
