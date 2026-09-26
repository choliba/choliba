import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FILES_MARKER } from '@choliba/core/cli';
import type { Writable } from '@choliba/terminal/output';

import { runProjectsCli } from '../cli';

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

function withProjectsDir(fn: (projectsDir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cli-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function withTemplatesDir<T>(fn: (templatesDir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cli-template-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ name: 'Demo', envs: [{ nome: 'qa', baseURL: '', default: true }] }),
    );
    fs.writeFileSync(path.join(dir, '.env.example.json'), JSON.stringify({ qa: { TEST_USERNAME: 'CHANGE_ME' } }));
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** An application folder for --app-dir, with `readme` as its README.md when given. */
function withAppDir(readme: string | undefined, fn: (appDir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-cli-app-'));
  try {
    if (readme !== undefined) fs.writeFileSync(path.join(dir, 'README.md'), readme);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

describe('runProjectsCli', () => {
  it('checks that a project is ready, naming what is still CHANGE_ME', () => {
    const harness = (projectsDir: string) => {
      const stdout = fakeWritable();
      const stderr = fakeWritable();
      const deps = {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr,
      };
      return { deps, stdout, stderr };
    };
    withProjectsDir((projectsDir) => {
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

      const pending = harness(projectsDir);
      expect(runProjectsCli(['bun', 'cli', 'check-project', 'demo'], pending.deps)).toBe(1);
      expect(pending.stderr.chunks.join('')).toContain('troque CHANGE_ME em:');

      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify({ development: { TEST_USERNAME: 'ana' } }));
      const ready = harness(projectsDir);
      expect(runProjectsCli(['bun', 'cli', 'check-project', 'demo'], ready.deps)).toBe(0);
      expect(ready.stdout.chunks.join('')).toBe(
        'Projeto "demo" (Demo) pronto: ambiente development, http://localhost:5173/\n',
      );

      const missing = harness(projectsDir);
      expect(runProjectsCli(['bun', 'cli', 'check-project'], missing.deps)).toBe(1);
      expect(missing.stderr.chunks.join('')).toContain('Missing project for check-project.');
    });
  });

  it('prints the tickets folder for a project', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');
      const stdout = fakeWritable();

      const exitCode = runProjectsCli(['node', 'projects', 'tickets-folder', 'demo'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(exitCode).toBe(0);
      expect(stdout.chunks.join('')).toBe(path.join(projectsDir, 'demo', 'tickets') + '\n');
    });
  });

  it('returns usage when tickets-folder is missing the project', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'tickets-folder'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Missing project for tickets-folder');
  });

  it('prints the report folder for a project without a ticket argument', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');
      const stdout = fakeWritable();
      const exitCode = runProjectsCli(['node', 'projects', 'report-folder', 'demo'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(exitCode).toBe(0);
      expect(stdout.chunks.join('')).toBe(path.join(projectsDir, 'demo', 'ticket-runs', 'playwright-report') + '\n');
    });
  });

  it('prints the report folder using PROJECTS_DIR when TICKET_RUNS is unset', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');
      const stdout = fakeWritable();
      const exitCode = runProjectsCli(['node', 'projects', 'report-folder', 'demo', 'demo-T-01'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(exitCode).toBe(0);
      expect(stdout.chunks.join('')).toBe(
        path.join(projectsDir, 'demo', 'ticket-runs', 'demo-T-01', 'playwright-report') + '\n',
      );
    });
  });

  it('prints playwright-report when report-folder has no project', () => {
    const stdout = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'report-folder'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout,
      stderr: fakeWritable(),
    });

    expect(exitCode).toBe(0);
    expect(stdout.chunks.join('')).toBe('playwright-report\n');
  });

  it('prints the report folder using TICKET_RUNS when set', () => {
    const stdout = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'report-folder', 'demo', 'demo-01'], {
      loadConfig: () => ({
        GLOBAL_DIR: '/global',
        PROJECTS_DIR: '/projects',
        TICKET_RUNS: '/runs',
      }),
      templatesDir: '/templates',
      stdout,
      stderr: fakeWritable(),
    });

    expect(exitCode).toBe(0);
    expect(stdout.chunks.join('')).toBe(
      path.join('/runs', 'demo', 'ticket-runs', 'demo-01', 'playwright-report') + '\n',
    );
  });

  it('lists ticket spec files one per line', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo', ['T-01']);
      fs.writeFileSync(
        path.join(projectsDir, 'demo', 'tickets', 'T-01.json'),
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['alpha.spec.ts › d › CA-01: x'] }] }),
      );
      const stdout = fakeWritable();

      const exitCode = runProjectsCli(['node', 'projects', 'ticket-specs', 'demo', 'demo-T-01'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(exitCode).toBe(0);
      expect(stdout.chunks.join('')).toBe('alpha.spec.ts\n');
    });
  });

  it('lists each project with its description, laid out like --help', () => {
    withProjectsDir((projectsDir) => {
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
      const stdout = fakeWritable();

      runProjectsCli(['node', 'projects', 'list-projects'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(stdout.chunks.join('')).toBe(
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
    });
  });

  it('lists projects and optionally their tickets', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'zebra', ['02', '01']);
      writeProject(projectsDir, 'alpha');
      const stdout = fakeWritable();

      runProjectsCli(['node', 'projects', 'list-projects'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(stdout.chunks.join('')).toBe('alpha\nzebra\n');

      const withTickets = fakeWritable();
      runProjectsCli(['node', 'projects', 'list-projects', '--tickets'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout: withTickets,
        stderr: fakeWritable(),
      });

      expect(withTickets.chunks.join('')).toContain('zebra ["zebra-01","zebra-02"]');
    });
  });

  it('reports when no projects exist', () => {
    withProjectsDir((projectsDir) => {
      const stdout = fakeWritable();
      runProjectsCli(['node', 'projects', 'list-projects'], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: '/templates',
        stdout,
        stderr: fakeWritable(),
      });

      expect(stdout.chunks.join('')).toContain('No project found');
    });
  });

  it('returns usage when command is missing', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Missing command');
  });

  it('returns usage when ticket-specs is missing arguments', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'ticket-specs', 'demo'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Missing project or ticket');
  });

  it('returns 1 when command handler throws', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'tickets-folder', 'demo'], {
      loadConfig: () => {
        throw new Error('config exploded');
      },
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('config exploded');
  });

  it('writes parse errors to stderr and returns 1', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'unknown-command'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Unknown command');
  });

  it('creates a project from the template, with the app dir and the description from its README', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        withAppDir('# Demo\n\nApp de teste.\n', (appDir) => {
          const stdout = fakeWritable();

          const exitCode = runProjectsCli(['node', 'projects', 'create-project', 'demo', '--app-dir', appDir], {
            loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
            templatesDir,
            stdout,
            stderr: fakeWritable(),
          });

          expect(exitCode).toBe(0);
          const created = path.join(projectsDir, 'demo');
          expect(stdout.chunks.join('')).toBe(
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
        });
      });
    });
  });

  it('says why the description stayed empty: no README, or a README without usable text', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        const create = (project: string, appDir: string): string => {
          const stdout = fakeWritable();
          runProjectsCli(['node', 'projects', 'create-project', project, '--app-dir', appDir], {
            loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
            templatesDir,
            stdout,
            stderr: fakeWritable(),
          });
          return stdout.chunks.join('');
        };
        withAppDir(undefined, (appDir) => {
          expect(create('sem-readme', appDir)).toContain(
            `Nenhum README na raiz de ${appDir}; description ficou vazio.`,
          );
        });
        withAppDir('## Só seções\n\n- item\n', (appDir) => {
          expect(create('readme-vazio', appDir)).toContain(
            'não tem título nem parágrafo aproveitáveis; description ficou vazio.',
          );
        });
      });
    });
  });

  it('requires --app-dir, with a value, and creates nothing for a folder that does not exist', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        const run = (...args: string[]): string => {
          const stderr = fakeWritable();
          const exitCode = runProjectsCli(['node', 'projects', 'create-project', 'demo', ...args], {
            loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
            templatesDir,
            stdout: fakeWritable(),
            stderr,
          });
          expect(exitCode).toBe(1);
          return stderr.chunks.join('');
        };

        expect(run()).toContain('Missing --app-dir for create-project');
        expect(run('--app-dir')).toContain('Missing value for --app-dir');
        expect(run('--app-dir', path.join(projectsDir, 'nope'))).toContain('não é uma pasta existente');
        expect(fs.existsSync(path.join(projectsDir, 'demo'))).toBe(false);
      });
    });
  });

  it('creates a project and fills the base url when --base-url is given', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        const exitCode = runProjectsCli(
          [
            'node',
            'projects',
            'create-project',
            'demo',
            '--base-url',
            'https://qa.exemplo.com',
            '--app-dir',
            os.tmpdir(),
          ],
          {
            loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
            templatesDir,
            stdout: fakeWritable(),
            stderr: fakeWritable(),
          },
        );

        expect(exitCode).toBe(0);
        const config = JSON.parse(fs.readFileSync(path.join(projectsDir, 'demo', 'config.json'), 'utf-8')) as {
          envs: { baseURL: string }[];
        };
        expect(config.envs[0]?.baseURL).toBe('https://qa.exemplo.com');
      });
    });
  });

  it('names the project after the app folder, resolving a relative --app-dir from the current directory', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        withAppDir(undefined, (appDir) => {
          const stdout = fakeWritable();
          const exitCode = runProjectsCli(
            [
              'node',
              'projects',
              'create-project',
              '--app-dir',
              `./${path.basename(appDir)}/`,
              '--base-url',
              'http://x',
            ],
            {
              loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
              templatesDir,
              cwd: path.dirname(appDir),
              stdout,
              stderr: fakeWritable(),
            },
          );

          expect(exitCode).toBe(0);
          const name = path.basename(appDir);
          expect(stdout.chunks.join('')).toContain(`Projeto "${name}" criado em ${path.join(projectsDir, name)}.`);
          const config = JSON.parse(fs.readFileSync(path.join(projectsDir, name, 'config.json'), 'utf-8')) as {
            envs: { appDir: string }[];
          };
          expect(config.envs[0]?.appDir).toBe(appDir);
        });
      });
    });
  });

  it('takes the name from any position, never from a flag or a flag value', () => {
    withProjectsDir((projectsDir) => {
      withTemplatesDir((templatesDir) => {
        const stdout = fakeWritable();
        runProjectsCli(
          ['node', 'projects', 'create-project', '--app-dir', os.tmpdir(), '--base-url', 'http://x', 'nome'],
          {
            loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
            templatesDir,
            stdout,
            stderr: fakeWritable(),
          },
        );

        expect(stdout.chunks.join('')).toContain('Projeto "nome" criado');
      });
    });
  });

  it('returns usage when --base-url has no value', () => {
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', 'create-project', 'demo', '--base-url'], {
      loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: '/projects' }),
      templatesDir: '/templates',
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Missing value for --base-url');
  });

  it('propagates the error when the project already exists', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');
      withTemplatesDir((templatesDir) => {
        const stderr = fakeWritable();

        const exitCode = runProjectsCli(['node', 'projects', 'create-project', 'demo', '--app-dir', os.tmpdir()], {
          loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
          templatesDir,
          stdout: fakeWritable(),
          stderr,
        });

        expect(exitCode).toBe(1);
        expect(stderr.chunks.join('')).toContain('já existe');
      });
    });
  });

  it('propagates the error when the templates directory is missing', () => {
    withProjectsDir((projectsDir) => {
      const stderr = fakeWritable();

      const exitCode = runProjectsCli(['node', 'projects', 'create-project', 'demo', '--app-dir', os.tmpdir()], {
        loadConfig: () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir }),
        templatesDir: path.join(projectsDir, 'sem-template'),
        stdout: fakeWritable(),
        stderr,
      });

      expect(exitCode).toBe(1);
      expect(stderr.chunks.join('')).toContain('Template de projeto não encontrado');
    });
  });
});

