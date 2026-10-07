import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { complete, describe as describeSpec, formatSuggestions } from '@choliba/core/cli';
import type { GitRunner } from '@choliba/core/platform';

import * as gitDiff from '../../steps/git-working-tree-diff';
import * as projects from '@choliba/projects';

import type { SignalSource, Writable } from '@choliba/terminal';
import { ProcessRunnerService } from '@choliba/terminal';

import { defineCommand } from '../../agents/commands/define-command';
import { StepFailedError } from '../../steps/actions';
import { readPlan } from '../../plans/plan-store';
import type { RunAgentsCliDeps } from '../../runs/run-agents';
import { agentsHelpSpec, runAgentsCli } from '../../runs/run-agents';
import { COMMAND_LINE_TITLE } from '../../runs/dry-run';
import { buildTheme } from '@choliba/core/theme';

import { PROVIDERS } from '../helpers/providers';
import { fakeSpawner, streamFromChunks } from '../helpers/fake-spawner';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');
const SKILLS = join(__dirname, '..', 'fixtures', 'skills');
const MCPS = join(__dirname, '..', 'fixtures', 'mcps');
/** Where the runs of these cases make their empty folder: `/repo` is not a real folder. */
const RUNS = join(tmpdir(), `cli-run-spec-${String(process.pid)}`);
/** The text an agent.yaml of these cases needs (`role`, `input`, `flow`, `output`), one YAML line each. */
const SECTIONS = ['role: Revisa código.', 'input: Um diff.', 'flow: 1. Revise.', 'output: Comentários.'];

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

/**
 * These `cli/run.spec.ts` cases never send a signal — that path is exercised by
 * `run-agent.spec.ts` — so the source only needs to satisfy the interface.
 */
function fakeSignalSource(): SignalSource {
  return {
    on: () => undefined,
    off: () => undefined,
  };
}

function whichOf(available: readonly string[]): (bin: string) => string | null {
  return (bin) => (available.includes(bin) ? `/usr/bin/${bin}` : null);
}

/** One successful claude stream-json line, so `runAgent` sees a clean exit. */
function claudeSuccessLine(text = 'ok'): string {
  return `${JSON.stringify({ type: 'result', is_error: false, result: text })}\n`;
}

/** A visible text event, since `renderEvent` prints nothing for a quiet, successful `done`. */
function claudeTextLine(text: string): string {
  return `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } })}\n`;
}

function claudeInitLine(model = 'claude-3-5-sonnet'): string {
  return `${JSON.stringify({ type: 'system', subtype: 'init', model, session_id: 'test-session' })}\n`;
}

/** Prepends init so model-guard passes for agents with non-empty supported_models. */
function claudeStdout(...lines: readonly string[]): readonly string[] {
  return [claudeInitLine(), ...lines];
}

/** `Writable.write` is called once per line, each ending in `\n` — this strips that back off. */
function lines(writable: Writable & { chunks: string[] }): readonly string[] {
  return writable.chunks
    .join('')
    .split('\n')
    .filter((line) => line !== '');
}

/** The provider's command line, one argument each, that `--dry-run --show-prompt` prints in full. */
function dryRunArgv(writable: Writable & { chunks: string[] }): readonly string[] {
  const text = writable.chunks.join('');
  const marker = `── ${COMMAND_LINE_TITLE} ──\n`;
  const start = text.indexOf(marker);
  if (start === -1) {
    throw new Error(`no command line in:\n${text}`);
  }
  return JSON.parse(text.slice(start + marker.length).split('\n')[0] ?? '') as string[];
}

/** What `choliba __complete agents <words…>` prints: one suggestion per line, nothing when there is none. */
async function completeWords(words: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  const output = formatSuggestions(complete(agentsHelpSpec(deps), words));
  if (output !== '') deps.stdout.write(`${output}\n`);
  return Promise.resolve(0);
}

/** What `choliba __describe agents <words…>` prints. */
async function describeWords(words: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  deps.stdout.write(`${describeSpec(agentsHelpSpec(deps), words)}\n`);
  return Promise.resolve(0);
}

interface Harness {
  readonly deps: RunAgentsCliDeps;
  readonly stdout: Writable & { chunks: string[] };
  readonly stderr: Writable & { chunks: string[] };
}

function harness(stdoutLines: readonly string[], overrides: Partial<RunAgentsCliDeps> = {}): Harness {
  const stdout = fakeWritable();
  const stderr = fakeWritable();
  const runner = new ProcessRunnerService({ spawner: fakeSpawner({ stdout: streamFromChunks(stdoutLines) }).spawner });

  const deps: RunAgentsCliDeps = {
    runner,
    which: whichOf(['claude']),
    providers: PROVIDERS,
    theme: buildTheme({}, false),
    repoRoot: '/repo',
    commands: [],
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    stdout,
    stderr,
    signals: fakeSignalSource(),
    runsDir: RUNS,
    ...overrides,
    // The fixture agents' skills live next to them; a test may still point elsewhere.
    config: { CHOL_SKILLS_DIR: SKILLS, ...overrides.config },
  };
  return { deps, stdout, stderr };
}

