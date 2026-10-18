import { join } from 'node:path';

import { fakePlatform } from '@choliba/core/testing';

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
      const api = openCholiba({ cwd: workspace.path, env });

      expect(api.projects.dir).toBe(workspace.projects);
      expect(api.projects.list()).toEqual([{ name: 'app', description: 'Loja de exemplo' }]);

      const platform = fakePlatform({ argv: ['list', 'projects'], cwd: workspace.path, env });
      await createCholibaShell(platform, fakeRuntime()).run();
      for (const project of api.projects.list()) expect(platform.stdout.text()).toContain(project.name);
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
      const api = openCholiba({ cwd: workspace.path, env: { CHOL_GLOBAL_DIR: join(workspace.path, 'global') } });

      expect(() => api.projects.get('nada')).toThrow(
        `Projeto "nada" não encontrado (${join(workspace.projects, 'nada', 'config.json')} não existe).`,
      );
    } finally {
      workspace.cleanup();
    }
  });
});