describe('runProjectsCli — help and completion', () => {
  function run(args: string[], loadConfig: () => { GLOBAL_DIR: string; PROJECTS_DIR: string }) {
    const stdout = fakeWritable();
    const stderr = fakeWritable();
    const exitCode = runProjectsCli(['node', 'projects', ...args], {
      loadConfig,
      templatesDir: '/templates',
      stdout,
      stderr,
    });
    return { exitCode, out: stdout.chunks.join(''), err: stderr.chunks.join('') };
  }

  const config = (projectsDir: string) => () => ({ GLOBAL_DIR: '/global', PROJECTS_DIR: projectsDir });
  const broken = () => {
    throw new Error('no config');
  };

  it('prints the full help for --help, -h and help', () => {
    for (const flag of ['--help', '-h', 'help']) {
      const { exitCode, out } = run([flag], broken);
      expect(exitCode).toBe(0);
      expect(out).toContain('Usage:  projects COMMAND [ARGS]');
      expect(out).toContain('Commands:\n  tickets-folder');
      expect(out).toContain("Run 'projects COMMAND --help'");
    }
  });

  it("prints a command's own help", () => {
    const { exitCode, out } = run(['create-project', '--help'], broken);
    expect(exitCode).toBe(0);
    expect(out).toContain('Usage:  projects create-project [PROJECT] --app-dir DIR [OPTIONS]');
    expect(out).toContain('--base-url url');
  });

  it('keeps reporting an unknown command even with --help', () => {
    const { exitCode, err } = run(['bogus', '--help'], broken);
    expect(exitCode).toBe(1);
    expect(err).toContain('Unknown command "bogus".');
    expect(err).toContain("Run 'projects --help' for usage.");
  });

  it('completes commands, projects, tickets and flags from disk', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo', ['demo-01', 'demo-02']);
      writeProject(projectsDir, 'other');

      expect(run(['__complete', 'ti'], config(projectsDir)).out).toBe('tickets-folder\nticket-specs\n');
      expect(run(['__complete', 'tickets-folder', ''], config(projectsDir)).out).toBe('demo\nother\n');
      expect(run(['__complete', 'tickets-folder', 'demo', ''], config(projectsDir)).out).toBe('');
      expect(run(['__complete', 'report-folder', 'd'], config(projectsDir)).out).toBe('demo\n');
      expect(run(['__complete', 'ticket-specs', 'demo', ''], config(projectsDir)).out).toBe('demo-01\ndemo-02\n');
      expect(run(['__complete', 'ticket-specs', 'demo', 'demo-01', ''], config(projectsDir)).out).toBe('');
      expect(run(['__complete', 'list-projects', '--'], config(projectsDir)).out).toBe('--tickets\n');
    });
  });

  it('creates a ticket from the type template, in the active environment of a ready project', () => {
    withProjectsDir((projectsDir) => {
      const projectPath = path.join(projectsDir, 'demo');
      fs.mkdirSync(projectPath, { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'config.json'),
        JSON.stringify({ name: 'Demo', envs: [{ nome: 'qa', baseURL: 'http://qa', appDir: '/app' }] }),
      );
      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify({ qa: { TEST_USERNAME: 'ana' } }));

      const created = run(['create-ticket', 'demo', 'story'], config(projectsDir));
      expect(created.exitCode).toBe(0);
      const file = path.join(projectPath, 'tickets', '1.json');
      expect(created.out).toBe(`Ticket "demo-1" criado em ${file}. Troque os valores CHANGE_ME.\n`);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({
        ticket: 'demo-1',
        tipo: 'story',
        ambiente: 'qa',
      });

      const unknown = run(['create-ticket', 'demo', 'spike'], config(projectsDir));
      expect(unknown.exitCode).toBe(1);
      expect(unknown.err).toContain('Tipo de ticket "spike" não existe');

      const missing = run(['create-ticket', 'demo'], config(projectsDir));
      expect(missing.exitCode).toBe(1);
      expect(missing.err).toContain('Missing project or type for create-ticket.');
    });
  });

  it('completes create-ticket with projects, then ticket types', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');

      expect(run(['__complete', 'create-ticket', ''], config(projectsDir)).out).toBe('demo\n');
      expect(run(['__complete', 'create-ticket', 'demo', ''], config(projectsDir)).out).toBe(
        'bug\nepic\nimprovement\nstory\ntask\n',
      );
      expect(run(['__complete', 'create-ticket', 'demo', 'bug', ''], config(projectsDir)).out).toBe('');
      expect(run(['__complete', 'create-project', 'novo', '--app-dir', ''], config(projectsDir)).out).toBe(
        `${FILES_MARKER}\n`,
      );
    });
  });

  it('describes the CLI or the command the words select', () => {
    expect(run(['__describe'], broken).out).toBe(
      'Resolve pastas e arquivos dos projetos Playwright em PROJECTS_DIR.\n',
    );
    expect(run(['__describe', 'create-project'], broken).out).toBe('Cria um projeto novo a partir do template\n');
  });

  it('suggests nothing when the projects or tickets cannot be read', () => {
    withProjectsDir((projectsDir) => {
      writeProject(projectsDir, 'demo');
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets'), 'not a directory');

      expect(run(['__complete', 'ticket-specs', 'demo', ''], config(projectsDir)).out).toBe('');
      expect(run(['__complete', 'tickets-folder', ''], broken).out).toBe('');
      expect(run(['__complete', 'ticket-specs', 'demo', ''], broken).out).toBe('');
    });
  });
});