describe('runAgentsCli — help', () => {
  it('prints usage and returns 0', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli([], deps)).toBe(0);
    expect(stdout.chunks.join('')).toContain('Usage:  choliba agents [OPTIONS] COMMAND [TASK...]');
  });

  it('rejects a malformed argv up front, before resolving anything', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['developer', '--bogus=1'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('unknown flag: --bogus=1');
  });

  it('prints per-agent help when --help follows the command name', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--help'], deps)).toBe(0);
    const text = stdout.chunks.join('');
    expect(text).toContain('id: echo');
    expect(text).toContain('Policy: read-only');
    expect(text).toContain('Usage:  choliba agents echo [OPTIONS] [TASK...]');
    expect(text).toContain('--dry-run');
  });

  it('shows policy and task flags from agent.yaml in per-agent help', async () => {
    const { deps, stdout } = harness([]);

    await runAgentsCli(['with-prepare', '--agents-dir', FIXTURES, '-h'], deps);
    const text = stdout.chunks.join('');
    expect(text).toContain('Policy: edits');
    expect(text).toContain('Task obrigatória: não');
  });

  it('wraps long descriptions in per-agent help', async () => {
    const tmp = makeTmpDir('cli-help-wrap');
    try {
      const agentsDir = join(tmp.path, 'agents');
      const longDir = join(agentsDir, 'long-help');
      mkdirSync(longDir, { recursive: true });
      writeFileSync(
        join(longDir, 'agent.yaml'),
        [
          'version: 1',
          'agent:',
          '  id: long-help',
          '  name: Long Help',
          '  version: 1.0.0',
          '  description: "Esta descrição é propositalmente longa o suficiente para forçar quebra de linha no help do agente quando exibida no terminal estreito do CLI."',
          'models:',
          '  - claude-3-5-sonnet',
          ...SECTIONS,
        ].join('\n'),
      );

      const { deps, stdout } = harness([]);
      expect(await runAgentsCli(['long-help', '--agents-dir', agentsDir, '--help'], deps)).toBe(0);
      const text = stdout.chunks.join('');
      expect(text).toContain('Usage:  choliba agents long-help');
      expect(text).toContain('Esta descrição é propositalmente longa');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('runAgentsCli — global help and completion', () => {
  const git: GitRunner = {
    run: () => ({ stdout: 'develop\nfeat/x\nv1.0.0\n', stderr: '', status: 0 }),
  };

  it('lists the agents found on disk in the global help', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES } });

    expect(await runAgentsCli(['--help'], deps)).toBe(0);
    const text = stdout.chunks.join('');
    expect(text).toContain('Agents:\n');
    expect(text).toMatch(/\n {2}echo +\S/);
    expect(text).toContain('Commands:\n  list');
    expect(text).toContain("Run 'choliba agents COMMAND --help' for more information on a command.");
  });

  it('completes agent names, commands and --<agent> forms', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, git });

    expect(await completeWords(['ec'], deps)).toBe(0);
    expect(await completeWords(['--ec'], deps)).toBe(0);
    expect(lines(stdout)).toEqual(['echo', '--echo']);
  });

  it('completes flag values from the agent, the modes and git refs', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, git });

    await completeWords(['--echo', '--mode', 'p'], deps);
    await completeWords(['echo', '--model', ''], deps);
    await completeWords(['with-prepare', '--since', 'fe'], deps);
    await completeWords(['echo', '--plan-from', ''], deps);
    expect(lines(stdout)).toEqual(['plan', 'claude-3-5-sonnet', 'gpt-4o', 'feat/x', ':files']);
  });

  it('describes the CLI or the command the words select', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, git });

    await describeWords([], deps);
    await describeWords(['--echo', '--mode', 'plan'], deps);
    expect(lines(stdout)[0]).toMatch(/^Executa os agentes da pasta de trabalho/);
    expect(lines(stdout)[1]).toBe('Repete a tarefa recebida, usado nos testes deste pacote.');
  });

  it('suggests only pending when git fails, and prints nothing for no suggestions', async () => {
    const failing: GitRunner = { run: () => ({ stdout: '', stderr: 'fatal', status: 128 }) };
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, git: failing });

    expect(await completeWords(['with-prepare', '--since', ''], deps)).toBe(0);
    expect(await completeWords(['echo', '--help', ''], deps)).toBe(0);
    expect(lines(stdout)).toEqual(['pending']);
  });

  it('offers the diff-base flags only to agents with a prepare step', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, git });

    await completeWords(['with-prepare', '--si'], deps);
    await completeWords(['echo', '--si'], deps);
    expect(lines(stdout)).toEqual(['--since', '--since-pending']);
  });

  it('uses the real git when no runner is injected', async () => {
    const tmp = makeTmpDir('cli-complete-git');
    try {
      execSync('git init -q -b trunk && git -c user.name=T -c user.email=t@e.x commit -q --allow-empty -m init', {
        cwd: tmp.path,
      });
      const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES }, repoRoot: tmp.path });

      await completeWords(['with-prepare', '--since', ''], deps);
      expect(lines(stdout)).toEqual(['pending', 'trunk']);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('runAgentsCli — ${VAR} in the text of the agent', () => {
  it('fills in the project locations and grants them by rules, never as a folder the provider reads freely', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_GLOBAL_DIR: '/g' } });

    expect(await runAgentsCli(['with-vars', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps)).toBe(0);
    const printed = dryRunArgv(stdout);
    expect(printed).toContain('Write(//g/projects/*/tickets/**)');
    expect(printed).toContain('Read(//g/projects/*/config.json)');
    expect(printed).not.toContain('--add-dir');
    expect(printed.join('\n')).not.toContain('${CHOL_PROJECTS_DIR}');
  });

  it('honors CHOL_PROJECTS_DIR and CHOL_TICKET_RUNS from the config', async () => {
    const { deps, stdout } = harness([], {
      config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: '/p', CHOL_TICKET_RUNS: '/r' },
    });

    expect(await runAgentsCli(['with-vars', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps)).toBe(0);
    expect(dryRunArgv(stdout)).toContain('Write(//p/*/tickets/**)');
  });

  it('stops before the provider when the locations are not configured', async () => {
    const { deps, stdout, stderr } = harness([]);

    expect(await runAgentsCli(['with-vars', '--agents-dir', FIXTURES, '--dry-run'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('CHOL_GLOBAL_DIR não definida');
    expect(stdout.chunks.join('')).not.toContain('claude');
  });

  it('shows help without needing the locations', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli(['with-vars', '--agents-dir', FIXTURES, '--help'], deps)).toBe(0);
    expect(stdout.chunks.join('')).toContain('id: with-vars');
  });
});

/** A projects dir with `ready` (valid) and `pending` (still `CHANGE_ME`), as the projects expects. */
function withProjects(run: (projectsDir: string) => Promise<void>): Promise<void> {
  const tmp = makeTmpDir('cli-projects');
  const write = (project: string, baseURL: string): void => {
    const dir = join(tmp.path, project);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ name: 'Demo', envs: [{ nome: 'qa', baseURL, appDir: 'app' }] }),
    );
    writeFileSync(join(dir, '.env.json'), JSON.stringify({ qa: { TEST_USERNAME: 'u' } }));
  };
  write('ready', 'http://ready.test');
  write('pending', 'CHANGE_ME');
  return run(tmp.path).finally(tmp.cleanup);
}

