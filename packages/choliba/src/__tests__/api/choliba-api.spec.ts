import { join } from 'node:path';

import { agentsConfig } from '@choliba/agents';
import { defineConfig } from '@choliba/config';
import { fakePlatform } from '@choliba/core/testing';
import { sandboxConfig } from '@choliba/sandbox';

import { createCholibaShell, openCholiba } from '../../app-shell';
import { choliba } from '../../index';
import { fakeRuntime } from '../helpers/runtime';
import { makeWorkspace } from '../helpers/workspace';

const ECHO = `version: 1

agent:
  id: echo
  name: Echo Agent
  version: 1.0.0
  description: Repete a tarefa recebida.

models:
  - modelo-a

role: |
  Você repete a tarefa.
context:
  - Nada.
input: |
  A tarefa.
flow: |
  1. Repita.
output: |
  A tarefa.
notes:
  - Fixture.
skills:
  repeat:
    instructions: Use sempre.

permissions:
  deny:
    write: [agents/]
`;

const REPEAT = '---\nname: repeat\ndescription: Repete o texto.\n---\n# Repeat\n';
const OTHER = '---\nname: other\ndescription: Outra skill.\n---\n';

/** A workspace with the echo agent and two skills in the default folders, plus `files`. */
function workspaceWith(files: Readonly<Record<string, string>> = {}): ReturnType<typeof makeWorkspace> {
  return makeWorkspace({
    '.choliba/agents/echo/agent.yaml': ECHO,
    '.choliba/skills/repeat/SKILL.md': REPEAT,
    '.choliba/skills/other/SKILL.md': OTHER,
    ...files,
  });
}

