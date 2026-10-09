import { complete, formatSuggestions } from '@choliba/core';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { RuntimeModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

import { generateArgs } from '../../generate/generate-args';
import { GENERATE_PROJECT_HELP, generateHelp } from '../../generate/generate-spec';
import { GenerateModule } from '../../generate/nest';
import type { CliRuntime } from '../../runtime';
import type { Prompter } from '../../runtime/prompter';
import { fakeRuntime } from '../helpers/runtime';

interface Workspace {
  readonly root: string;
  readonly projectsDir: string;
  readonly appDir: string;
}

function workspace(): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-generate-'));
  const projectsDir = path.join(root, 'projects');
  const appDir = path.join(root, 'app');
  mkdirSync(projectsDir);
  mkdirSync(appDir);
  writeFileSync(path.join(appDir, 'README.md'), '# Minha app\n\nFaz buscas.\n');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  writeFileSync(
    path.join(root, '.env'),
    `CHOL_GLOBAL_DIR=${path.join(root, 'global')}\nCHOL_PROJECTS_DIR=${projectsDir}\n`,
  );
  return { root, projectsDir, appDir };
}

async function run(
  cwd: string,
  argv: readonly string[],
  word = 'generate',
  runtime: Partial<CliRuntime> = {},
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: [word, ...argv], cwd });
  const code = await runCommand([RuntimeModule.forRoot(fakeRuntime(runtime)), GenerateModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

function answering(replies: readonly string[]): Prompter {
  const pending = [...replies];
  return {
    text: () => Promise.resolve(pending.shift() ?? ''),
    select: (_question, _choices, fallback) => Promise.resolve(fallback),
    multiselect: () => Promise.resolve([]),
  };
}

describe('generate project args and help', () => {
  it('reads the words after the type, and completes the folder of --app-dir', () => {
    expect(generateArgs(['project', 'demo'], 'project')).toEqual([]);
    expect(generateArgs(['g', 'project', '--app-dir', 'app'], 'project')).toEqual(['--app-dir', 'app']);
    expect(formatSuggestions(complete(generateHelp([]), ['project', '']))).toContain('--app-dir');
    expect(typeof formatSuggestions(complete(GENERATE_PROJECT_HELP, ['--app-dir', '']))).toBe('string');
  });
});

describe('choliba generate project', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = workspace();
  });
  afterEach(() => {
    rmSync(ws.root, { recursive: true, force: true });
  });

  it('prints its help, also through the alias g', async () => {
    for (const word of ['generate', 'g']) {
      const ran = await run(ws.root, ['project', '--help'], word);
      expect(ran.code).toBe(0);
      expect(ran.out).toContain('Usage:  choliba generate project [PROJECT] [OPTIONS]');
      expect(ran.out).toContain('choliba generate project');
      expect(ran.out).toContain('--no-input');
      expect(ran.out).toContain('--base-url');
    }
  });

  it('creates the project from the template, the summary on stdout', async () => {
    const ran = await run(ws.root, ['project', 'demo', '--app-dir', ws.appDir, '--base-url', 'http://localhost:3000']);
    const dir = path.join(ws.projectsDir, 'demo');
    const config = JSON.parse(readFileSync(path.join(dir, 'config.json'), 'utf8')) as {
      name: string;
      description: string;
      envs: { baseURL: string; appDir: string }[];
    };
    expect(ran.code).toBe(0);
    expect(ran.out).toContain(`Projeto "demo" criado em ${dir}.`);
    expect(ran.out).toContain('description preenchido');
    expect(ran.out).toContain('.env.json');
    expect(config.name).toBe('demo');
    expect(config.description).toBe('Minha app: Faz buscas.');
    expect(config.envs[0]).toMatchObject({ baseURL: 'http://localhost:3000', appDir: ws.appDir });
    expect(existsSync(path.join(dir, '.env.example.json'))).toBe(true);
  });

  it('names the project after --app-dir when no name is given, from the folder the command runs in', async () => {
    const bare = path.join(ws.root, 'bare');
    const untitled = path.join(ws.root, 'sem-texto');
    const sub = path.join(ws.root, 'sub');
    mkdirSync(bare);
    mkdirSync(untitled);
    mkdirSync(sub);
    writeFileSync(path.join(untitled, 'README.md'), '## Só seção\n');

    const named = await run(sub, ['project', '--app-dir', '../bare']);
    expect(named.code).toBe(0);
    expect(existsSync(path.join(ws.projectsDir, 'bare', 'config.json'))).toBe(true);
    expect(named.out).toContain(`Nenhum README na raiz de ${bare}`);

    const empty = await run(ws.root, ['project', 'vazio', '--app-dir', untitled]);
    expect(empty.code).toBe(0);
    expect(empty.out).toContain('não tem título nem parágrafo aproveitáveis');
  });

  it('fails on a missing --app-dir, a missing folder and a project that already exists', async () => {
    const bareFlag = await run(ws.root, ['project', '--app-dir']);
    expect(bareFlag.code).toBe(1);
    expect(bareFlag.err).toContain('Missing value for --app-dir');

    const flagAsValue = await run(ws.root, ['project', '--base-url', '--app-dir', ws.appDir]);
    expect(flagAsValue.code).toBe(1);
    expect(flagAsValue.err).toContain('Missing value for --base-url');

    const missing = await run(ws.root, ['project', 'demo']);
    expect(missing.code).toBe(1);
    expect(missing.err).toContain('--app-dir');
    expect(missing.err).toContain('sem perguntas');
    expect(missing.err).toContain("Run 'choliba generate project --help' for usage.");

    const absent = await run(ws.root, ['project', '--app-dir', 'nao-existe']);
    expect(absent.code).toBe(1);
    expect(absent.err).toContain('não é uma pasta existente');

    await run(ws.root, ['project', 'demo', '--app-dir', ws.appDir]);
    const again = await run(ws.root, ['project', 'demo', '--app-dir', ws.appDir]);
    expect(again.code).toBe(1);
    expect(again.err).toContain('já existe');
  });

  it('asks for the folder, the name and the url, and creates the project from the answers', async () => {
    const questions: string[] = [];
    const prompter: Prompter = {
      text: (question) => {
        questions.push(question);
        if (questions.length === 1) return Promise.resolve('app');
        if (questions.length === 2) return Promise.resolve('demo');
        return Promise.resolve('http://localhost:3000');
      },
      select: (_question, _choices, fallback) => Promise.resolve(fallback),
      multiselect: () => Promise.resolve([]),
    };
    const ran = await run(ws.root, ['project'], 'generate', { interactive: true, prompter });
    const dir = path.join(ws.projectsDir, 'demo');
    const config = JSON.parse(readFileSync(path.join(dir, 'config.json'), 'utf8')) as {
      name: string;
      envs: { baseURL: string; appDir: string }[];
    };
    expect(ran.code).toBe(0);
    expect(questions).toHaveLength(3);
    expect(config.name).toBe('demo');
    expect(config.envs[0]).toMatchObject({ baseURL: 'http://localhost:3000', appDir: ws.appDir });
  });

  it('does not ask when --app-dir is given: the name is the folder and the url stays unset', async () => {
    const ran = await run(ws.root, ['project', '--app-dir', 'app'], 'generate', {
      interactive: true,
      prompter: {
        text: () => Promise.reject(new Error('não deveria perguntar')),
        select: () => Promise.reject(new Error('não deveria perguntar')),
        multiselect: () => Promise.reject(new Error('não deveria perguntar')),
      },
    });
    const config = JSON.parse(readFileSync(path.join(ws.projectsDir, 'app', 'config.json'), 'utf8')) as {
      name: string;
      envs: { baseURL?: string }[];
    };
    expect(ran.code).toBe(0);
    expect(config.name).toBe('app');
    expect(config.envs[0]?.baseURL).toBe('CHANGE_ME');
  });

  it('asks only for what is missing, and an empty name or url keeps the defaults', async () => {
    const flags: string[] = [];
    const prompter: Prompter = {
      text: (_question, flag, fallback) => {
        flags.push(flag);
        if (flag === '--app-dir') return Promise.resolve('app');
        if (flag === 'PROJECT') return Promise.resolve('  ');
        return Promise.resolve(fallback ?? '');
      },
      select: (_question, _choices, fallback) => Promise.resolve(fallback),
      multiselect: () => Promise.resolve([]),
    };
    const given = await run(ws.root, ['project', 'demo', '--base-url', 'http://localhost:9'], 'generate', {
      interactive: true,
      prompter,
    });
    expect(given.code).toBe(0);
    expect(flags).toEqual(['--app-dir']);

    flags.length = 0;
    const blank = await run(ws.root, ['project'], 'g', { interactive: true, prompter });
    const config = JSON.parse(readFileSync(path.join(ws.projectsDir, 'app', 'config.json'), 'utf8')) as {
      name: string;
      envs: { baseURL?: string }[];
    };
    expect(blank.code).toBe(0);
    expect(flags).toEqual(['--app-dir', 'PROJECT', '--base-url']);
    expect(config.name).toBe('app');
    expect(config.envs[0]?.baseURL).toBe('CHANGE_ME');
  });

  it('with --no-input, a missing --app-dir fails naming the flag', async () => {
    const ran = await run(ws.root, ['project', '--no-input'], 'generate', {
      interactive: true,
      prompter: answering(['should-not-be-asked']),
    });
    expect(ran.code).toBe(1);
    expect(ran.err).toContain('--app-dir');
    expect(ran.err).toContain('sem perguntas');
  });
});