describe('runAgentsCli — tickets', () => {
  /** The `with-project` fixture as an agent with `ticket_types: [bug, story]` that writes only `${TICKET_FILE}`. */
  function withTicketAgent(run: (agentsDir: string) => Promise<void>): Promise<void> {
    const tmp = makeTmpDir('cli-ticket-agent');
    const dir = join(tmp.path, 'with-project');
    cpSync(join(FIXTURES, 'with-project'), dir, { recursive: true });
    const yaml = readFileSync(join(dir, 'agent.yaml'), 'utf8').replace('${PROJECT_DIR}/tickets/', '${TICKET_FILE}');
    writeFileSync(join(dir, 'agent.yaml'), `${yaml}ticket_types: [bug, story]\n`);
    return run(tmp.path).finally(tmp.cleanup);
  }

  const argv = (agentsDir: string, ...rest: string[]): string[] => [
    'with-project',
    '--agents-dir',
    agentsDir,
    '--project',
    'ready',
    ...rest,
  ];

  it('asks for --type or --ticket, and refuses a type the agent does not take', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const config = { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir };
        const none = harness([], { config });
        expect(await runAgentsCli(argv(agentsDir, '--dry-run'), none.deps)).toBe(1);
        expect(none.stderr.chunks.join('')).toContain(
          '"with-project" precisa de --type <tipo> (ticket novo: bug, story) ou --ticket <chave> (ticket existente).',
        );

        const other = harness([], { config });
        expect(await runAgentsCli(argv(agentsDir, '--type', 'task', '--dry-run'), other.deps)).toBe(1);
        expect(other.stderr.chunks.join('')).toContain(
          '"with-project" não trabalha com tickets "task" (aceitos: bug, story).',
        );

        const shortcut = harness([], { config });
        expect(await runAgentsCli(argv(agentsDir, '--type-task', '--dry-run'), shortcut.deps)).toBe(1);
        expect(shortcut.stderr.chunks.join('')).toContain('unknown flag: --type-task');
      }),
    );
  });

  it('plans the new ticket on --dry-run without writing it, and scopes the writes to its file', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const { deps, stdout } = harness([], { config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir } });

        expect(await runAgentsCli(argv(agentsDir, '--type-bug', '--dry-run', '--show-prompt'), deps)).toBe(0);
        const file = join(projectsDir, 'ready', 'tickets', '1.json');
        expect(dryRunArgv(stdout)).toContain(`Edit(/${file})`);
        expect(existsSync(file)).toBe(false);

        const help = harness([]);
        await runAgentsCli(['with-project', '--agents-dir', agentsDir, '--help'], help.deps);
        expect(help.stdout.chunks.join('')).toContain('ticket_types:\n  - bug\n  - story\n');
      }),
    );
  });

  it('creates the ticket for the run and removes it when the run leaves it untouched', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
          config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
        });

        expect(await runAgentsCli(argv(agentsDir, '--type', 'story', 'x'), deps)).toBe(0);
        const file = join(projectsDir, 'ready', 'tickets', '1.json');
        expect(stderr.chunks.join('')).toContain(`Ticket "ready-1" não foi preenchido; ${file} foi removido.`);
        expect(existsSync(file)).toBe(false);
      }),
    );
  });

  it('opens an existing ticket with --ticket, and stops when it does not exist', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const config = { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir };
        const file = join(projectsDir, 'ready', 'tickets', '7.json');
        mkdirSync(join(projectsDir, 'ready', 'tickets'), { recursive: true });
        writeFileSync(file, '{}');

        const found = harness([], { config });
        expect(
          await runAgentsCli(argv(agentsDir, '--ticket', 'ready-7', '--dry-run', '--show-prompt'), found.deps),
        ).toBe(0);
        expect(dryRunArgv(found.stdout)).toContain(`Edit(/${file})`);

        const missing = harness([], { config });
        expect(
          await runAgentsCli(argv(agentsDir, '--ticket', 'ready-8', '--dry-run', '--show-prompt'), missing.deps),
        ).toBe(1);
        expect(missing.stderr.chunks.join('')).toContain('Ticket "ready-8" não encontrado');
      }),
    );
  });

  it('completes --ticket with the tickets of every project, and with none when projects are not configured', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        mkdirSync(join(projectsDir, 'ready', 'tickets'), { recursive: true });
        writeFileSync(join(projectsDir, 'ready', 'tickets', '2.json'), '{}');
        const words = ['with-project', '--ticket', ''];

        const configured = harness([], {
          config: { CHOL_AGENTS_DIR: agentsDir, CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
        });
        await completeWords(words, configured.deps);
        expect(lines(configured.stdout)).toEqual(['ready-2']);

        const bare = harness([], { config: { CHOL_AGENTS_DIR: agentsDir } });
        await completeWords(words, bare.deps);
        expect(lines(bare.stdout)).toEqual([]);
      }),
    );
  });

  it('completes --ticket with only the tickets of the --project already typed', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        mkdirSync(join(projectsDir, 'ready', 'tickets'), { recursive: true });
        writeFileSync(join(projectsDir, 'ready', 'tickets', '2.json'), '{}');
        mkdirSync(join(projectsDir, 'pending', 'tickets'), { recursive: true });
        writeFileSync(join(projectsDir, 'pending', 'tickets', '5.json'), '{}');
        const config = { CHOL_AGENTS_DIR: agentsDir, CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir };
        const suggest = async (...words: string[]): Promise<readonly string[]> => {
          const { deps, stdout } = harness([], { config });
          await completeWords(['with-project', ...words, ''], deps);
          return lines(stdout);
        };

        expect(await suggest('--project', 'pending', '--ticket')).toEqual(['pending-5']);
        expect(await suggest('--project', 'ready', '--ticket')).toEqual(['ready-2']);
        expect(await suggest('--ticket')).toEqual(['pending-5', 'ready-2']);
        expect(await suggest('--project', 'nope', '--ticket')).toEqual([]);
      }),
    );
  });

  it('stops before the provider when the ticket cannot be created', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const create = jest.spyOn(projects, 'createTicket').mockImplementation(() => {
          throw new Error('disco cheio');
        });
        try {
          const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
            config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
          });

          expect(await runAgentsCli(argv(agentsDir, '--type-bug', 'x'), deps)).toBe(1);
          expect(stderr.chunks.join('')).toContain('disco cheio');
        } finally {
          create.mockRestore();
        }
      }),
    );
  });

  it('refuses --type and --ticket for an agent without ticket_types', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--type-bug', '--dry-run', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('unknown flag: --type-bug');
  });
});

