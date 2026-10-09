import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Test } from '@nestjs/testing';

import { complete, describe as describeWords, formatSuggestions } from '@choliba/core';
import { PlatformModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

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

/** `choliba projects <args…>` from `cwd`. */
async function projects(args: readonly string[], cwd: string): Promise<Run> {
  const platform = fakePlatform({ argv: ['projects', ...args], cwd });
  const exitCode = await runCommand([ProjectsModule], platform);
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

      const pending = await projects(['check', 'demo'], root);
      expect(pending.exitCode).toBe(1);
      expect(pending.err).toContain('troque CHANGE_ME em:');

      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify({ development: { TEST_USERNAME: 'ana' } }));
      const ready = await projects(['check', 'demo'], root);
      expect(ready.exitCode).toBe(0);
      expect(ready.out).toBe('Projeto "demo" (Demo) pronto: ambiente development, http://localhost:5173/\n');

      const missing = await projects(['check'], root);
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing project for check.');
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

      expect((await projects(['list'], root)).out).toBe(
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
      expect((await projects(['list'], root)).out).toContain('No project found');

      writeProject(projectsDir, 'zebra', ['02', '01']);
      writeProject(projectsDir, 'alpha');

      expect((await projects(['list'], root)).out).toBe('alpha\nzebra\n');
      expect((await projects(['list', '--tickets'], root)).out).toContain('zebra ["zebra-01","zebra-02"]');
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

  it("prints a command's own help", () =>
    withBrokenWorkspace(async (root) => {
      for (const command of ['list', 'check', 'report-folder']) {
        expect((await projects([command, '-h'], root)).out).toContain(`Usage:  choliba projects ${command}`);
      }
      for (const command of ['tickets-folder', 'ticket-specs']) {
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
      expect(completions(service, ['list', '--'])).toBe('--tickets');
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
      expect(describeWords(spec, ['list'])).toBe('Lista os projetos');
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
