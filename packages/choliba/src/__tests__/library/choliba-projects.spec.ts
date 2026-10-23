import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { fakePlatform } from '@choliba/kernel/testing';

import { createCholibaShell, openCholiba } from '../../app-shell';
import { fakeRuntime } from '../helpers/runtime';
import { makeWorkspace } from '../helpers/workspace';

const CONFIG = JSON.stringify({
  name: 'Loja',
  description: 'Loja de exemplo',
  envs: [{ nome: 'local', baseURL: 'http://localhost:3000/', appDir: '/code/loja', default: true }],
});

const TICKET = JSON.stringify({
  tipo: 'story',
  titulo: 'Carrinho',
  criterios: [{ id: 'CA-01', descricao: ['Dado x', 'Quando y', 'Então z'], testes: ['carrinho.spec.ts › adiciona'] }],
});

/** A workspace whose `.env` points CHOL_GLOBAL_DIR at `global/`, with the project `app` there. */
function workspaceWithProject(): ReturnType<typeof makeWorkspace> & { readonly projects: string } {
  const workspace = makeWorkspace({
    'global/projects/app/config.json': CONFIG,
    'global/projects/app/.env.json': JSON.stringify({ local: { TEST_USERNAME: 'ana' } }),
    'global/projects/app/tickets/1.json': TICKET,
    'global/projects/app/tickets/2.json': '{"titulo": "Dois"}',
    'global/projects/app/tests/carrinho.spec.ts': '',
    'global/projects/app/tests/login.spec.ts': '',
  });
  return { ...workspace, projects: join(workspace.path, 'global', 'projects') };
}

describe('choliba.projects', () => {
  it('gives the projects folder and lists the projects as the CLI does', async () => {
    const workspace = workspaceWithProject();
    try {
      const env = { CHOL_GLOBAL_DIR: join(workspace.path, 'global') };
      const library = openCholiba({ cwd: workspace.path, env });

      expect(library.projects.dir).toBe(workspace.projects);
      expect(library.projects.list()).toEqual([{ name: 'app', description: 'Loja de exemplo' }]);

      const platform = fakePlatform({ argv: ['list', 'projects'], cwd: workspace.path, env });
      await createCholibaShell(platform, fakeRuntime()).run();
      for (const project of library.projects.list()) expect(platform.stdout.text()).toContain(project.name);
    } finally {
      workspace.cleanup();
    }
  });

  it('fails without CHOL_GLOBAL_DIR, naming it', () => {
    const workspace = workspaceWithProject();
    try {
      expect(() => openCholiba({ cwd: workspace.path, env: {} }).projects.list()).toThrow(
        'CHOL_GLOBAL_DIR não definida',
      );
    } finally {
      workspace.cleanup();
    }
  });

  it('gets a project with its settings, tickets and specs', () => {
    const workspace = workspaceWithProject();
    try {
      const app = openCholiba({
        cwd: workspace.path,
        env: { CHOL_GLOBAL_DIR: join(workspace.path, 'global') },
      }).projects.get('app');

      expect(app.name).toBe('app');
      expect(app.dir).toBe(join(workspace.projects, 'app'));
      expect(app.settings.environment.nome).toBe('local');
      expect(app.settings.appDir).toBe('/code/loja');
      expect(app.tickets.list().map((ticket) => [ticket.id, ticket.title])).toEqual([
        ['app-1', 'Carrinho'],
        ['app-2', 'Dois'],
      ]);
      expect(app.tickets.get('1')).toMatchObject({ id: 'app-1', type: 'story', specs: ['carrinho.spec.ts'] });
      expect(() => app.tickets.get('app-9')).toThrow('Ticket "app-9" não encontrado');
      expect(app.tests.dir).toBe(join(workspace.projects, 'app', 'tests'));
      expect(app.tests.list()).toEqual(['carrinho.spec.ts', 'login.spec.ts']);
    } finally {
      workspace.cleanup();
    }
  });

  it('fails on an unknown project, naming its config.json', () => {
    const workspace = workspaceWithProject();
    try {
      const library = openCholiba({ cwd: workspace.path, env: { CHOL_GLOBAL_DIR: join(workspace.path, 'global') } });

      expect(() => library.projects.get('nada')).toThrow(
        `Projeto "nada" não encontrado (${join(workspace.projects, 'nada', 'config.json')} não existe).`,
      );
    } finally {
      workspace.cleanup();
    }
  });
});