describe('runAgentsCli — --project', () => {
  it('requires --project from an agent with project_required, before anything else', async () => {
    const { deps, stdout, stderr } = harness([], { config: { CHOL_GLOBAL_DIR: '/g' } });

    expect(await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--dry-run'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain(
      'Project is required for "with-project" (it uses a project variable or ticket_types): pass --project <name>.',
    );
    expect(stdout.chunks).toEqual([]);
  });

  it('stops with the projects message when the project is not ready', async () => {
    await withProjects(async (projectsDir) => {
      const { deps, stdout, stderr } = harness([], {
        config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
      });

      expect(
        await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--project', 'pending', '--dry-run'], deps),
      ).toBe(1);
      expect(stderr.chunks.join('')).toContain('Projeto "pending" ainda não foi configurado');
      expect(stdout.chunks).toEqual([]);

      expect(
        await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--project', 'missing', '--dry-run'], deps),
      ).toBe(1);
      expect(stderr.chunks.join('')).toContain('Projeto "missing" não encontrado');
    });
  });

  it('stops when the locations are not configured', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--project', 'red', '--dry-run'], deps)).toBe(
      1,
    );
    expect(stderr.chunks.join('')).toContain('CHOL_GLOBAL_DIR não definida');
  });

  it('fills in ${PROJECT}, ${PROJECT_DIR} and ${APP_DIR} and grants only that project, by rules', async () => {
    await withProjects(async (projectsDir) => {
      const { deps, stdout } = harness([], { config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir } });

      expect(
        await runAgentsCli(
          ['with-project', '--agents-dir', FIXTURES, '--project', 'ready', '--dry-run', '--show-prompt'],
          deps,
        ),
      ).toBe(0);
      const printed = dryRunArgv(stdout);
      const projectDir = join(projectsDir, 'ready');
      expect(printed).toContain(`Read(/${projectDir}/config.json)`);
      expect(printed).toContain(`Read(/${projectDir}/app/**)`);
      expect(printed).toContain(`Write(/${projectDir}/tickets/**)`);
      expect(printed).not.toContain('--add-dir');
      expect(printed.join('\n')).not.toMatch(/\$\{(PROJECT|APP_DIR)/);
    });
  });

  it('tells any agent run on a project where its application is, and denies it the installed dependencies', async () => {
    await withProjects(async (projectsDir) => {
      const { deps, stdout } = harness([], { config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir } });

      expect(
        await runAgentsCli(
          ['with-project', '--agents-dir', FIXTURES, '--project', 'ready', '--dry-run', '--show-prompt'],
          deps,
        ),
      ).toBe(0);
      const appDir = join(projectsDir, 'ready', 'app');
      expect(stdout.chunks.join('')).toContain(`<project name="ready" baseURL="http://ready.test" appDir="${appDir}">`);
      expect(dryRunArgv(stdout)).toContain(`Write(/${appDir}/node_modules/**)`);
    });
  });

  it('refuses --project for an agent that does not act on a project, even next to --help', async () => {
    const { deps, stdout, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--project', 'red', '--help'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toBe(
      [
        'unknown flag: --project',
        '',
        'Usage:  choliba agents echo [OPTIONS] [TASK...]',
        '',
        "Run 'choliba agents echo --help' for more information",
        '',
      ].join('\n'),
    );
    expect(stdout.chunks).toEqual([]);
  });

  it('refuses the diff-base flags for an agent without git_diff', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--since-pending', '--dry-run', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('unknown flag: --since-pending');
  });

  it('completes --project with the projects on disk, and with nothing when the locations are not set', async () => {
    await withProjects(async (projectsDir) => {
      const configured = harness([], {
        config: { CHOL_AGENTS_DIR: FIXTURES, CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
      });
      await completeWords(['with-project', '--project', ''], configured.deps);
      expect(lines(configured.stdout)).toEqual(['pending', 'ready']);

      const bare = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES } });
      await completeWords(['with-project', '--project', ''], bare.deps);
      expect(lines(bare.stdout)).toEqual([]);
    });
  });
});

describe('runAgentsCli — skills', () => {
  it("lists the agent's skills in the prompt and lets it read the folder of each one", async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps)).toBe(0);
    const printed = dryRunArgv(stdout);
    expect(printed.at(printed.indexOf('-p') + 1)).toContain('Task:');
    expect(printed).toContain(`Read(/${SKILLS}/dummy-skill/**)`);
    expect(printed).not.toContain('--add-dir');
  });

  it('stops before the provider when a listed skill does not exist', async () => {
    const { deps, stdout, stderr } = harness([], { config: { CHOL_SKILLS_DIR: undefined } });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('skill "dummy-skill" não encontrada: /repo/.choliba/skills/dummy-skill');
    expect(stdout.chunks).toEqual([]);
  });

  it('does not grant the skills dir to an agent without skills', async () => {
    const { deps, stdout } = harness([]);

    await runAgentsCli(['with-prepare', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps);
    expect(dryRunArgv(stdout).join('\n')).not.toContain(SKILLS);
  });
});

describe('runAgentsCli — mcps', () => {
  /** The `echo` fixture agent, copied to a tmp agents dir with `mcps` (the given YAML lines) in its agent.yaml. */
  function withMcps(lines: readonly string[]): { agentsDir: string; cleanup: () => void } {
    const tmp = makeTmpDir('run-mcps');
    cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
    const yamlPath = join(tmp.path, 'echo', 'agent.yaml');
    writeFileSync(yamlPath, `${readFileSync(yamlPath, 'utf8')}mcps:\n${lines.map((line) => `  ${line}\n`).join('')}`);
    return { agentsDir: tmp.path, cleanup: tmp.cleanup };
  }

  it('gives the provider only the listed servers, allowed, and shows them in the agent help', async () => {
    const agents = withMcps(['- dummy-mcp']);
    try {
      const { deps, stdout } = harness([], { config: { CHOL_MCPS_DIR: MCPS } });

      expect(
        await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--dry-run', '--show-prompt', 'x'], deps),
      ).toBe(0);
      const printed = dryRunArgv(stdout);
      expect(printed).toContain('--strict-mcp-config');
      expect(printed.at(printed.indexOf('--mcp-config') + 1)).toBe(
        JSON.stringify({ mcpServers: { 'dummy-mcp': { command: 'npx', args: ['dummy-mcp-server'] } } }),
      );
      expect(printed).toContain('mcp__dummy-mcp');

      const help = harness([], { config: { CHOL_MCPS_DIR: MCPS } });
      await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--help'], help.deps);
      expect(help.stdout.chunks.join('')).toContain('mcps:\n  - dummy-mcp');
    } finally {
      agents.cleanup();
    }
  });

  it('stops before the provider when a listed server does not exist', async () => {
    const agents = withMcps(['- nope']);
    try {
      const { deps, stdout, stderr } = harness([]);

      expect(await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--dry-run', 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain('mcp "nope" não encontrado: /repo/.choliba/mcps/nope.json');
      expect(stdout.chunks).toEqual([]);
    } finally {
      agents.cleanup();
    }
  });

  it('allows only the tools the agent lists for a server, and shows them in the agent help', async () => {
    const agents = withMcps(['dummy-mcp:', '  tools: [jira_search, use_environment]']);
    try {
      const { deps, stdout } = harness([], { config: { CHOL_MCPS_DIR: MCPS } });

      expect(
        await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--dry-run', '--show-prompt', 'x'], deps),
      ).toBe(0);
      const printed = dryRunArgv(stdout);
      expect(printed).toContain('mcp__dummy-mcp__jira_search');
      expect(printed).toContain('mcp__dummy-mcp__use_environment');
      expect(printed).not.toContain('mcp__dummy-mcp');

      const help = harness([], { config: { CHOL_MCPS_DIR: MCPS } });
      await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--help'], help.deps);
      expect(help.stdout.chunks.join('')).toContain(
        'mcps:\n  - dummy-mcp:\n    - jira_search\n    - use_environment\n',
      );
    } finally {
      agents.cleanup();
    }
  });

  it('gives an agent without mcps no server at all', async () => {
    const { deps, stdout } = harness([]);

    await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps);
    expect(dryRunArgv(stdout)).toContain('--strict-mcp-config');
    expect(dryRunArgv(stdout)).not.toContain('--mcp-config');
  });
});

