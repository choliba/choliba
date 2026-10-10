import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { complete, coreShell, FILES_MARKER, formatSuggestions, type Ask } from '@choliba/core';
import { fakePlatform, runShell } from '@choliba/core/testing';

import { projectsShell } from '../../projects/projects-shell';
import { projectsCliSpec } from '../../projects/projects-spec';

interface Workspace {
  readonly root: string;
  readonly projectsDir: string;
  /** An application folder, with a README whose title becomes the project's description. */
  readonly app: string;
}

function withWorkspace(fn: (workspace: Workspace) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-new-'));
  const projectsDir = path.join(root, 'projects');
  const app = path.join(root, 'apps', 'Minha App');
  fs.mkdirSync(projectsDir);
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'README.md'), '# Loja\n\nA loja de exemplo.\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  fs.writeFileSync(path.join(root, '.env'), `CHOL_GLOBAL_DIR=/global\nCHOL_PROJECTS_DIR=${projectsDir}\n`);
  return fn({ root, projectsDir, app }).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

/** An `ask` that answers in order and records each question. */
function answering(answers: readonly string[]): { ask: Ask; questions: string[] } {
  const queue = [...answers];
  const questions: string[] = [];
  return {
    questions,
    ask: (question) => {
      questions.push(question);
      return Promise.resolve(queue.shift() ?? '');
    },
  };
}

