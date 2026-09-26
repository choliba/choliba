import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { allFine, checkAgents, checkProjects, checkWorkspace, formatCheck } from '../check';

const FIXTURES = path.join(__dirname, '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures', 'agents');

function withWorkspace(run: (root: string) => Promise<void> | void): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-check-'));
  return Promise.resolve(run(root)).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

function copyAgent(root: string, fixture: string, as = fixture): void {
  fs.cpSync(path.join(FIXTURES, fixture), path.join(root, 'agents', as), { recursive: true });
}

function writeProject(projectsDir: string, name: string, baseURL: string): void {
  const dir = path.join(projectsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify({ name, envs: [{ nome: 'qa', baseURL, appDir: 'app' }] }),
  );
  fs.writeFileSync(path.join(dir, '.env.json'), JSON.stringify({ qa: { TEST_USERNAME: 'u' } }));
}

describe('checkAgents', () => {
  it('loads every agent as a run would, reporting what is wrong with each', async () => {
    await withWorkspace(async (root) => {
      copyAgent(root, 'reviewer');
      copyAgent(root, 'schema-invalid-xml', 'invalido');
      copyAgent(root, 'echo', 'sem-skill');
      copyAgent(root, 'reviewer', 'com-mcp');
      fs.appendFileSync(path.join(root, 'agents', 'com-mcp', 'agent.yaml'), 'mcps: [app]\n');
      fs.mkdirSync(path.join(root, '.agents', 'mcps'), { recursive: true });
      fs.writeFileSync(path.join(root, '.agents', 'mcps', 'app.json'), JSON.stringify({ command: '${APP_DIR}/x' }));
      fs.mkdirSync(path.join(root, 'agents', '_rascunho'));

      const section = await checkAgents(root, {});
      expect(section.title).toBe(`Agentes (${path.join(root, 'agents')})`);
      expect(section.items.map((item) => item.name)).toEqual(['com-mcp', 'invalido', 'reviewer', 'sem-skill']);
      const problem = (name: string): string | undefined => section.items.find((item) => item.name === name)?.problem;
      expect(problem('reviewer')).toBeUndefined();
      expect(problem('invalido')).toContain('failed schema validation');
      expect(problem('sem-skill')).toContain('skill "dummy-skill" não encontrada');
      expect(problem('com-mcp')).toContain('usa ${APP_DIR}, sem valor');

      expect(
        (await checkAgents(root, { APP_DIR: '/opt' })).items.find((item) => item.name === 'com-mcp')?.problem,
      ).toBe(undefined);
    });
  });

  it('says when the agents folder does not exist', async () => {
    await withWorkspace(async (root) => {
      expect((await checkAgents(root, {})).items).toEqual([
        { name: path.join(root, 'agents'), problem: 'a pasta não existe' },
      ]);
    });
  });
});

describe('checkProjects', () => {
  it('checks each project, and reports a missing GLOBAL_DIR or projects folder', async () => {
    await withWorkspace((root) => {
      expect(checkProjects(root, {}).items[0]?.problem).toContain('GLOBAL_DIR não definida');
      expect(checkProjects(root, { GLOBAL_DIR: root }).items).toEqual([
        { name: path.join(root, 'projects'), problem: 'a pasta não existe' },
      ]);

      writeProject(path.join(root, 'projects'), 'pronto', 'http://x');
      writeProject(path.join(root, 'projects'), 'pendente', 'CHANGE_ME');
      const section = checkProjects(root, { GLOBAL_DIR: root });
      expect(section.title).toBe(`Projetos (${path.join(root, 'projects')})`);
      expect(section.items[0]).toEqual({ name: 'pendente', problem: expect.stringContaining('CHANGE_ME') as unknown });
      expect(section.items[1]).toEqual({ name: 'pronto' });
    });
  });
});

describe('checkWorkspace / formatCheck / allFine', () => {
  it('reports agents then projects, with problems indented under their item', async () => {
    await withWorkspace(async (root) => {
      copyAgent(root, 'reviewer');
      fs.mkdirSync(path.join(root, 'projects'));

      const fine = await checkWorkspace(root, { GLOBAL_DIR: root });
      expect(allFine(fine)).toBe(true);
      expect(formatCheck(fine)).toBe(
        [
          `Agentes (${path.join(root, 'agents')})`,
          '  ✓ reviewer',
          '',
          `Projetos (${path.join(root, 'projects')})`,
          '  (nenhum)',
        ].join('\n'),
      );

      const broken = [{ title: 'T', items: [{ name: 'x', problem: 'linha 1\nlinha 2' }] }];
      expect(allFine(broken)).toBe(false);
      expect(formatCheck(broken)).toBe('T\n  ✗ x: linha 1\n      linha 2');
    });
  });
});
