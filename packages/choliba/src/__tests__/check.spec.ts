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

/** A fixture agent under `app/agents/<as>` (the default agents folder), its `agent.id` renamed to match the folder. */
function copyAgent(root: string, fixture: string, as = fixture): void {
  const dir = path.join(root, 'app', 'agents', as);
  fs.cpSync(path.join(FIXTURES, fixture), dir, { recursive: true });
  const yaml = path.join(dir, 'agent.yaml');
  fs.writeFileSync(yaml, fs.readFileSync(yaml, 'utf8').replace(`  id: ${fixture}\n`, `  id: ${as}\n`));
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
    await withWorkspace((root) => {
      copyAgent(root, 'reviewer');
      copyAgent(root, 'missing-sections', 'invalido');
      copyAgent(root, 'echo', 'sem-skill');
      copyAgent(root, 'reviewer', 'com-mcp');
      fs.appendFileSync(path.join(root, 'app', 'agents', 'com-mcp', 'agent.yaml'), 'mcps: [app]\n');
      fs.mkdirSync(path.join(root, 'app', 'mcps'), { recursive: true });
      fs.writeFileSync(path.join(root, 'app', 'mcps', 'app.json'), JSON.stringify({ command: '${APP_DIR}/x' }));
      fs.mkdirSync(path.join(root, 'app', 'agents', '_rascunho'));

      const section = checkAgents(root, {});
      expect(section.title).toBe(`Agentes (${path.join(root, 'app', 'agents')})`);
      expect(section.items.map((item) => item.name)).toEqual(['com-mcp', 'invalido', 'reviewer', 'sem-skill']);
      const problem = (name: string): string | undefined => section.items.find((item) => item.name === name)?.problem;
      expect(problem('reviewer')).toBeUndefined();
      expect(problem('invalido')).toContain("must have required property 'role'");
      expect(problem('sem-skill')).toContain('skill "dummy-skill" não encontrada');
      expect(problem('com-mcp')).toContain('usa ${APP_DIR}, sem valor');

      expect(checkAgents(root, { APP_DIR: '/opt' }).items.find((item) => item.name === 'com-mcp')?.problem).toBe(
        undefined,
      );
    });
  });

  it('says when the agents folder does not exist', async () => {
    await withWorkspace((root) => {
      expect(checkAgents(root, {}).items).toEqual([
        { name: path.join(root, 'app', 'agents'), problem: 'a pasta não existe' },
      ]);
    });
  });
});

describe('checkProjects', () => {
  it('checks each project, and reports a missing CHOL_GLOBAL_DIR or projects folder', async () => {
    await withWorkspace((root) => {
      expect(checkProjects(root, {}).items[0]?.problem).toContain('CHOL_GLOBAL_DIR não definida');
      expect(checkProjects(root, { CHOL_GLOBAL_DIR: root }).items).toEqual([
        { name: path.join(root, 'projects'), problem: 'a pasta não existe' },
      ]);

      writeProject(path.join(root, 'projects'), 'pronto', 'http://x');
      writeProject(path.join(root, 'projects'), 'pendente', 'CHANGE_ME');
      const section = checkProjects(root, { CHOL_GLOBAL_DIR: root });
      expect(section.title).toBe(`Projetos (${path.join(root, 'projects')})`);
      expect(section.items[0]).toEqual({ name: 'pendente', problem: expect.stringContaining('CHANGE_ME') as unknown });
      expect(section.items[1]).toEqual({ name: 'pronto' });
    });
  });
});

describe('checkWorkspace / formatCheck / allFine', () => {
  it('reports agents then projects, with problems indented under their item', async () => {
    await withWorkspace((root) => {
      copyAgent(root, 'reviewer');
      fs.mkdirSync(path.join(root, 'projects'));

      const fine = checkWorkspace(root, { CHOL_GLOBAL_DIR: root });
      expect(allFine(fine)).toBe(true);
      expect(formatCheck(fine)).toBe(
        [
          `Agentes (${path.join(root, 'app', 'agents')})`,
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