describe('runAgentsCli — list', () => {
  it('lists every agent under --agents-dir with the same detail block as --help', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli(['list', '--agents-dir', FIXTURES], deps)).toBe(0);
    const printed = stdout.chunks.join('');
    expect(printed).toContain('id: echo');
    expect(printed).toContain('name: Echo Agent');
    expect(printed).toContain('id: with-prepare');
    expect(printed).toContain('Policy: read-only | Modo padrão: execute | Task obrigatória: sim');
    expect(printed).toContain('Policy: edits | Modo padrão: execute | Task obrigatória: não');
    expect(printed).toContain('models:');
    expect(printed).not.toContain('Usage:');
  });

  it('falls back to CHOL_AGENTS_DIR when --agents-dir is not given', async () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES } });

    await runAgentsCli(['list'], deps);

    expect(stdout.chunks.join('')).toContain('id: echo');
  });

  it('reports no agents found, rather than an empty list, when the directory has none', async () => {
    const tmp = makeTmpDir('cli-list-empty');
    try {
      const { deps, stdout } = harness([]);

      await runAgentsCli(['list', '--agents-dir', tmp.path], deps);

      expect(stdout.chunks.join('')).toContain(`No agents found in ${tmp.path}`);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('runAgentsCli — run', () => {
  it('runs an implicit command for a loadable agent end to end, through the real claude adapter', async () => {
    const { deps, stdout } = harness(claudeStdout(claudeTextLine('all good'), claudeSuccessLine()));

    const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'do the task'], deps);

    expect(exitCode).toBe(0);
    const output = stdout.chunks.join('');
    expect(lines(stdout)[0]).toBe('[provider] claude');
    expect(output).toContain('all good');
  });

  it('reports an unknown command distinctly from a spawn or agent failure', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['nope', '--agents-dir', FIXTURES, 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('Unknown command "nope"');
  });

  it('requires a task for a command that needs one', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('Task is required');
  });

  it('rejects a model that is not declared in agent.yaml#supported_models', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'nope', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('not declared in agent.yaml#supported_models');
  });

  it('accepts a declared --model before spawning the provider', async () => {
    const { deps } = harness(claudeStdout(claudeSuccessLine()));

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'gpt-4o', 'x'], deps)).toBe(0);
  });

  it('runs an agent whose prepare hook comes from agent.yaml', async () => {
    const getDiff = jest.spyOn(gitDiff, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    const tmp = makeTmpDir('cli-with-prepare');
    const { deps, stdout } = harness(claudeStdout(claudeSuccessLine()), { repoRoot: tmp.path });

    try {
      expect(await runAgentsCli(['with-prepare', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps)).toBe(
        0,
      );
      // --dry-run runs none of the steps: it shows where what they produce would go.
      expect(getDiff).not.toHaveBeenCalled();
      expect(stdout.chunks.join('')).toContain(' 1. [CLI]    execute.before 1/3 — git_diff: develop');
      expect(stdout.chunks.join('')).toContain('[execute.before 1/3 — git_diff: develop');
      expect(existsSync(join(tmp.path, '.cache'))).toBe(false);
      // The fixture's agent.yaml allows writing docs/, which becomes absolute from the workspace root.
      expect(dryRunArgv(stdout)).toContain('dontAsk');
      expect(dryRunArgv(stdout)).toContain(`Edit(/${tmp.path}/docs/**)`);
    } finally {
      tmp.cleanup();
      getDiff.mockRestore();
    }
  });

  it('does not require a task when the command says so', async () => {
    const { deps } = harness(claudeStdout(claudeSuccessLine()), {
      commands: [defineCommand({ name: 'echo', agent: 'echo', description: 'd', taskRequired: false })],
    });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES], deps)).toBe(0);
  });

  it('shows why an agent that exists does not load, instead of calling it unknown', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['missing-sections', '--agents-dir', FIXTURES, '--help'], deps)).toBe(1);
    const text = stderr.chunks.join('');
    expect(text).toContain("must have required property 'role'");
    expect(text).not.toContain('Unknown command');
  });

  it('reports a broken agent.yaml distinctly, after the command itself resolved', async () => {
    const { deps, stderr } = harness([], {
      commands: [defineCommand({ name: 'quick', agent: 'broken', description: 'd' })],
    });

    expect(await runAgentsCli(['quick', '--agents-dir', FIXTURES, 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('description');
  });

  it('rejects --plan-from combined with an explicit non-execute --mode', async () => {
    const { deps, stderr } = harness([]);

    const exitCode = await runAgentsCli(
      ['echo', '--agents-dir', FIXTURES, '--mode', 'ask', '--plan-from', 'x.md', 'x'],
      deps,
    );

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('--plan-from can only be used with --mode execute');
  });

  it('reports a missing --plan-from file distinctly from a missing task', async () => {
    const { deps, stderr } = harness([]);

    const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--plan-from', '/nope.md'], deps);

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Could not read plan');
  });

  it('rejects an invalid --provider value', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--provider', 'codex', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('unknown provider');
  });

  it('reports prepare failures without spawning the provider', async () => {
    const { deps, stderr } = harness([], {
      commands: [
        defineCommand({
          name: 'prepped',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: () => {
            throw new Error('prepare failed');
          },
        }),
      ],
    });

    expect(await runAgentsCli(['prepped', '--agents-dir', FIXTURES], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('prepare failed');
  });

  it('passes --since through to a command prepare hook', async () => {
    const sinceValues: (string | undefined)[] = [];
    const { deps, stdout } = harness([], {
      commands: [
        defineCommand({
          name: 'prepped',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: (input) => {
            sinceValues.push(input.since);
            return { task: 'prepared task', promptBody: 'preloaded context' };
          },
        }),
      ],
    });

    await runAgentsCli(['prepped', '--agents-dir', FIXTURES, '--since', 'HEAD~1', '--dry-run', '--show-prompt'], deps);

    expect(sinceValues).toEqual(['HEAD~1']);
    expect(stdout.chunks.join('')).toContain('preloaded context');
  });

  it('uses prepare output as the user prompt template', async () => {
    const { deps, stdout } = harness([], {
      commands: [
        defineCommand({
          name: 'prepped',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: () => ({ task: 'prepared task', promptBody: 'preloaded context' }),
        }),
      ],
    });

    await runAgentsCli(['prepped', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps);

    expect(stdout.chunks.join('')).toContain('preloaded context');
  });

  it('rejects a --model not declared in agent.yaml#supported_models, before touching the provider', async () => {
    const { deps, stdout, stderr } = harness([]);

    const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'gpt-3', 'x'], deps);

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('"gpt-3"');
    expect(stderr.chunks.join('')).toContain('claude-3-5-sonnet, gpt-4o');
    expect(stdout.chunks).toEqual([]);
  });

  it('reports when no configured provider binary can be found', async () => {
    const { deps, stderr } = harness([], { which: whichOf([]) });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('no working binary found');
  });

  it('falls back to CHOL_AGENTS_PROVIDER when --provider is not given', async () => {
    const { deps, stdout } = harness([], {
      which: whichOf(['cursor-agent']),
      config: { CHOL_AGENTS_PROVIDER: 'cursor' },
    });

    await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps);

    expect(dryRunArgv(stdout)[0]).toBe('cursor-agent');
    // cursor's permissions go into a file, which --show-prompt shows as it would be written.
    expect(stdout.chunks.join('')).toMatch(/── .*\.cursor\/cli\.json ──\n\{/);
  });

  it('prefers --provider over CHOL_AGENTS_PROVIDER', async () => {
    const { deps, stdout } = harness([], {
      which: whichOf(['claude', 'cursor-agent']),
      config: { CHOL_AGENTS_PROVIDER: 'cursor' },
    });

    await runAgentsCli(
      ['echo', '--agents-dir', FIXTURES, '--provider', 'claude', '--dry-run', '--show-prompt', 'x'],
      deps,
    );

    expect(dryRunArgv(stdout)[0]).toBe('claude');
  });

  describe('--dry-run', () => {
    it('prints what would run, in order, and never spawns', async () => {
      const spawnerHandle = fakeSpawner();
      const { deps, stdout } = harness([], { runner: new ProcessRunnerService({ spawner: spawnerHandle.spawner }) });

      expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'a task'], deps)).toBe(0);
      const text = stdout.chunks.join('');
      expect(text.startsWith('Sem --dry-run, faria nesta ordem:\n')).toBe(true);
      expect(text).toContain(' 2. [agente] claude · modelo padrão do provider · modo execute');
      expect(text).toContain('comando: claude -p <prompt do usuário>');
      expect(text).not.toContain(COMMAND_LINE_TITLE);
      expect(spawnerHandle.spawnCalls).toEqual([]);
    });

    it('prints the command line in full with --show-prompt', async () => {
      const { deps, stdout } = harness([]);

      await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'a task'], deps);

      const printed = dryRunArgv(stdout);
      expect(printed[0]).toBe('claude');
      expect(printed.at(printed.indexOf('-p') + 1)).toBe('Task:\na task');
    });

    it("resolves a command's own addDirs relative to repoRoot, alongside --add-dir", async () => {
      const { deps, stdout } = harness([], {
        repoRoot: FIXTURES,
        commands: [defineCommand({ name: 'quick', agent: 'echo', description: 'd', addDirs: ['extra'] })],
      });

      await runAgentsCli(
        ['quick', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', '--add-dir', '/cli-extra', 'x'],
        deps,
      );

      const printed = dryRunArgv(stdout);
      expect(printed).toEqual(expect.arrayContaining(['--add-dir', join(FIXTURES, 'extra'), '/cli-extra']));
    });

    it('lets the agent read each --add-dir, while what its deny.read names stays denied', async () => {
      const tmp = makeTmpDir('cli-add-dir-reads');
      try {
        const agentsDir = join(tmp.path, 'agents');
        mkdirSync(join(agentsDir, 'echo'), { recursive: true });
        const yaml = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
        writeFileSync(
          join(agentsDir, 'echo', 'agent.yaml'),
          yaml.replace('  deny:\n', '  deny:\n    read: [secret/]\n'),
        );
        const { deps, stdout } = harness([], { repoRoot: tmp.path });

        await runAgentsCli(
          [
            'echo',
            '--agents-dir',
            agentsDir,
            '--dry-run',
            '--show-prompt',
            '--add-dir',
            'notes',
            '--add-dir',
            'secret/',
            'x',
          ],
          deps,
        );

        const printed = dryRunArgv(stdout);
        const allowed = printed.slice(printed.indexOf('--allowedTools'), printed.indexOf('--disallowedTools'));
        const denied = printed.slice(printed.indexOf('--disallowedTools'));
        expect(allowed).toContain(`Read(/${tmp.path}/notes/**)`);
        expect(denied).toContain(`Read(/${tmp.path}/secret/**)`);
        expect(printed).toEqual(expect.arrayContaining(['--add-dir', join(tmp.path, 'notes')]));
      } finally {
        tmp.cleanup();
      }
    });

    it('defaults agentsDir to <repoRoot>/.choliba/agents, and does not add it as a folder the provider reads', async () => {
      const tmp = makeTmpDir('cli-default-agents-dir');
      try {
        cpSync(join(FIXTURES, 'echo'), join(tmp.path, '.choliba', 'agents', 'echo'), { recursive: true });
        const { deps, stdout } = harness([], { repoRoot: tmp.path });

        expect(await runAgentsCli(['echo', '--dry-run', '--show-prompt', 'x'], deps)).toBe(0);
        expect(dryRunArgv(stdout)).not.toContain('--add-dir');
      } finally {
        tmp.cleanup();
      }
    });

    it('never adds the agents dir, even outside the workspace root: an added folder is read freely', async () => {
      const { deps, stdout } = harness([], { repoRoot: '/repo' });

      await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps);

      expect(dryRunArgv(stdout)).not.toContain('--add-dir');
    });

    it('reports an oversized prompt cleanly instead of crashing', async () => {
      const { deps, stderr } = harness([]);

      const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'x'.repeat(200_000)], deps);

      expect(exitCode).toBe(1);
      expect(stderr.chunks.join('')).toMatch(/argument \d+ is \d+ bytes/);
    });

    it('honors an explicit command with a stronger policy than the implicit default', async () => {
      const { deps, stdout } = harness([], {
        commands: [defineCommand({ name: 'quick', agent: 'echo', description: 'd', policy: 'edits' })],
      });

      await runAgentsCli(['quick', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps);

      // echo declares nothing to write: even an edits command denies what is not allowed.
      expect(dryRunArgv(stdout)).toContain('dontAsk');
    });
  });

  /** A command `sync-docs` on the echo agent, with the given `after` hook and a prepare that runs nothing. */
  function syncDocs(after: NonNullable<Parameters<typeof defineCommand>[0]['after']>) {
    return defineCommand({
      name: 'sync-docs',
      agent: 'echo',
      description: 'd',
      taskRequired: false,
      policy: 'edits',
      prepare: () => ({ task: 'sync', promptBody: 'ctx' }),
      after,
    });
  }

  const failedStep = (status: number | undefined) => ({
    label: 'execute.after.success 1/1',
    step: { action: 'run', args: ['bunx', 'choliba', 'tests', 'x'] },
    status,
    output: 'CA-01 falhou',
  });

  it('runs the after hook once the agent is done, in every mode, with how the agent ended', async () => {
    const tmp = makeTmpDir('cli-after');
    try {
      const after = jest.fn(() => []);
      const { deps } = harness(claudeStdout(claudeSuccessLine('1. plan step')), {
        repoRoot: tmp.path,
        commands: [syncDocs(after)],
      });

      expect(await runAgentsCli(['sync-docs', '--agents-dir', FIXTURES, '--mode-plan'], deps)).toBe(0);
      expect(after).toHaveBeenCalledWith({ repoRoot: tmp.path, mode: 'plan', exitCode: 0 });
    } finally {
      tmp.cleanup();
    }
  });

  it('reports each after step that failed, and ends with its status when the agent succeeded', async () => {
    const tmp = makeTmpDir('cli-after-fail');
    try {
      const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
        repoRoot: tmp.path,
        commands: [syncDocs(() => [failedStep(3), failedStep(undefined)])],
      });

      expect(await runAgentsCli(['sync-docs', '--agents-dir', FIXTURES], deps)).toBe(3);
      expect(stderr.chunks.join('')).toContain(
        [
          '✗ execute.after.success 1/1 falhou — run: bunx choliba tests x (código 3)',
          '  CA-01 falhou',
          '✗ execute.after.success 1/1 falhou — run: bunx choliba tests x',
          '  CA-01 falhou',
          'O agente terminou com código 0; quem falhou foram os steps acima.',
          '',
        ].join('\n'),
      );
      expect(stderr.chunks.join('').match(/O agente terminou/g)).toHaveLength(1);
    } finally {
      tmp.cleanup();
    }
  });

  it("keeps the agent's exit code when the agent failed, even if an after step failed too", async () => {
    const tmp = makeTmpDir('cli-after-agent-fail');
    try {
      const failing = `${JSON.stringify({ type: 'result', is_error: true, result: 'boom' })}\n`;
      const after = jest.fn(() => [failedStep(3)]);
      const { deps, stderr } = harness(claudeStdout(failing), { repoRoot: tmp.path, commands: [syncDocs(after)] });

      const exitCode = await runAgentsCli(['sync-docs', '--agents-dir', FIXTURES], deps);

      expect(exitCode).not.toBe(0);
      expect(exitCode).not.toBe(3);
      expect(stderr.chunks.join('')).toContain(`O agente terminou com código ${String(exitCode)}.\n`);
      expect(after).toHaveBeenCalledWith({ repoRoot: tmp.path, mode: 'execute', exitCode });
    } finally {
      tmp.cleanup();
    }
  });

  it('stops before the agent when a before step fails, with the status of that step', async () => {
    const spawnerHandle = fakeSpawner();
    const { deps, stderr } = harness([], {
      runner: new ProcessRunnerService({ spawner: spawnerHandle.spawner }),
      commands: [
        defineCommand({
          name: 'guarded',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: () => {
            throw new StepFailedError({
              label: 'execute.before 1/2',
              step: { action: 'run', args: ['bunx', 'choliba', 'tests', 'x', '--expect', 'red'] },
              status: 2,
              output: 'nada a implementar',
            });
          },
        }),
      ],
    });

    expect(await runAgentsCli(['guarded', '--agents-dir', FIXTURES], deps)).toBe(2);
    expect(stderr.chunks.join('')).toBe(
      [
        '✗ execute.before 1/2 falhou — run: bunx choliba tests x --expect red (código 2)',
        '  nada a implementar',
        '  O agente não foi executado.',
        '',
      ].join('\n'),
    );
    expect(spawnerHandle.spawnCalls).toEqual([]);
  });

  describe('--plan mode', () => {
    it('saves the run to a plan file under <repoRoot>/plans and reports where', async () => {
      const tmp = makeTmpDir('cli-plan');
      try {
        const { deps, stdout } = harness(claudeStdout(claudeSuccessLine('1. do x')), { repoRoot: tmp.path });

        const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--mode-plan', 'plan it'], deps);

        expect(exitCode).toBe(0);
        const path = join(tmp.path, 'plans', 'echo', '2026-01-01T00-00-00Z-claude.plan-it.md');
        expect(stdout.chunks.join('')).toContain(path);
        expect(readPlan(path)).toBe('1. do x');
      } finally {
        tmp.cleanup();
      }
    });

    it('resuming a plan with --plan-from does not require a new task', async () => {
      const tmp = makeTmpDir('cli-plan-from');
      try {
        const planPath = join(tmp.path, 'saved-plan.md');
        writeFileSync(planPath, '1. step\n');
        const { deps } = harness(claudeStdout(claudeSuccessLine()), { repoRoot: tmp.path });

        const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--plan-from', planPath], deps);

        expect(exitCode).toBe(0);
      } finally {
        tmp.cleanup();
      }
    });
  });
});