describe('openCholiba', () => {
  it('finds the root from any folder inside the workspace', () => {
    const workspace = workspaceWith({ 'deep/inside/.keep': '' });
    try {
      expect(openCholiba({ cwd: join(workspace.path, 'deep', 'inside'), env: {} }).root).toBe(workspace.path);
    } finally {
      workspace.cleanup();
    }
  });

  it('reads nothing until a member is used, and fails outside a workspace only then', () => {
    const outside = openCholiba({ cwd: '/', env: {} });

    expect(() => outside.root).toThrow('Nenhuma pasta de trabalho do choliba acima de /');
    expect(() => outside.agents.list()).toThrow('Nenhuma pasta de trabalho');
  });

  it('reads a group from the environment first, then the .env, then the default', () => {
    const workspace = workspaceWith({ '.env': 'CHOL_SANDBOX=docker\nMEU_RETRIES=5\n' });
    try {
      const api = openCholiba({ cwd: workspace.path, env: { CHOL_NETWORK: 'host' } });
      const mine = defineConfig('meu-script', {
        retries: { env: 'MEU_RETRIES', type: 'number', description: 'tentativas', default: 3 },
      });

      expect(api.config(sandboxConfig)).toEqual({ mode: 'docker', image: 'choliba-agent', network: 'host' });
      expect(api.config(agentsConfig).provider).toBe('auto');
      expect(api.config(mine).retries).toBe(5);
    } finally {
      workspace.cleanup();
    }
  });

  it('fails on a wrong value naming the key and where it came from', () => {
    const workspace = workspaceWith({ '.env': 'CHOL_SANDBOX=vm\n' });
    try {
      expect(() => openCholiba({ cwd: workspace.path, env: {} }).config(sandboxConfig)).toThrow(
        '.env: CHOL_SANDBOX: valor inválido ("vm")',
      );
    } finally {
      workspace.cleanup();
    }
  });

  it('lists every key of choliba with its origin, credentials masked', () => {
    const workspace = workspaceWith({ '.env': 'CHOL_SANDBOX=docker\nCURSOR_API_KEY=segredo\n' });
    try {
      const settings = openCholiba({ cwd: workspace.path, env: {} }).config.list();
      const byEnv = new Map(settings.map((setting) => [setting.key.address.env, setting]));

      expect(byEnv.get('CHOL_SANDBOX')).toMatchObject({ value: 'docker', origin: '.env' });
      expect(byEnv.get('CHOL_AGENTS_PROVIDER')).toMatchObject({ value: 'auto', origin: 'padrão' });
      expect(byEnv.get('CURSOR_API_KEY')).toMatchObject({ value: undefined, isSet: true, origin: '.env' });
      expect(byEnv.has('CHOL_COLORS')).toBe(true);
      expect(JSON.stringify(settings)).not.toContain('segredo');
    } finally {
      workspace.cleanup();
    }
  });

  it('gives the agents and skills folders, absolute, from the configuration or the defaults', () => {
    const workspace = workspaceWith();
    try {
      const defaults = openCholiba({ cwd: workspace.path, env: {} });
      const relative = openCholiba({ cwd: workspace.path, env: { CHOL_AGENTS_DIR: 'meus/agentes' } });
      const absolute = openCholiba({ cwd: workspace.path, env: { CHOL_SKILLS_DIR: '/opt/skills' } });

      expect(defaults.agents.dir).toBe(join(workspace.path, '.choliba', 'agents'));
      expect(defaults.skills.dir).toBe(join(workspace.path, '.choliba', 'skills'));
      expect(relative.agents.dir).toBe(join(workspace.path, 'meus', 'agentes'));
      expect(absolute.skills.dir).toBe('/opt/skills');
    } finally {
      workspace.cleanup();
    }
  });

  it('lists and gets the agents, and the skills an agent declares', () => {
    const workspace = workspaceWith();
    try {
      const api = openCholiba({ cwd: workspace.path, env: {} });
      const repeat = join(workspace.path, '.choliba', 'skills', 'repeat', 'SKILL.md');

      expect(api.agents.list().map((agent) => agent.id)).toEqual(['echo']);
      expect(api.agents.get('echo')).toMatchObject({ id: 'echo', version: '1.0.0', supportedModels: ['modelo-a'] });
      expect(() => api.agents.get('revisor')).toThrow('agent "revisor" not found');
      expect(api.agents.skills('echo')).toEqual([
        { name: 'repeat', description: 'Repete o texto.', path: repeat, instructions: 'Use sempre.' },
      ]);
    } finally {
      workspace.cleanup();
    }
  });

  it('lists and gets the skills', () => {
    const workspace = workspaceWith();
    try {
      const api = openCholiba({ cwd: workspace.path, env: {} });

      expect(api.skills.list().map((skill) => skill.name)).toEqual(['other', 'repeat']);
      expect(api.skills.get('repeat')).toEqual({
        name: 'repeat',
        description: 'Repete o texto.',
        path: join(workspace.path, '.choliba', 'skills', 'repeat', 'SKILL.md'),
      });
      expect(() => api.skills.get('inexistente')).toThrow('skill "inexistente" não encontrada');
    } finally {
      workspace.cleanup();
    }
  });

  it('answers as the CLI does, for the agents and the configuration', async () => {
    const workspace = workspaceWith({ '.env': 'CHOL_SANDBOX=docker\n' });
    try {
      const api = openCholiba({ cwd: workspace.path, env: {} });
      const platform = fakePlatform({ argv: ['list', 'config', '--json'], cwd: workspace.path, env: {} });
      await createCholibaShell(platform, fakeRuntime()).run();
      const listed = JSON.parse(platform.stdout.text()) as Record<string, { valor: string | null; origem: string }>;

      expect(Object.keys(listed)).toEqual(api.config.list().map((setting) => setting.key.address.env));
      for (const setting of api.config.list()) {
        expect(listed[setting.key.address.env]?.origem).toBe(setting.origin);
      }

      const agents = fakePlatform({ argv: ['list', 'agents'], cwd: workspace.path, env: {} });
      await createCholibaShell(agents, fakeRuntime()).run();
      for (const agent of api.agents.list()) expect(agents.stdout.text()).toContain(agent.id);
    } finally {
      workspace.cleanup();
    }
  });
});

describe('choliba', () => {
  it('is the facade of the process, read only when used', () => {
    expect(choliba.root).toBe(openCholiba({ cwd: process.cwd() }).root);
  });

  it('reads the process environment when given none', () => {
    const workspace = workspaceWith();
    const before = process.env['CHOL_AGENTS_DIR'];
    process.env['CHOL_AGENTS_DIR'] = 'do-processo';
    try {
      expect(openCholiba({ cwd: workspace.path }).agents.dir).toBe(join(workspace.path, 'do-processo'));
    } finally {
      if (before === undefined) delete process.env['CHOL_AGENTS_DIR'];
      else process.env['CHOL_AGENTS_DIR'] = before;
      workspace.cleanup();
    }
  });
});
