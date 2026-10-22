import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { coreShell, formatSuggestions } from '@choliba/core';
import { fakePlatform, runShell, VERBS_ROOT } from '@choliba/core/testing';

import { projectsShell } from '../../projects/projects-shell';
import { projectsCommandsShell } from '../../../../choliba/src/commands/projects';
import { projectCompletions } from '../../tickets';

interface Workspace {
  readonly root: string;
  readonly projectsDir: string;
}

/** A workspace whose .env points CHOL_PROJECTS_DIR (and, when given, CHOL_TICKET_RUNS) at temp folders. */
function withWorkspace<T>(
  fn: (workspace: Workspace) => T | Promise<T>,
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
  return Promise.resolve(fn({ root, projectsDir })).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

/** A workspace without CHOL_GLOBAL_DIR: every location fails. */
function withBrokenWorkspace<T>(fn: (root: string) => T | Promise<T>): Promise<T> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cmd-broken-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  return Promise.resolve(fn(root)).finally(() => {
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

/** `choliba <args…>` from `cwd`. */
async function choliba(args: readonly string[], cwd: string): Promise<Run> {
  const platform = fakePlatform({ argv: [...args], cwd });
  const exitCode = await runShell([coreShell, projectsShell, projectsCommandsShell, VERBS_ROOT], platform);
  return { exitCode, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba list projects', () => {
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

      expect((await choliba(['list', 'projects'], root)).out).toBe(
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
      expect((await choliba(['list', 'projects'], root)).out).toContain('Nenhum projeto encontrado');

      writeProject(projectsDir, 'zebra', ['02', '01']);
      writeProject(projectsDir, 'alpha');

      expect((await choliba(['list', 'projects'], root)).out).toBe('alpha\nzebra\n');
      expect((await choliba(['list', 'projects', '--tickets'], root)).out).toContain('zebra ["zebra-01","zebra-02"]');
    }));

  it('prints its help, even without locations', () =>
    withBrokenWorkspace(async (root) => {
      for (const flag of ['--help', '-h']) {
        const { exitCode, out } = await choliba(['list', 'projects', flag], root);
        expect(exitCode).toBe(0);
        expect(out).toContain('Usage:  choliba list projects [OPTIONS]');
        expect(out).toContain('--tickets');
      }
    }));

  it('exits 1 with the message when the locations cannot be read', () =>
    withBrokenWorkspace(async (root) => {
      const { exitCode, err } = await choliba(['list', 'projects'], root);
      expect(exitCode).toBe(1);
      expect(err).toContain('CHOL_GLOBAL_DIR não definida');
    }));
});

describe('the types of new and list', () => {
  it('lists project under new and projects under list, each with its own help', () =>
    withBrokenWorkspace(async (root) => {
      expect((await choliba(['new', '--help'], root)).out).toContain('project   Cria um projeto a partir do modelo');
      expect((await choliba(['list', '--help'], root)).out).toContain('projects   Lista os projetos');
      expect((await choliba(['new', 'project', '--help'], root)).out).toContain(
        'Usage:  choliba new project [NOME] [OPTIONS]',
      );
    }));
});

describe('projectCompletions', () => {
  it('completes the projects, then the tickets of the one typed, from disk', () =>
    withWorkspace(({ projectsDir }) => {
      writeProject(projectsDir, 'demo', ['demo-01', 'demo-02']);
      writeProject(projectsDir, 'other');
      const { projectOnly, projectThenTicket } = projectCompletions(() => projectsDir);

      expect(formatSuggestions(projectOnly([]))).toBe('demo\nother');
      expect(formatSuggestions(projectOnly(['demo']))).toBe('');
      expect(formatSuggestions(projectThenTicket([]))).toBe('demo\nother');
      expect(formatSuggestions(projectThenTicket(['demo']))).toBe('demo-01\ndemo-02');
      expect(formatSuggestions(projectThenTicket(['demo', 'demo-01']))).toBe('');
    }));

  it('suggests nothing when the projects or tickets cannot be read', () =>
    withWorkspace(({ projectsDir }) => {
      writeProject(projectsDir, 'demo');
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets'), 'not a directory');
      expect(formatSuggestions(projectCompletions(() => projectsDir).projectThenTicket(['demo']))).toBe('');

      const broken = projectCompletions(() => {
        throw new Error('sem pasta');
      });
      expect(formatSuggestions(broken.projectOnly([]))).toBe('');
      expect(formatSuggestions(broken.projectThenTicket(['demo']))).toBe('');
    }));
});
