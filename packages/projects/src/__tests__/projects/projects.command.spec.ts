import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Test } from '@nestjs/testing';

import { complete, describe as describeWords, FILES_MARKER, formatSuggestions } from '@choliba/core';
import { PlatformModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

import { PROJECT_TEMPLATES_DIR } from '../../projects/projects.constants';
import { ProjectsModule, ProjectsService, TicketsService } from '../../nest';

interface Workspace {
  readonly root: string;
  readonly projectsDir: string;
}

/** A workspace whose .env points CHOL_PROJECTS_DIR (and, when given, CHOL_TICKET_RUNS) at temp folders. */
function withWorkspace<T>(
  fn: (workspace: Workspace) => Promise<T>,
  env: Readonly<Record<string, string>> = {},
): Promise<T> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cmd-'));
  const projectsDir = path.join(root, 'projects');
  fs.mkdirSync(projectsDir);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  const lines = { CHOL_GLOBAL_DIR: '/global', CHOL_PROJECTS_DIR: projectsDir, ...env };
  fs.writeFileSync(
    path.join(root, '.env'),
    Object.entries(lines)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
  return fn({ root, projectsDir }).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

/** A workspace without CHOL_GLOBAL_DIR: every location fails. */
function withBrokenWorkspace<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cmd-broken-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  return fn(root).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

function makeTemplatesDir(parent: string): string {
  const dir = path.join(parent, 'template');
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify({ name: 'Demo', envs: [{ nome: 'qa', baseURL: '', default: true }] }),
  );
  fs.writeFileSync(path.join(dir, '.env.example.json'), JSON.stringify({ qa: { TEST_USERNAME: 'CHANGE_ME' } }));
  return dir;
}

/** An application folder for --app-dir under `parent`, with `readme` as its README.md when given. */
function makeAppDir(parent: string, name: string, readme?: string): string {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true });
  if (readme !== undefined) fs.writeFileSync(path.join(dir, 'README.md'), readme);
  return dir;
}

function writeProject(projectsDir: string, name: string, tickets: string[] = []): void {
  const projectDir = path.join(projectsDir, name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'config.json'), '{}');
  fs.writeFileSync(path.join(projectDir, '.env.json'), '{}');
  if (tickets.length > 0) {
    const ticketsDir = path.join(projectDir, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
    for (const ticket of tickets) {
      fs.writeFileSync(path.join(ticketsDir, `${ticket}.json`), '{}');
    }
  }
}

interface Run {
  readonly exitCode: number;
  readonly out: string;
  readonly err: string;
}