describe('choliba.projects — README, counts and retired criteria', () => {
  it("sums up the application's README, counts the tickets and criteria, and lists what a later ticket replaces", () => {
    const workspace = makeWorkspace({
      'global/projects/app/config.json': JSON.stringify({
        name: 'Loja',
        envs: [{ nome: 'local', baseURL: 'http://localhost:3000/', appDir: '../../../code', default: true }],
      }),
      'global/projects/app/.env.json': JSON.stringify({ local: {} }),
      'global/projects/app/tickets/1.json': TICKET,
      'global/projects/app/tickets/2.json': JSON.stringify({
        titulo: 'Novo carrinho',
        substitui: ['1:CA-01'],
        criterios: [{ id: 'CA-01', descricao: ['Dado a'], testes: [] }],
      }),
      'code/README.md': '# Loja\n\nUma loja de exemplo para o choliba.\n',
    });
    try {
      const app = openCholiba({
        cwd: workspace.path,
        env: { CHOL_GLOBAL_DIR: join(workspace.path, 'global') },
      }).projects.get('app');

      expect(app.readme).toBe('Loja: Uma loja de exemplo para o choliba.');
      expect(app.counts).toEqual({ tickets: 2, criteria: 2, criteriaWithTests: 1 });
      expect(app.tickets.retired()).toEqual([
        { ticket: 'app-1', criterion: 'CA-01', by: 'app-2', tests: ['carrinho.spec.ts › adiciona'] },
      ]);
    } finally {
      workspace.cleanup();
    }
  });

  it('has no README summary when the application folder is not there', () => {
    const workspace = workspaceWithProject();
    try {
      const app = openCholiba({
        cwd: workspace.path,
        env: { CHOL_GLOBAL_DIR: join(workspace.path, 'global') },
      }).projects.get('app');

      expect(app.readme).toBeUndefined();
      expect(app.tickets.retired()).toEqual([]);
    } finally {
      workspace.cleanup();
    }
  });
});

describe("choliba.projects — a ticket's results", () => {
  const REPORT = JSON.stringify({
    stats: { startTime: '2026-10-17T06:01:48.003Z', duration: 1200, expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [
      {
        title: 'carrinho.spec.ts',
        specs: [{ title: 'CA-01: adiciona', tests: [{ status: 'expected', results: [{ status: 'passed' }] }] }],
      },
    ],
  });

  it('reads the last run of a ticket from ticket-runs, or CHOL_TICKET_RUNS, and nothing when it never ran', () => {
    const workspace = workspaceWithProject();
    const report = 'app/ticket-runs/app-1/playwright-report/results.json';
    try {
      mkdirSync(dirname(join(workspace.projects, report)), { recursive: true });
      writeFileSync(join(workspace.projects, report), REPORT);
      mkdirSync(dirname(join(workspace.path, 'runs', report)), { recursive: true });
      writeFileSync(join(workspace.path, 'runs', report), REPORT.replace('"duration":1200', '"duration":99'));
      const global = join(workspace.path, 'global');
      const app = openCholiba({ cwd: workspace.path, env: { CHOL_GLOBAL_DIR: global } }).projects.get('app');
      const elsewhere = openCholiba({
        cwd: workspace.path,
        env: { CHOL_GLOBAL_DIR: global, CHOL_TICKET_RUNS: join(workspace.path, 'runs') },
      }).projects.get('app');

      expect(app.tickets.results('1')).toEqual({
        ranAt: '2026-10-17T06:01:48.003Z',
        duration: 1200,
        stats: { passed: 1, failed: 0, skipped: 0, flaky: 0 },
        tests: [{ title: 'CA-01: adiciona', file: 'carrinho.spec.ts', status: 'passed' }],
        criteria: [{ id: 'CA-01', status: 'passou' }],
      });
      expect(elsewhere.tickets.results('app-1')?.duration).toBe(99);
      expect(app.tickets.results('2')).toBeUndefined();
    } finally {
      workspace.cleanup();
    }
  });
});