/** An agent `custom` in a temp agents dir, with the given `agent.yaml` keys on top of the required ones. */
function withCustomAgent(extra: string[], run: (agentsDir: string) => Promise<void>): Promise<void> {
  const tmp = makeTmpDir('cli-custom-agent');
  const dir = join(tmp.path, 'custom');
  mkdirSync(dir, { recursive: true });
  const yaml = [
    'version: 1',
    'agent:',
    '  id: custom',
    '  name: Custom',
    '  version: 1.0.0',
    '  description: d',
    'models: [claude-3-5-sonnet]',
    ...SECTIONS,
    ...extra,
  ];
  writeFileSync(join(dir, 'agent.yaml'), `${yaml.join('\n')}\n`);
  return run(tmp.path).finally(tmp.cleanup);
}

describe('runAgentsCli — modes', () => {
  const MODES = ['modes:', '  allow: [plan, ask]'];

  it('runs in modes.default, the first allowed mode when execute is not', async () => {
    await withCustomAgent(MODES, async (agentsDir) => {
      const { deps, stdout } = harness([]);

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      expect(stdout.chunks.join('')).toContain('You have read-only tools in this session');
    });
  });

  it('refuses a mode the agent does not allow, by value or by shortcut', async () => {
    await withCustomAgent(MODES, async (agentsDir) => {
      const byValue = harness([]);
      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--mode', 'execute', 'x'], byValue.deps)).toBe(1);
      expect(byValue.stderr.chunks.join('')).toContain(
        'Mode "execute" is not allowed for "custom" (modes.allow: plan, ask).',
      );

      const byShortcut = harness([]);
      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--mode-execute', 'x'], byShortcut.deps)).toBe(1);
      expect(byShortcut.stderr.chunks.join('')).toContain('unknown flag: --mode-execute');
    });
  });

  it('lists only the allowed modes in the agent help', async () => {
    await withCustomAgent(MODES, async (agentsDir) => {
      const { deps, stdout } = harness([]);

      await runAgentsCli(['custom', '--agents-dir', agentsDir, '--help'], deps);
      const text = stdout.chunks.join('');
      expect(text).toContain('modes:\n  - plan\n  - ask\n');
      expect(text).toContain('--mode-ask');
      expect(text).not.toContain('--mode-execute');
    });
  });
});