/** `choliba projects <args…>` from `cwd`, optionally with another project template. */
async function projects(args: readonly string[], cwd: string, templatesDir?: string): Promise<Run> {
  const platform = fakePlatform({ argv: ['projects', ...args], cwd });
  const overrides = templatesDir === undefined ? [] : [{ provide: PROJECT_TEMPLATES_DIR, useValue: templatesDir }];
  const exitCode = await runCommand([ProjectsModule], platform, overrides);
  return { exitCode, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba projects', () => {
  it('checks that a project is ready, naming what is still CHANGE_ME', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const projectPath = path.join(projectsDir, 'demo');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'config.json'),
        JSON.stringify({
          name: 'Demo',
          envs: [{ nome: 'development', baseURL: 'http://localhost:5173/', appDir: '/app' }],
        }),
      );
      fs.writeFileSync(
        path.join(projectPath, '.env.json'),
        JSON.stringify({ development: { TEST_USERNAME: 'CHANGE_ME' } }),
      );

      const pending = await projects(['check-project', 'demo'], root);
      expect(pending.exitCode).toBe(1);
      expect(pending.err).toContain('troque CHANGE_ME em:');

      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify({ development: { TEST_USERNAME: 'ana' } }));
      const ready = await projects(['check-project', 'demo'], root);
      expect(ready.exitCode).toBe(0);
      expect(ready.out).toBe('Projeto "demo" (Demo) pronto: ambiente development, http://localhost:5173/\n');

      const missing = await projects(['check-project'], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing project for check-project.');
    }));

  it('prints the tickets folder for a project, and usage without one', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo');

      expect(await projects(['tickets-folder', 'demo'], root)).toEqual({
        exitCode: 0,
        out: `${path.join(projectsDir, 'demo', 'tickets')}\n`,
        err: '',
      });
      const missing = await projects(['tickets-folder'], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toBe("Missing project for tickets-folder.\nRun 'choliba projects --help' for usage.\n");
    }));

  it('prints the report folder: the default name, of a project, of a ticket', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo');

      expect((await projects(['report-folder'], root)).out).toBe('playwright-report\n');
      expect((await projects(['report-folder', 'demo'], root)).out).toBe(
        `${path.join(projectsDir, 'demo', 'ticket-runs', 'playwright-report')}\n`,
      );
      expect((await projects(['report-folder', 'demo', 'demo-T-01'], root)).out).toBe(
        `${path.join(projectsDir, 'demo', 'ticket-runs', 'demo-T-01', 'playwright-report')}\n`,
      );
    }));

  it('prints the report folder under CHOL_TICKET_RUNS when set', () =>
    withWorkspace(
      async ({ root }) => {
        expect((await projects(['report-folder', 'demo', 'demo-01'], root)).out).toBe(
          `${path.join('/runs', 'demo', 'ticket-runs', 'demo-01', 'playwright-report')}\n`,
        );
      },
      { CHOL_TICKET_RUNS: '/runs' },
    ));

  it('lists ticket spec files one per line, and usage without project and ticket', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo', ['T-01']);
      fs.writeFileSync(
        path.join(projectsDir, 'demo', 'tickets', 'T-01.json'),
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['alpha.spec.ts › d › CA-01: x'] }] }),
      );

      expect((await projects(['ticket-specs', 'demo', 'demo-T-01'], root)).out).toBe('alpha.spec.ts\n');
      const missing = await projects(['ticket-specs', 'demo'], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing project or ticket');
    }));

  it('lists each project with its description, laid out like --help', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'curto');
      fs.writeFileSync(path.join(projectsDir, 'curto', 'config.json'), JSON.stringify({ description: 'Curto.' }));
      writeProject(projectsDir, 'longo');
      fs.writeFileSync(
        path.join(projectsDir, 'longo', 'config.json'),
        JSON.stringify({ description: 'palavra '.repeat(15).trim() }),
      );
      writeProject(projectsDir, 'quebrado');
      fs.writeFileSync(path.join(projectsDir, 'quebrado', 'config.json'), '{ inválido');
      writeProject(projectsDir, 'sem-texto');
      fs.writeFileSync(path.join(projectsDir, 'sem-texto', 'config.json'), JSON.stringify({ description: 3 }));

      expect((await projects(['list-projects'], root)).out).toBe(
        [
          'curto       Curto.',
          '',
          `longo       ${'palavra '.repeat(8).trim()}`,
          `            ${'palavra '.repeat(7).trim()}`,
          '',
          'quebrado',
          '',
          'sem-texto',
          '',
        ].join('\n'),
      );
    }));

  it('lists projects and optionally their tickets, and says when there is none', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      expect((await projects(['list-projects'], root)).out).toContain('No project found');

      writeProject(projectsDir, 'zebra', ['02', '01']);
      writeProject(projectsDir, 'alpha');

      expect((await projects(['list-projects'], root)).out).toBe('alpha\nzebra\n');
      expect((await projects(['list-projects', '--tickets'], root)).out).toContain('zebra ["zebra-01","zebra-02"]');
    }));

  it('reports a missing or unknown command as a usage error', () =>
    withWorkspace(async ({ root }) => {
      const missing = await projects([], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing command');

      const unknown = await projects(['unknown-command'], root);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.err).toContain('Unknown command "unknown-command".');
    }));

  it('exits 1 with the message when the locations cannot be read', () =>
    withBrokenWorkspace(async (root) => {
      const { exitCode, err } = await projects(['tickets-folder', 'demo'], root);
      expect(exitCode).toBe(1);
      expect(err).toContain('CHOL_GLOBAL_DIR não definida');
    }));

  it('creates a project from the template, with the app dir and the description from its README', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const appDir = makeAppDir(root, 'demo-app', '# Demo\n\nApp de teste.\n');

      const { exitCode, out } = await projects(
        ['create-project', 'demo', '--app-dir', appDir],
        root,
        makeTemplatesDir(root),
      );

      expect(exitCode).toBe(0);
      const created = path.join(projectsDir, 'demo');
      expect(out).toBe(
        `Projeto "demo" criado em ${created}.\n` +
          `description preenchido a partir de ${path.join(appDir, 'README.md')}: "Demo: App de teste."\n` +
          `Antes de usar: crie ${path.join(created, '.env.json')} a partir de ${path.join(created, '.env.example.json')} ` +
          `e troque os valores CHANGE_ME (config.json e .env.json).\n`,
      );
      expect(fs.existsSync(path.join(created, '.env.json'))).toBe(false);
      const config = JSON.parse(fs.readFileSync(path.join(created, 'config.json'), 'utf-8')) as {
        description: string;
        envs: { appDir: string }[];
      };
      expect(config.description).toBe('Demo: App de teste.');
      expect(config.envs[0]?.appDir).toBe(appDir);
    }));

  it('says why the description stayed empty: no README, or a README without usable text', () =>
    withWorkspace(async ({ root }) => {
      const templatesDir = makeTemplatesDir(root);
      const noReadme = makeAppDir(root, 'sem-readme-app');
      const emptyReadme = makeAppDir(root, 'readme-vazio-app', '## Só seções\n\n- item\n');

      expect(
        (await projects(['create-project', 'sem-readme', '--app-dir', noReadme], root, templatesDir)).out,
      ).toContain(`Nenhum README na raiz de ${noReadme}; description ficou vazio.`);
      expect(
        (await projects(['create-project', 'readme-vazio', '--app-dir', emptyReadme], root, templatesDir)).out,
      ).toContain('não tem título nem parágrafo aproveitáveis; description ficou vazio.');
    }));

  it('requires --app-dir, with a value, and creates nothing for a folder that does not exist', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const templatesDir = makeTemplatesDir(root);
      const run = async (...args: string[]): Promise<string> => {
        const { exitCode, err } = await projects(['create-project', 'demo', ...args], root, templatesDir);
        expect(exitCode).toBe(1);
        return err;
      };

      expect(await run()).toContain('Missing --app-dir for create-project');
      expect(await run('--app-dir')).toContain('Missing value for --app-dir');
      expect(await run('--app-dir', path.join(projectsDir, 'nope'))).toContain('não é uma pasta existente');
      expect(await run('--base-url')).toContain('Missing value for --base-url');
      expect(fs.existsSync(path.join(projectsDir, 'demo'))).toBe(false);
    }));

  it('fills the base url when --base-url is given', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const appDir = makeAppDir(root, 'app');
      const { exitCode } = await projects(
        ['create-project', 'demo', '--base-url', 'https://qa.exemplo.com', '--app-dir', appDir],
        root,
        makeTemplatesDir(root),
      );

      expect(exitCode).toBe(0);
      const config = JSON.parse(fs.readFileSync(path.join(projectsDir, 'demo', 'config.json'), 'utf-8')) as {
        envs: { baseURL: string }[];
      };
      expect(config.envs[0]?.baseURL).toBe('https://qa.exemplo.com');
    }));

  it('names the project after the app folder, resolving a relative --app-dir from where it ran', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const appDir = makeAppDir(root, 'minha-app');

      const { exitCode, out } = await projects(
        ['create-project', '--app-dir', './minha-app/', '--base-url', 'http://x'],
        root,
        makeTemplatesDir(root),
      );

      expect(exitCode).toBe(0);
      expect(out).toContain(`Projeto "minha-app" criado em ${path.join(projectsDir, 'minha-app')}.`);
      const config = JSON.parse(fs.readFileSync(path.join(projectsDir, 'minha-app', 'config.json'), 'utf-8')) as {
        envs: { appDir: string }[];
      };
      expect(config.envs[0]?.appDir).toBe(appDir);
    }));

  it('takes the name from any position, never from a flag or a flag value', () =>
    withWorkspace(async ({ root }) => {
      const appDir = makeAppDir(root, 'app');
      const { out } = await projects(
        ['create-project', '--app-dir', appDir, '--base-url', 'http://x', 'nome'],
        root,
        makeTemplatesDir(root),
      );

      expect(out).toContain('Projeto "nome" criado');
    }));

  it('reports a project that already exists, or a missing template', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo');
      const appDir = makeAppDir(root, 'app');

      const exists = await projects(['create-project', 'demo', '--app-dir', appDir], root, makeTemplatesDir(root));
      expect(exists.exitCode).toBe(1);
      expect(exists.err).toContain('já existe');

      const noTemplate = await projects(
        ['create-project', 'novo', '--app-dir', appDir],
        root,
        path.join(root, 'sem-template'),
      );
      expect(noTemplate.exitCode).toBe(1);
      expect(noTemplate.err).toContain('Template de projeto não encontrado');
    }));

  it('creates a ticket from the type template, in the active environment of a ready project', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const projectPath = path.join(projectsDir, 'demo');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'config.json'),
        JSON.stringify({ name: 'Demo', envs: [{ nome: 'qa', baseURL: 'http://qa', appDir: '/app' }] }),
      );
      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify({ qa: { TEST_USERNAME: 'ana' } }));

      const created = await projects(['create-ticket', 'demo', 'story'], root);
      expect(created.exitCode).toBe(0);
      const file = path.join(projectPath, 'tickets', '1.json');
      expect(created.out).toBe(`Ticket "demo-1" criado em ${file}. Troque os valores CHANGE_ME.\n`);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({
        ticket: 'demo-1',
        tipo: 'story',
        ambiente: 'qa',
      });

      const unknown = await projects(['create-ticket', 'demo', 'spike'], root);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.err).toContain('Tipo de ticket "spike" não existe');

      const missing = await projects(['create-ticket', 'demo'], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing project or type for create-ticket.');
    }));
});

