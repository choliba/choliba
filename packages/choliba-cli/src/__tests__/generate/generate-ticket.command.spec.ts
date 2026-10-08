import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { RuntimeModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

import { GenerateModule } from '../../generate/nest';
import { fakeRuntime } from '../helpers/runtime';

function workspace(): { root: string; projectsDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-ticket-'));
  const projectsDir = path.join(root, 'projects');
  const project = path.join(projectsDir, 'demo');
  const appDir = path.join(root, 'app');
  mkdirSync(appDir, { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  writeFileSync(
    path.join(root, '.env'),
    `CHOL_GLOBAL_DIR=${path.join(root, 'global')}\nCHOL_PROJECTS_DIR=${projectsDir}\n`,
  );
  writeFileSync(
    path.join(project, 'config.json'),
    `${JSON.stringify(
      {
        name: 'demo',
        description: 'Demo',
        envs: [{ nome: 'development', baseURL: 'http://localhost:3000', appDir, default: true }],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(project, '.env.json'),
    `${JSON.stringify({ development: { TEST_USERNAME: 'ana', TEST_PASSWORD: 'segredo' } }, null, 2)}\n`,
  );
  return { root, projectsDir };
}

async function run(cwd: string, argv: readonly string[]): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['generate', ...argv], cwd });
  const code = await runCommand([RuntimeModule.forRoot(fakeRuntime()), GenerateModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba generate ticket', () => {
  let root: string;
  let projectsDir: string;
  beforeEach(() => {
    ({ root, projectsDir } = workspace());
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('prints its help with the ticket types', async () => {
    const ran = await run(root, ['ticket', '--help']);
    expect(ran.code).toBe(0);
    expect(ran.out).toContain('Usage:  choliba generate ticket PROJECT TYPE');
    expect(ran.out).toContain('story');
  });

  it('creates a ticket from the type template, in the active environment', async () => {
    const ran = await run(root, ['ticket', 'demo', 'story']);
    const file = path.join(projectsDir, 'demo', 'tickets', '1.json');
    const json = JSON.parse(readFileSync(file, 'utf8')) as { ticket: string; tipo: string; ambiente: string };
    expect(ran.code).toBe(0);
    expect(ran.out).toContain(`Ticket "demo-1" criado em ${file}.`);
    expect(json).toMatchObject({ ticket: 'demo-1', tipo: 'story', ambiente: 'development' });
  });

  it('fails when the project or the type is missing, unknown or not ready', async () => {
    const usage = await run(root, ['ticket', 'demo']);
    expect(usage.code).toBe(1);
    expect(usage.err).toContain("Run 'choliba generate ticket --help' for usage.");

    const type = await run(root, ['ticket', 'demo', 'epico']);
    expect(type.code).toBe(1);
    expect(type.err).toContain('não existe');

    const absent = await run(root, ['ticket', 'outro', 'bug']);
    expect(absent.code).toBe(1);
    expect(absent.err).toContain('não encontrado');
  });
});