describe('runAgentsCli — ${CHOL_ROOT}', () => {
  it('is the workspace root, found by the application, in the permissions', async () => {
    await withCustomAgent(['permissions:', '  allow:', "    read: ['${CHOL_ROOT}/docs/']"], async (agentsDir) => {
      const { deps, stdout } = harness([]);

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      expect(dryRunArgv(stdout)).toContain('Read(//repo/docs/**)');
    });
  });

  it('cannot be set in the config, stopping before anything else', async () => {
    const { deps, stderr } = harness([], { config: { CHOL_ROOT: '/outro' } });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('CHOL_ROOT is found by the application');
  });
});

describe('runAgentsCli — execute outside the workspace', () => {
  it('refuses a folder execute names that allow.read does not cover', async () => {
    await withCustomAgent(
      ['permissions:', '  allow:', '    execute:', '      /opt/app/: [composer test]'],
      async (agentsDir) => {
        const { deps, stderr } = harness([]);

        expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', 'x'], deps)).toBe(1);
        expect(stderr.chunks.join('')).toContain(
          '"custom" runs commands in /opt/app, which permissions.allow.read does not cover',
        );
      },
    );
  });

  it('lets the provider enter a readable folder execute names', async () => {
    const yaml = [
      'permissions:',
      '  allow:',
      '    read: [/opt/app/]',
      '    execute:',
      '      /opt/app/: [composer test]',
    ];
    await withCustomAgent(yaml, async (agentsDir) => {
      const { deps, stdout } = harness([]);

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      const printed = dryRunArgv(stdout);
      expect(printed.at(printed.indexOf('--add-dir') + 1)).toBe('/opt/app');
      expect(printed).toContain('Bash(composer test:*)');
    });
  });
});