describe('choliba projects — help', () => {
  it('prints the full help for --help, -h and help, even without locations', () =>
    withBrokenWorkspace(async (root) => {
      for (const flag of ['--help', '-h', 'help']) {
        const { exitCode, out } = await projects([flag], root);
        expect(exitCode).toBe(0);
        expect(out).toContain('Usage:  choliba projects COMMAND [ARGS]');
        expect(out).toContain('Commands:\n  tickets-folder');
        expect(out).toContain("Run 'choliba projects COMMAND --help'");
      }
    }));

  it("prints a command's own help, for the project and the ticket commands", () =>
    withBrokenWorkspace(async (root) => {
      const project = await projects(['create-project', '--help'], root);
      expect(project.exitCode).toBe(0);
      expect(project.out).toContain('Usage:  choliba projects create-project [PROJECT] --app-dir DIR [OPTIONS]');
      expect(project.out).toContain('--base-url url');

      for (const command of ['list-projects', 'check-project', 'report-folder']) {
        expect((await projects([command, '-h'], root)).out).toContain(`Usage:  choliba projects ${command}`);
      }
      for (const command of ['tickets-folder', 'ticket-specs', 'create-ticket']) {
        expect((await projects([command, '--help'], root)).out).toContain(`Usage:  choliba projects ${command}`);
      }
    }));

  it('keeps reporting an unknown command even with --help', () =>
    withBrokenWorkspace(async (root) => {
      const { exitCode, err } = await projects(['bogus', '--help'], root);
      expect(exitCode).toBe(1);
      expect(err).toContain('Unknown command "bogus".');
      expect(err).toContain("Run 'choliba projects --help' for usage.");
    }));
});