async function projectsNew(
  root: string,
  args: readonly string[],
  ask?: Ask,
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({
    argv: ['projects', 'new', ...args],
    cwd: root,
    ...(ask === undefined ? {} : { ask }),
  });
  const code = await runShell([coreShell, projectsShell], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

interface WrittenConfig {
  readonly name: string;
  readonly description: string;
  readonly envs: readonly { readonly baseURL: string; readonly appDir: string }[];
}

function config(projectsDir: string, project: string): WrittenConfig {
  return JSON.parse(fs.readFileSync(path.join(projectsDir, project, 'config.json'), 'utf8')) as WrittenConfig;
}

describe('choliba projects new', () => {
  it('prints its help', () =>
    withWorkspace(async ({ root }) => {
      const { code, out } = await projectsNew(root, ['--help']);
      expect(code).toBe(0);
      expect(out).toContain('Usage:  choliba projects new [NOME] [OPTIONS]');
      expect(out).toContain('--app-dir');
      expect(out).toContain('--base-url');
      expect(out).toContain('--no-input');
    }));

  it('creates the project from the name and flags, asking nothing', () =>
    withWorkspace(async ({ root, projectsDir, app }) => {
      const { ask, questions } = answering([]);
      const { code, out } = await projectsNew(
        root,
        ['loja', '--app-dir', path.relative(root, app), '--base-url', 'http://localhost:3000'],
        ask,
      );
      expect(code).toBe(0);
      expect(questions).toEqual([]);
      expect(config(projectsDir, 'loja')).toMatchObject({
        name: 'loja',
        description: 'Loja: A loja de exemplo.',
        envs: [{ baseURL: 'http://localhost:3000', appDir: app }],
      });
      expect(fs.existsSync(path.join(projectsDir, 'loja', 'tests'))).toBe(true);
      expect(fs.existsSync(path.join(projectsDir, 'loja', 'tickets'))).toBe(true);
      expect(fs.existsSync(path.join(projectsDir, 'loja', '.env.json'))).toBe(false);
      expect(out).toContain(`Projeto "loja" criado em ${path.join(projectsDir, 'loja')}.`);
      expect(out).toContain('.env.example.json');
      expect(out).toContain('bunx choliba projects check loja');
      expect(out).not.toContain('Falta preencher');
    }));

  it('names the project after the application folder and leaves what is missing as CHANGE_ME', () =>
    withWorkspace(async ({ root, projectsDir, app }) => {
      const { code, out } = await projectsNew(root, ['--app-dir', app]);
      expect(code).toBe(0);
      expect(config(projectsDir, 'minha-app').envs[0]).toEqual(
        expect.objectContaining({ appDir: app, baseURL: 'CHANGE_ME' }),
      );
      expect(out).toContain('Falta preencher no config.json: baseURL.');
    }));

  it('creates a project from its name alone, with the application left to fill in', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      const { code, out } = await projectsNew(root, ['so-nome']);
      expect(code).toBe(0);
      expect(config(projectsDir, 'so-nome').envs[0]).toEqual(
        expect.objectContaining({ appDir: 'CHANGE_ME', baseURL: 'CHANGE_ME' }),
      );
      expect(out).toContain('Falta preencher no config.json: appDir e baseURL.');
    }));

  it('asks, on a terminal, only for what is missing, the name defaulting to the application folder', () =>
    withWorkspace(async ({ root, projectsDir, app }) => {
      const { ask, questions } = answering([app, '', 'http://localhost:4000']);
      const { code } = await projectsNew(root, [], ask);
      expect(code).toBe(0);
      expect(questions).toEqual([
        expect.stringContaining('Pasta da aplicação'),
        expect.stringContaining('Nome do projeto (minha-app)'),
        expect.stringContaining('URL base'),
      ]);
      expect(config(projectsDir, 'minha-app').envs[0]).toEqual(
        expect.objectContaining({ appDir: app, baseURL: 'http://localhost:4000' }),
      );

      const named = answering(['', 'http://localhost:5000']);
      expect((await projectsNew(root, ['outra'], named.ask)).code).toBe(0);
      expect(named.questions).toEqual([
        expect.stringContaining('Pasta da aplicação'),
        expect.stringContaining('URL base'),
      ]);
      expect(config(projectsDir, 'outra').envs[0]).toEqual(
        expect.objectContaining({ appDir: 'CHANGE_ME', baseURL: 'http://localhost:5000' }),
      );
    }));

  it('says why the description stayed empty: no README, or one with nothing to use', () =>
    withWorkspace(async ({ root }) => {
      const bare = path.join(root, 'apps', 'sem-readme');
      const empty = path.join(root, 'apps', 'readme-vazio');
      fs.mkdirSync(bare, { recursive: true });
      fs.mkdirSync(empty, { recursive: true });
      fs.writeFileSync(path.join(empty, 'README.md'), '```\ncódigo\n```\n');
      expect((await projectsNew(root, ['--app-dir', bare])).out).toContain('Nenhum README na raiz');
      expect((await projectsNew(root, ['--app-dir', empty])).out).toContain('não tem título nem parágrafo');
    }));

  it('completes the value of --app-dir with file names', () =>
    withWorkspace(({ projectsDir }) => {
      const spec = projectsCliSpec(() => projectsDir);
      expect(formatSuggestions(complete(spec, ['new', '--app-dir', '']))).toContain(FILES_MARKER);
      return Promise.resolve();
    }));

  it('fails naming NOME when nothing gives a name: no terminal, --no-input, or a blank answer', () =>
    withWorkspace(async ({ root }) => {
      const none = await projectsNew(root, []);
      expect(none.code).toBe(1);
      expect(none.err).toContain('NOME');

      const { ask, questions } = answering([]);
      const noInput = await projectsNew(root, ['--no-input'], ask);
      expect(noInput.err).toContain('NOME');
      expect(questions).toEqual([]);

      const blank = await projectsNew(root, [], answering(['', '', '']).ask);
      expect(blank.err).toContain('NOME');
    }));

  it('refuses a bad name, an existing project, a missing folder, a flag without value and an unknown one', () =>
    withWorkspace(async ({ root, projectsDir }) => {
      expect((await projectsNew(root, ['../fora'])).err).toContain('nome inválido');
      fs.mkdirSync(path.join(projectsDir, 'loja'));
      fs.writeFileSync(path.join(projectsDir, 'loja', 'config.json'), '{}');
      expect((await projectsNew(root, ['loja'])).err).toContain('já existe');
      expect((await projectsNew(root, ['nova', '--app-dir', 'nao-existe'])).err).toContain('não é uma pasta existente');
      expect((await projectsNew(root, ['nova', '--base-url'])).err).toContain('--base-url precisa de um valor');
      expect((await projectsNew(root, ['nova', '--porta', '1'])).err).toContain('opção desconhecida: --porta');
      expect((await projectsNew(root, ['a', 'b'])).err).toContain('um projeto só');
    }));
});