describe('runAgentsCli — run dir', () => {
  it('makes each run folder under <repoRoot>/.cache/runs by default, and runs the provider there', async () => {
    const { deps: withRuns, stdout } = harness([], { which: whichOf(['cursor-agent']) });
    const { runsDir: _runsDir, ...deps } = withRuns;

    expect(
      await runAgentsCli(
        ['echo', '--agents-dir', FIXTURES, '--provider', 'cursor', '--dry-run', '--show-prompt', 'x'],
        deps,
      ),
    ).toBe(0);
    const printed = dryRunArgv(stdout);
    expect(printed.at(printed.indexOf('--workspace') + 1)).toBe(
      `/repo/.cache/runs/2026-01-01T00-00-00.000Z-${String(process.pid)}`,
    );
  });
});

describe('runAgentsCli — folder variables', () => {
  it('fills in ${CHOL_AGENTS_DIR} and the others under the same names as in .env', async () => {
    const yaml = [
      'permissions:',
      '  deny:',
      "    read: ['${CHOL_AGENTS_DIR}/', '${CHOL_SKILLS_DIR}/', '${CHOL_MCPS_DIR}/']",
    ];
    await withCustomAgent(yaml, async (agentsDir) => {
      const { deps, stdout } = harness([], { config: { CHOL_SKILLS_DIR: '/s', CHOL_MCPS_DIR: '/m' } });

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      expect(dryRunArgv(stdout)).toEqual(
        expect.arrayContaining(['Read(//repo/.choliba/agents/**)', 'Read(//s/**)', 'Read(//m/**)']),
      );
    });
  });

  it('knows no ${AGENTS_DIR}: the agent does not load, and the error lists the variables there are', async () => {
    await withCustomAgent(['permissions:', '  deny:', "    read: ['${AGENTS_DIR}/']"], async (agentsDir) => {
      const { deps, stderr } = harness([]);

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toMatch(
        /\$\{AGENTS_DIR\} \(em permissions\) não é uma variável do agent\.yaml; as que existem: CHOL_ROOT, CHOL_AGENTS_DIR/,
      );
    });
  });

  it('resolves the project locations when only agent.yaml names one of them', async () => {
    await withCustomAgent(['permissions:', '  allow:', "    read: ['${CHOL_PROJECTS_DIR}/']"], async (agentsDir) => {
      const { deps, stdout } = harness([], { config: { CHOL_GLOBAL_DIR: '/g' } });

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      expect(dryRunArgv(stdout)).toContain('Read(//g/projects/**)');
    });
  });
});