describe('ProjectsService.helpSpec — completion and description', () => {
  async function serviceIn(cwd: string): Promise<ProjectsService> {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(fakePlatform({ cwd })), ProjectsModule],
    }).compile();
    return moduleRef.get(ProjectsService);
  }

  const completions = (service: ProjectsService, words: readonly string[]): string =>
    formatSuggestions(complete(service.helpSpec(), words));

  it('completes commands, projects, tickets, ticket types and flags from disk', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo', ['demo-01', 'demo-02']);
      writeProject(projectsDir, 'other');
      const service = await serviceIn(root);

      expect(completions(service, ['ti'])).toBe('tickets-folder\nticket-specs');
      expect(completions(service, ['tickets-folder', ''])).toBe('demo\nother');
      expect(completions(service, ['tickets-folder', 'demo', ''])).toBe('');
      expect(completions(service, ['report-folder', 'd'])).toBe('demo');
      expect(completions(service, ['ticket-specs', 'demo', ''])).toBe('demo-01\ndemo-02');
      expect(completions(service, ['ticket-specs', 'demo', 'demo-01', ''])).toBe('');
      expect(completions(service, ['list-projects', '--'])).toBe('--tickets');
      expect(completions(service, ['create-ticket', ''])).toBe('demo\nother');
      expect(completions(service, ['create-ticket', 'demo', ''])).toBe('bug\nimprovement\nstory\ntask');
      expect(completions(service, ['create-ticket', 'demo', 'bug', ''])).toBe('');
      expect(completions(service, ['create-project', 'novo', '--app-dir', ''])).toBe(FILES_MARKER);
    }));

  it('completes the ticket commands too, as they belong to the same CLI', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo');
      const moduleRef = await Test.createTestingModule({
        imports: [PlatformModule.forRoot(fakePlatform({ cwd: root })), ProjectsModule],
      }).compile();

      expect(formatSuggestions(complete(moduleRef.get(ProjectsService).helpSpec(), ['tickets-folder', '']))).toBe(
        'demo',
      );
      expect(formatSuggestions(complete(moduleRef.get(TicketsService).helpSpec(), ['ticket-specs', '']))).toBe('demo');
    }));

  it('describes the CLI or the command the words select', () =>
    withBrokenWorkspace(async (root) => {
      const spec = (await serviceIn(root)).helpSpec();
      expect(describeWords(spec, [])).toBe('Resolve pastas e arquivos dos projetos Playwright em CHOL_PROJECTS_DIR.');
      expect(describeWords(spec, ['create-project'])).toBe('Cria um projeto novo a partir do template');
    }));

  it('suggests nothing when the projects or tickets cannot be read', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      writeProject(projectsDir, 'demo');
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets'), 'not a directory');
      expect(completions(await serviceIn(root), ['ticket-specs', 'demo', ''])).toBe('');

      await withBrokenWorkspace(async (broken) => {
        const service = await serviceIn(broken);
        expect(completions(service, ['tickets-folder', ''])).toBe('');
        expect(completions(service, ['ticket-specs', 'demo', ''])).toBe('');
      });
    }));
});
