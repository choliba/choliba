import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  buildTheme,
  complete,
  describe as describeSpec,
  formatSuggestions,
  ProcessRunnerService,
  type GitRunner,
  type SignalSource,
  type Writable,
} from '@choliba/core';
import { AppError, type ProjectSettings } from '@choliba/projects';
import * as projects from '@choliba/projects';

import * as gitDiff from '../../../agents/steps/git-working-tree-diff';

import { defineInvocation } from '../../../agents/invocation';
import { StepFailedError } from '../../../agents/steps/step-actions';
import { readPlan } from '../../../agents/runs/plan-store';
import type { RunAgentsCliDeps } from '../../../agents/runs/run-context';
import { agentsHelpSpec, runAgentsCli, runAgentsList } from '../../../agents/runs/run-agents';
import { COMMAND_LINE_TITLE } from '../../../agents/runs/dry-run';

import { PROVIDERS, PROVIDERS_WITH_OLLAMA } from '../../helpers/providers';
import { fakeSpawner, streamFromChunks } from '../../helpers/fake-spawner';
import { makeTmpDir } from '../../helpers/tmp';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'agents');
const SKILLS = join(__dirname, '..', '..', 'fixtures', 'skills');
const MCPS = join(__dirname, '..', '..', 'fixtures', 'mcps');
/** Where the runs of these cases make their empty folder: `/repo` is not a real folder. */
const RUNS = join(tmpdir(), `cli-run-spec-${String(process.pid)}`);
const LOGS = join(tmpdir(), `cli-run-logs-${String(process.pid)}`);

/** `stderr` without the line that ends every real run, saying where its log is. */
function withoutLogLine(stderr: string): string {
  return stderr.replace(/log em .*\.log\n$/, '');
}
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
  return (bin) => (available.includes(bin) ? '/usr/bin/true' : null);
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
    logsDir: LOGS,
    // The application of a project run counts as up: the specs that care pass their own.
    ensureApp: () => Promise.resolve({ started: false, stop: () => undefined }),
    ...overrides,
    // The fixture agents' skills live next to them; a test may still point elsewhere.
    config: {
      HOME: tmpdir(),
      CLAUDE_CODE_OAUTH_TOKEN: 'test-token',
      CURSOR_API_KEY: 'test-token',
      CHOL_SKILLS_DIR: SKILLS,
      ...overrides.config,
    },
  };
  return { deps, stdout, stderr };
}

describe('runAgentsCli — help', () => {
  it('prints usage and returns 0', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli([], deps)).toBe(0);
    expect(stdout.chunks.join('')).toContain('Usage:  choliba run agent AGENT [OPTIONS] [TASK...]');
  });

  it('rejects a malformed argv up front, before resolving anything', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['developer', '--bogus=1'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('opção desconhecida: --bogus=1');
  });

  it('prints per-agent help when --help follows the command name', async () => {
    const { deps, stdout } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--help'], deps)).toBe(0);
    const text = stdout.chunks.join('');
    expect(text).toContain('id: echo');
    expect(text).toContain('Policy: read-only');
    expect(text).toContain('Usage:  choliba run agent echo [OPTIONS] [TASK...]');
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
          'providers:',
          '  claude:',
          '    models: [claude-3-5-sonnet]',
          ...SECTIONS,
        ].join('\n'),
      );

      const { deps, stdout } = harness([]);
      expect(await runAgentsCli(['long-help', '--agents-dir', agentsDir, '--help'], deps)).toBe(0);
      const text = stdout.chunks.join('');
      expect(text).toContain('Usage:  choliba run agent long-help');
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
    expect(text).not.toContain('Commands:');
    expect(text).toContain("Run 'choliba run agent AGENT --help' for more information on an agent.");
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
    expect(lines(stdout)[0]).toMatch(/^Executa um agente da pasta de trabalho/);
    expect(lines(stdout)).toContain('Repete a tarefa recebida, usado nos testes deste pacote.');
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

describe('runAgentsCli — the application of a project run', () => {
  const RUN = ['with-project', '--agents-dir', FIXTURES, '--project', 'ready'];
  const projectConfig = (projectsDir: string) => ({ CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir });

  it("makes sure it is up before the run and stops it once the run is over, the agent's failure included", async () => {
    await withProjects(async (projectsDir) => {
      const seen: string[] = [];
      const ensureApp = (settings: ProjectSettings) => {
        seen.push(`ensure ${settings.project}`);
        return Promise.resolve({ started: true, stop: () => seen.push('stop') });
      };
      const failing = `${JSON.stringify({ type: 'result', is_error: true, result: 'boom' })}\n`;
      const ok = harness(claudeStdout(claudeSuccessLine()), { config: projectConfig(projectsDir), ensureApp });
      const failed = harness(claudeStdout(failing), { config: projectConfig(projectsDir), ensureApp });

      expect(await runAgentsCli([...RUN, 'x'], ok.deps)).toBe(0);
      expect(await runAgentsCli([...RUN, 'x'], failed.deps)).not.toBe(0);
      expect(seen).toEqual(['ensure ready', 'stop', 'ensure ready', 'stop']);
    });
  });

  it('does not run the agent when the application cannot be up, saying why', async () => {
    await withProjects(async (projectsDir) => {
      const ensureApp = () => Promise.reject(new AppError('a aplicação não responde em http://ready.test e …'));
      const { deps, stdout, stderr } = harness(claudeStdout(claudeSuccessLine()), {
        config: projectConfig(projectsDir),
        ensureApp,
      });

      expect(await runAgentsCli([...RUN, 'x'], deps)).toBe(1);
      expect(withoutLogLine(stderr.chunks.join(''))).toBe(
        '✗ a aplicação não responde em http://ready.test e …\n  O agente não foi executado.\n',
      );
      expect(stdout.chunks.join('')).not.toContain('[provider]');
    });
  });

  it('lets any other failure through, as a bug', async () => {
    await withProjects(async (projectsDir) => {
      const { deps } = harness([], {
        config: projectConfig(projectsDir),
        ensureApp: () => Promise.reject(new Error('bug')),
      });

      await expect(runAgentsCli([...RUN, 'x'], deps)).rejects.toThrow('bug');
    });
  });

  it('starts nothing on --dry-run, and says what it would do', async () => {
    await withProjects(async (projectsDir) => {
      const ensureApp = () => Promise.reject(new Error('must not be called'));
      const { deps, stdout } = harness([], { config: projectConfig(projectsDir), ensureApp });

      expect(await runAgentsCli([...RUN, '--dry-run'], deps)).toBe(0);
      expect(stdout.chunks.join('')).toContain(
        'confere http://ready.test: sem resposta, para aqui (o ambiente não tem envs[].start)',
      );
    });
  });

  it('checks the real application by default: down and without start, the agent does not run', async () => {
    await withProjects(async (projectsDir) => {
      const { ensureApp: _fake, ...deps } = harness(claudeStdout(claudeSuccessLine()), {
        config: projectConfig(projectsDir),
      }).deps;
      const stderr = deps.stderr as Writable & { chunks: string[] };

      expect(await runAgentsCli([...RUN, 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain(
        'a aplicação não responde em http://ready.test e o ambiente qa não tem envs[].start',
      );
    });
  });
});

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
        expect(shortcut.stderr.chunks.join('')).toContain('opção desconhecida: --type-task');
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

  it('creates the ticket for the run, removes it when the run leaves it untouched, and fails the run in execute', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        const told: string[] = [];
        const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
          config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
          ticket: (ticket) => told.push(ticket),
        });

        // Done in execute, its work, the ticket, was not: the run fails, and a sequence stops there.
        expect(await runAgentsCli(argv(agentsDir, '--type', 'story', 'x'), deps)).toBe(1);
        const file = join(projectsDir, 'ready', 'tickets', '1.json');
        expect(stderr.chunks.join('')).toContain(`Ticket "ready-1" não foi preenchido; ${file} foi removido.`);
        expect(existsSync(file)).toBe(false);
        // A ticket the run removed is no one's to work on.
        expect(told).toEqual([]);
        // In ask, the untouched ticket goes too, and the run keeps its code.
        const planned = harness(claudeStdout(claudeSuccessLine()), {
          config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
        });
        expect(await runAgentsCli(argv(agentsDir, '--type', 'story', '--mode', 'ask', 'x'), planned.deps)).toBe(0);
        expect(planned.stderr.chunks.join('')).toContain('não foi preenchido');
      }),
    );
  });

  it('tells its host the ticket it leaves, for the next agent of a sequence', async () => {
    await withProjects((projectsDir) =>
      withTicketAgent(async (agentsDir) => {
        mkdirSync(join(projectsDir, 'ready', 'tickets'), { recursive: true });
        writeFileSync(join(projectsDir, 'ready', 'tickets', '7.json'), '{}');
        const told: string[] = [];
        const { deps } = harness(claudeStdout(claudeSuccessLine()), {
          config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir },
          ticket: (ticket) => told.push(ticket),
        });

        expect(await runAgentsCli(argv(agentsDir, '--ticket', 'ready-7', '--mode', 'ask', 'x'), deps)).toBe(0);
        expect(told).toEqual(['ready-7']);
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
    expect(stderr.chunks.join('')).toContain('opção desconhecida: --type-bug');
  });
});

describe('runAgentsCli — --project', () => {
  it('requires --project from an agent with project_required, before anything else', async () => {
    const { deps, stdout, stderr } = harness([], { config: { CHOL_GLOBAL_DIR: '/g' } });

    expect(await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--dry-run'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain(
      'o projeto é obrigatório para "with-project" (ele usa uma variável de projeto ou ticket_types): passe --project <nome>.',
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
        'opção desconhecida: --project.',
        '',
        'Usage:  choliba run agent echo [OPTIONS] [TASK...]',
        '',
        "Run 'choliba run agent echo --help' for usage.",
        '',
      ].join('\n'),
    );
    expect(stdout.chunks).toEqual([]);
  });

  it('refuses the diff-base flags for an agent without git_diff', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--since-pending', '--dry-run', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('opção desconhecida: --since-pending');
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
    // The task goes on stdin, not in the command line: --show-prompt still prints it.
    expect(stdout.chunks.join('')).toContain('Task:');
    expect(printed).toContain(`Read(/${SKILLS}/dummy-skill/**)`);
    expect(printed).not.toContain('--add-dir');
  });

  it('stops before the provider when a listed skill does not exist', async () => {
    const { deps, stdout, stderr } = harness([], { config: { CHOL_SKILLS_DIR: undefined } });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('skill "dummy-skill" não encontrada: /repo/.choliba/skills/dummy-skill');
    expect(stdout.chunks).toEqual([]);
  });

  /** The `echo` fixture agent, copied to a tmp agents dir with `permissions.deny.read` set to `paths`. */
  function withDenyRead(paths: readonly string[]): { agentsDir: string; cleanup: () => void } {
    const tmp = makeTmpDir('run-deny-read');
    cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
    const yamlPath = join(tmp.path, 'echo', 'agent.yaml');
    writeFileSync(yamlPath, `${readFileSync(yamlPath, 'utf8')}    read: ${JSON.stringify(paths)}\n`);
    return { agentsDir: tmp.path, cleanup: tmp.cleanup };
  }

  it('keeps a listed skill readable under a deny.read that covers it, and denies the rest of that folder', async () => {
    const fixtures = dirname(SKILLS);
    const agents = withDenyRead([`${fixtures}/`]);
    try {
      const { deps, stdout } = harness([]);

      expect(
        await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--dry-run', '--show-prompt', 'x'], deps),
      ).toBe(0);
      const printed = dryRunArgv(stdout);
      expect(printed).toContain(`Read(/${SKILLS}/dummy-skill/**)`);
      expect(printed).toContain(`Read(/${fixtures}/agents/**)`);
      expect(printed).not.toContain(`Read(/${fixtures}/**)`);
      expect(printed.join('\n')).toContain(`- !${SKILLS}/dummy-skill/`);
    } finally {
      agents.cleanup();
    }
  });

  it('stops before the provider when a ! exception lies under no deny of its list', async () => {
    const agents = withDenyRead(['/elsewhere/', '!/repo/docs']);
    try {
      const { deps, stdout, stderr } = harness([]);

      expect(await runAgentsCli(['echo', '--agents-dir', agents.agentsDir, '--dry-run', 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain(
        'exception.read: /repo/docs não está dentro de nenhum caminho de deny.read',
      );
      expect(stdout.chunks).toEqual([]);
    } finally {
      agents.cleanup();
    }
  });

  it('does not grant the skills dir to an agent without skills, and denies writing it', async () => {
    const { deps, stdout } = harness([]);

    await runAgentsCli(['with-prepare', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps);
    const printed = dryRunArgv(stdout).join('\n');
    expect(printed).not.toContain(`Read(/${SKILLS}`);
    expect(printed).toContain(`Write(/${SKILLS}/**)`);
    expect(printed).toContain(`- ${SKILLS}/`);
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

describe('runAgentsList', () => {
  it('lists every agent under --agents-dir with the same detail block as --help', () => {
    const { deps, stdout } = harness([]);

    expect(runAgentsList(['--agents-dir', FIXTURES], deps)).toBe(0);
    const printed = stdout.chunks.join('');
    expect(printed).toContain('id: echo');
    expect(printed).toContain('name: Echo Agent');
    expect(printed).toContain('id: with-prepare');
    expect(printed).toContain('Policy: read-only | Modo padrão: execute | Task obrigatória: sim');
    expect(printed).toContain('Policy: edits | Modo padrão: execute | Task obrigatória: não');
    expect(printed).toContain('providers:\n  - claude: claude-3-5-sonnet\n  - cursor: gpt-4o');
    expect(printed).not.toContain('Usage:');
  });

  it('falls back to CHOL_AGENTS_DIR when --agents-dir is not given', () => {
    const { deps, stdout } = harness([], { config: { CHOL_AGENTS_DIR: FIXTURES } });

    runAgentsList([], deps);

    expect(stdout.chunks.join('')).toContain('id: echo');
  });

  it('reports no agents found, rather than an empty list, when the directory has none', () => {
    const tmp = makeTmpDir('cli-list-empty');
    try {
      const { deps, stdout } = harness([]);

      runAgentsList(['--agents-dir', tmp.path], deps);

      expect(stdout.chunks.join('')).toContain(`Nenhum agente encontrado em ${tmp.path}`);
    } finally {
      tmp.cleanup();
    }
  });

  it('prints its help, and refuses a flag it does not take', () => {
    const help = harness([]);
    expect(runAgentsList(['--help'], help.deps)).toBe(0);
    expect(help.stdout.chunks.join('')).toContain('Usage:  choliba list agents [OPTIONS]');

    const wrong = harness([]);
    expect(runAgentsList(['--nope'], wrong.deps)).toBe(1);
    expect(wrong.stderr.chunks.join('')).toContain('opção desconhecida: --nope.');
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
    expect(stderr.chunks.join('')).toContain('agente desconhecido: nope.');
  });

  it('requires a task for a command that needs one', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('a tarefa é obrigatória');
  });

  it('rejects a model the agent does not declare', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'nope', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain(
      'O modelo nope não está declarado no agente echo (claude: claude-3-5-sonnet · cursor: gpt-4o).',
    );
  });

  it('accepts a declared --model before spawning the provider', async () => {
    const { deps } = harness(claudeStdout(claudeSuccessLine()));

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'claude-3-5-sonnet', 'x'], deps)).toBe(0);
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
      commands: [defineInvocation({ name: 'echo', agent: 'echo', description: 'd', taskRequired: false })],
    });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES], deps)).toBe(0);
  });

  it('writes the log of the run as it goes: the header, the provider, its lines, the agent time and the end', async () => {
    const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
      commands: [defineInvocation({ name: 'echo', agent: 'echo', description: 'd', taskRequired: false })],
    });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES], deps)).toBe(0);
    const path = /log em (.*\.log)\n$/.exec(stderr.chunks.join(''))?.[1] ?? '';
    const log = readFileSync(path, 'utf8');

    expect(path.startsWith(join(LOGS, 'echo'))).toBe(true);
    expect(log).toMatch(
      /^choliba run agent echo 1\.0\.0\nmodo: execute\nprojeto: —\nticket: —\nsandbox: local\ntarefa: /,
    );
    expect(log).toContain('[choliba] provider claude · modelo padrão do provider');
    expect(log).toContain(`[provider] ${claudeInitLine()}`);
    expect(log).toMatch(/\[choliba\] agente terminou: código 0 · tempo do agente \d/);
    expect(log).toMatch(/\[choliba\] fim: código 0 · tempo total \d+(\.\d)?m?s\n$/);
  });

  it('shows why an agent that exists does not load, instead of calling it unknown', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['missing-sections', '--agents-dir', FIXTURES, '--help'], deps)).toBe(1);
    const text = stderr.chunks.join('');
    expect(text).toContain("must have required property 'role'");
    expect(text).not.toContain('agente desconhecido');
  });

  it('reports a broken agent.yaml distinctly, after the command itself resolved', async () => {
    const { deps, stderr } = harness([], {
      commands: [defineInvocation({ name: 'quick', agent: 'broken', description: 'd' })],
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
    expect(stderr.chunks.join('')).toContain('--plan-from só pode ser usado com --mode execute');
  });

  it('reports a missing --plan-from file distinctly from a missing task', async () => {
    const { deps, stderr } = harness([]);

    const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--plan-from', '/nope.md'], deps);

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('não foi possível ler o plano');
  });

  it('rejects an invalid --provider value', async () => {
    const { deps, stderr } = harness([]);

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--provider', 'gpt', 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain('unknown provider');
  });

  it('reports prepare failures without spawning the provider', async () => {
    const { deps, stderr } = harness([], {
      commands: [
        defineInvocation({
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
        defineInvocation({
          name: 'prepped',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: (input) => {
            sinceValues.push(input.since);
            return Promise.resolve({ task: 'prepared task', promptBody: 'preloaded context' });
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
        defineInvocation({
          name: 'prepped',
          agent: 'echo',
          description: 'd',
          taskRequired: false,
          prepare: () => Promise.resolve({ task: 'prepared task', promptBody: 'preloaded context' }),
        }),
      ],
    });

    await runAgentsCli(['prepped', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt'], deps);

    expect(stdout.chunks.join('')).toContain('preloaded context');
  });

  it('rejects a --model the agent does not declare, before touching the provider', async () => {
    const { deps, stdout, stderr } = harness([]);

    const exitCode = await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--model', 'gpt-3', 'x'], deps);

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('O modelo gpt-3 não está declarado no agente echo');
    expect(stdout.chunks).toEqual([]);
  });

  it('reports when no configured provider binary can be found', async () => {
    const { deps, stderr } = harness([], { which: whichOf([]) });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], deps)).toBe(1);
    expect(stderr.chunks.join('')).toContain(
      'Nenhum provider que o agente echo declara está instalado: claude, cursor.',
    );
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
      expect(text).toContain('comando: claude -p --input-format stream-json');
      expect(text).not.toContain(COMMAND_LINE_TITLE);
      expect(spawnerHandle.spawnCalls).toEqual([]);
    });

    it('prints the command line in full with --show-prompt', async () => {
      const { deps, stdout } = harness([]);

      await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'a task'], deps);

      const printed = dryRunArgv(stdout);
      expect(printed[0]).toBe('claude');
      expect(printed.slice(1, 4)).toEqual(['-p', '--input-format', 'stream-json']);
      // The task goes on stdin; the prompt sections still show it.
      expect(stdout.chunks.join('')).toContain('Task:\na task');
    });

    it("resolves a command's own addDirs relative to repoRoot, alongside --add-dir", async () => {
      const { deps, stdout } = harness([], {
        repoRoot: FIXTURES,
        commands: [defineInvocation({ name: 'quick', agent: 'echo', description: 'd', addDirs: ['extra'] })],
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

    it('reports an oversized prompt cleanly instead of crashing, for a provider that takes it as an argument', async () => {
      const { deps, stderr } = harness([], { which: whichOf(['claude', 'agent']) });

      const argv = ['echo', '--agents-dir', FIXTURES, '--cursor', '--dry-run', 'x'.repeat(200_000)];
      const exitCode = await runAgentsCli(argv, deps);

      expect(exitCode).toBe(1);
      expect(stderr.chunks.join('')).toMatch(/argument \d+ is \d+ bytes/);
    });

    it('honors an explicit command with a stronger policy than the implicit default', async () => {
      const { deps, stdout } = harness([], {
        commands: [defineInvocation({ name: 'quick', agent: 'echo', description: 'd', policy: 'edits' })],
      });

      await runAgentsCli(['quick', '--agents-dir', FIXTURES, '--dry-run', '--show-prompt', 'x'], deps);

      // echo declares nothing to write: even an edits command denies what is not allowed.
      expect(dryRunArgv(stdout)).toContain('dontAsk');
    });
  });

  /** A command `sync-docs` on the echo agent, with the given `after` hook and a prepare that runs nothing. */
  function syncDocs(after: NonNullable<Parameters<typeof defineInvocation>[0]['after']>) {
    return defineInvocation({
      name: 'sync-docs',
      agent: 'echo',
      description: 'd',
      taskRequired: false,
      policy: 'edits',
      prepare: () => Promise.resolve({ task: 'sync', promptBody: 'ctx' }),
      after,
    });
  }

  const failedStep = (status: number | undefined) => ({
    label: 'execute.after.success 1/1',
    step: { action: 'run', args: ['bunx', 'choliba', 'tests', 'x'] },
    status,
    output: 'CA-01 falhou',
  });

  it("hands the run's signal to the steps before and after the agent", async () => {
    const tmp = makeTmpDir('cli-signal');
    try {
      const signal = new AbortController().signal;
      const seen: (AbortSignal | undefined)[] = [];
      const command = defineInvocation({
        name: 'sync-docs',
        agent: 'echo',
        description: 'd',
        taskRequired: false,
        policy: 'edits',
        prepare: (input) => {
          seen.push(input.signal);
          return Promise.resolve({ task: 'sync', promptBody: 'ctx' });
        },
        after: (input) => {
          seen.push(input.signal);
          return Promise.resolve([]);
        },
      });
      const { deps } = harness(claudeStdout(claudeSuccessLine()), { repoRoot: tmp.path, commands: [command], signal });

      expect(await runAgentsCli(['sync-docs', '--agents-dir', FIXTURES], deps)).toBe(0);
      expect(seen).toEqual([signal, signal]);
    } finally {
      tmp.cleanup();
    }
  });

  it('runs the after hook once the agent is done, in every mode, with how the agent ended and its answer', async () => {
    const tmp = makeTmpDir('cli-after');
    try {
      const after = jest.fn(() => Promise.resolve([]));
      const { deps } = harness(claudeStdout(claudeSuccessLine('1. plan step')), {
        repoRoot: tmp.path,
        commands: [syncDocs(after)],
      });

      expect(await runAgentsCli(['sync-docs', '--agents-dir', FIXTURES, '--mode-plan'], deps)).toBe(0);
      expect(after).toHaveBeenCalledWith({ repoRoot: tmp.path, mode: 'plan', exitCode: 0, answer: '1. plan step' });
    } finally {
      tmp.cleanup();
    }
  });

  it('reports each after step that failed, and ends with its status when the agent succeeded', async () => {
    const tmp = makeTmpDir('cli-after-fail');
    try {
      const { deps, stderr } = harness(claudeStdout(claudeSuccessLine()), {
        repoRoot: tmp.path,
        commands: [syncDocs(() => Promise.resolve([failedStep(3), failedStep(undefined)]))],
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
      const after = jest.fn(() => Promise.resolve([failedStep(3)]));
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
        defineInvocation({
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
    expect(withoutLogLine(stderr.chunks.join(''))).toBe(
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
    'providers:',
    '  claude:',
    '    models: [claude-3-5-sonnet]',
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
        'o modo "execute" não é permitido para "custom" (modes.allow: plan, ask).',
      );

      const byShortcut = harness([]);
      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--mode-execute', 'x'], byShortcut.deps)).toBe(1);
      expect(byShortcut.stderr.chunks.join('')).toContain('opção desconhecida: --mode-execute');
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
    expect(printed.at(printed.indexOf('--workspace') + 1)).toBe('/repo');
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

describe('runAgentsCli — definition folders', () => {
  const permissions = (lines: readonly string[]): string[] => ['permissions:', ...lines];

  it('denies every run writes and deletes there, and the prompt and the provider rules say so', async () => {
    await withCustomAgent(permissions(['  allow:', "    write: ['${CHOL_ROOT}/']"]), async (agentsDir) => {
      const skills = join(agentsDir, 'skills');
      const mcps = join(agentsDir, 'mcps');
      const { deps, stdout } = harness([], {
        repoRoot: agentsDir,
        config: { CHOL_SKILLS_DIR: skills, CHOL_MCPS_DIR: mcps },
      });

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', '--show-prompt', 'x'], deps)).toBe(
        0,
      );
      const text = stdout.chunks.join('');
      expect(text).toContain('You may not write:');
      expect(text).toContain('You may not delete:');
      const rules = dryRunArgv(stdout).join('\n');
      for (const dir of [agentsDir, skills, mcps]) {
        expect(text).toContain(`- ${dir}/`);
        expect(rules).toContain(`Write(/${dir}/**)`);
      }
    });
  });

  it('refuses a ! exception inside a definition folder', async () => {
    await withCustomAgent(permissions(['  deny:', "    write: ['!${CHOL_AGENTS_DIR}/x/']"]), async (agentsDir) => {
      const { deps, stderr } = harness([], { config: { CHOL_AGENTS_DIR: agentsDir } });

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', 'x'], deps)).toBe(1);
      const text = stderr.chunks.join('');
      expect(text).toContain('reabre pastas de definição que o choliba protege');
      expect(text).toContain(`${agentsDir}/x`);
      expect(text).toContain('Uma exception não pode ficar dentro das pastas de agentes, skills ou MCPs.');
    });
  });

  it('exits 1 and lists a file the provider wrote under the skills dir, leaving it there', async () => {
    const tmp = makeTmpDir('def-snapshot');
    try {
      const skills = join(tmp.path, 'skills');
      cpSync(SKILLS, skills, { recursive: true });
      const planted = join(skills, 'planted.md');
      const inner = fakeSpawner({ stdout: streamFromChunks(claudeStdout(claudeSuccessLine())) });
      const runner = new ProcessRunnerService({
        spawner: {
          spawn(options) {
            writeFileSync(planted, 'planted\n');
            return inner.spawner.spawn(options);
          },
        },
      });
      const { deps, stderr } = harness([], { runner, config: { CHOL_SKILLS_DIR: skills } });

      expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'do the task'], deps)).toBe(1);
      const text = stderr.chunks.join('');
      expect(text).toContain(`criado ${planted}`);
      expect(text).toContain('Nada foi desfeito.');
      expect(existsSync(planted)).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  it('mounts the three folders read-only in a docker dry-run, never writable', async () => {
    await withCustomAgent(permissions(['  allow:', "    write: ['${CHOL_ROOT}/']"]), async (agentsDir) => {
      const skills = join(agentsDir, '.choliba', 'skills');
      const mcps = join(agentsDir, '.choliba', 'mcps');
      mkdirSync(skills, { recursive: true });
      mkdirSync(mcps, { recursive: true });
      const { deps, stdout } = harness([], {
        which: whichOf(['claude', 'docker']),
        repoRoot: agentsDir,
        config: { CHOL_SKILLS_DIR: skills, CHOL_MCPS_DIR: mcps, CHOL_SANDBOX: 'docker' },
      });

      expect(await runAgentsCli(['custom', '--agents-dir', agentsDir, '--dry-run', 'x'], deps)).toBe(0);
      const linesOf = stdout.chunks.join('').split('\n');
      for (const dir of [agentsDir, skills, mcps]) {
        expect(linesOf.some((line) => line.endsWith(`leitura ${dir}`))).toBe(true);
        expect(linesOf.some((line) => line.endsWith(`escrita ${dir}`))).toBe(false);
      }
    });
  });
});

describe('runAgentsCli — CHOL_SANDBOX', () => {
  it('stops before anything runs on a value it does not take, or docker without Docker', async () => {
    const wrong = harness([], { config: { CHOL_SANDBOX: 'podman' } });
    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], wrong.deps)).toBe(1);
    expect(wrong.stderr.chunks.join('')).toContain('CHOL_SANDBOX="podman" não existe');

    const noDocker = harness([], { config: { CHOL_SANDBOX: 'docker' } });
    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], noDocker.deps)).toBe(1);
    expect(noDocker.stderr.chunks.join('')).toContain('O sandbox docker precisa do comando docker');
  });

  it('takes --sandbox over CHOL_SANDBOX for this run, and refuses a value it does not take', async () => {
    const docker = harness([], { which: whichOf(['agent', 'docker']), config: { CHOL_SANDBOX: 'local' } });
    const argv = ['echo', '--agents-dir', FIXTURES, '--provider', 'cursor', '--dry-run'];
    expect(await runAgentsCli([...argv, '--sandbox', 'docker', 'x'], docker.deps)).toBe(0);
    expect(docker.stdout.chunks.join('')).toContain('num container (docker, imagem choliba-agent)');

    const local = harness([], { which: whichOf(['claude']), config: { CHOL_SANDBOX: 'docker' } });
    expect(
      await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', '--sandbox', 'local', 'x'], local.deps),
    ).toBe(0);
    expect(local.stdout.chunks.join('')).toContain('no bwrap, que só vê:');

    const wrong = harness([]);
    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--sandbox', 'vm', 'x'], wrong.deps)).toBe(1);
    expect(wrong.stderr.chunks.join('')).toContain('--sandbox precisa ser local ou docker, não "vm".');
  });

  it('says in --dry-run which container the provider would run in, writing nothing', async () => {
    const { deps, stdout } = harness([], { which: whichOf(['agent', 'docker']), config: { CHOL_SANDBOX: 'docker' } });

    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--provider', 'cursor', '--dry-run', 'x'], deps)).toBe(
      0,
    );
    const text = stdout.chunks.join('');
    expect(text).toContain('num container (docker, imagem choliba-agent), que só vê:');
    expect(text).toMatch(/escrita .*cli-run-spec-\d+\//);
  });

  it('says in --dry-run what bwrap would mount, and refuses the command when bwrap is missing', async () => {
    const present = harness([], { which: whichOf(['claude']) });
    expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'x'], present.deps)).toBe(0);
    expect(present.stdout.chunks.join('')).toContain('no bwrap, que só vê:');

    const saved = process.env['PATH'];
    process.env['PATH'] = '';
    try {
      const missing = harness([], { which: whichOf(['claude']) });
      expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, '--dry-run', 'x'], missing.deps)).toBe(1);
      expect(missing.stderr.chunks.join('')).toContain('sudo apt install bubblewrap');
    } finally {
      process.env['PATH'] = saved;
    }
  });

  it("opens the project's ticket-runs in --dry-run without creating it", async () => {
    await withProjects(async (projectsDir) => {
      const { deps, stdout } = harness([], {
        which: whichOf(['claude', 'docker']),
        config: { CHOL_GLOBAL_DIR: '/g', CHOL_PROJECTS_DIR: projectsDir, CHOL_SANDBOX: 'docker' },
      });

      expect(
        await runAgentsCli(['with-project', '--agents-dir', FIXTURES, '--project', 'ready', '--dry-run', 'x'], deps),
      ).toBe(0);
      expect(stdout.chunks.join('')).toContain(`escrita ${projectsDir}`);
      expect(existsSync(join(projectsDir, 'ready', 'ticket-runs'))).toBe(false);
    });
  });

  it('gives the agent in the container the address of a local application and of a local MCP server', async () => {
    await withProjects(async (projectsDir) => {
      const local = join(projectsDir, 'local');
      mkdirSync(local);
      writeFileSync(
        join(local, 'config.json'),
        JSON.stringify({ name: 'Local', envs: [{ nome: 'qa', baseURL: 'http://localhost:3000', appDir: 'app' }] }),
      );
      writeFileSync(join(local, '.env.json'), JSON.stringify({ qa: {} }));
      const mcps = join(projectsDir, 'mcps');
      mkdirSync(mcps);
      writeFileSync(join(mcps, 'web.json'), JSON.stringify({ url: 'http://localhost:8931/mcp' }));
      const agents = makeTmpDir('run-mcp-url');
      cpSync(join(FIXTURES, 'with-project'), join(agents.path, 'with-project'), { recursive: true });
      const yamlPath = join(agents.path, 'with-project', 'agent.yaml');
      writeFileSync(yamlPath, `${readFileSync(yamlPath, 'utf8')}mcps:\n  - web\n`);
      try {
        const { deps, stdout } = harness([], {
          which: whichOf(['claude', 'docker']),
          config: {
            CHOL_GLOBAL_DIR: '/g',
            CHOL_PROJECTS_DIR: projectsDir,
            CHOL_MCPS_DIR: mcps,
            CHOL_SANDBOX: 'docker',
          },
        });

        expect(
          await runAgentsCli(
            ['with-project', '--agents-dir', agents.path, '--project', 'local', '--dry-run', '--show-prompt', 'x'],
            deps,
          ),
        ).toBe(0);
        const text = stdout.chunks.join('');
        expect(text).toContain('confere http://localhost:3000');
        expect(text).toContain('o agente, no container, a acessa em http://host.docker.internal:3000');
        expect(text).toContain('baseURL="http://host.docker.internal:3000"');
        const printed = dryRunArgv(stdout);
        expect(printed.at(printed.indexOf('--mcp-config') + 1)).toBe(
          JSON.stringify({ mcpServers: { web: { url: 'http://host.docker.internal:8931/mcp' } } }),
        );
      } finally {
        agents.cleanup();
      }
    });
  });

  it('starts the provider with docker run, passing the credentials by name and their values in its environment', async () => {
    const tmp = makeTmpDir('cli-sandbox');
    try {
      const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([claudeSuccessLine()]) });
      const { deps } = harness([], {
        runner: new ProcessRunnerService({ spawner: spawnerHandle.spawner }),
        which: whichOf(['claude', 'docker']),
        repoRoot: tmp.path,
        config: { CHOL_SANDBOX: 'docker', CHOL_SANDBOX_IMAGE: 'minha:1', CLAUDE_CODE_OAUTH_TOKEN: 'segredo' },
      });

      expect(await runAgentsCli(['echo', '--agents-dir', FIXTURES, 'x'], deps)).toBe(0);
      const [call] = spawnerHandle.spawnCalls;
      expect(call?.command.slice(0, 2)).toEqual(['docker', 'run']);
      expect(call?.command).toContain('minha:1');
      expect(call?.command.join(' ')).toContain('--env CLAUDE_CODE_OAUTH_TOKEN');
      expect(call?.command.join(' ')).not.toContain('segredo');
      expect(call?.env).toMatchObject({ CLAUDE_CODE_OAUTH_TOKEN: 'segredo' });
    } finally {
      tmp.cleanup();
    }
  });
});

describe('runAgentsCli — the providers an agent declares', () => {
  /** An agent `local` that declares `providers`, each id with its models, in this order. */
  function withAgent(
    providers: Readonly<Record<string, readonly string[]>>,
    run: (agentsDir: string) => Promise<void>,
  ): Promise<void> {
    const tmp = makeTmpDir('cli-providers-agent');
    const dir = join(tmp.path, 'local');
    mkdirSync(dir, { recursive: true });
    const declared = Object.entries(providers).flatMap(([id, models]) => [
      `  ${id}:`,
      `    models: [${models.map((model) => JSON.stringify(model)).join(', ')}]`,
    ]);
    const yaml = [
      'version: 1',
      'agent:',
      '  id: local',
      '  name: Local',
      '  version: 1.0.0',
      '  description: d',
      'providers:',
      ...declared,
      ...SECTIONS,
    ];
    writeFileSync(join(dir, 'agent.yaml'), `${yaml.join('\n')}\n`);
    return run(tmp.path).finally(tmp.cleanup);
  }

  const MIXED = { claude: ['claude-3-5-sonnet'], 'claude-ollama': ['qwen3.5:4b'] };

  it('asks claude-ollama for the first model the agent declares for it, as Ollama names it', async () => {
    await withAgent(MIXED, async (agentsDir) => {
      const { deps, stdout } = harness([], { providers: PROVIDERS_WITH_OLLAMA });

      const argv = ['local', '--agents-dir', agentsDir, '--claude-ollama', '--dry-run', '--show-prompt', 'x'];
      expect(await runAgentsCli(argv, deps)).toBe(0);
      const args = dryRunArgv(stdout);
      expect(args.at(args.indexOf('--model') + 1)).toBe('qwen3.5:4b');
    });
  });

  it("checks the model the stream reports against the models of the run's provider", async () => {
    await withAgent(MIXED, async (agentsDir) => {
      const argv = ['local', '--agents-dir', agentsDir, '--provider', 'claude-ollama', 'x'];
      const ok = harness([claudeInitLine('qwen3.5:4b'), claudeSuccessLine()], { providers: PROVIDERS_WITH_OLLAMA });
      expect(await runAgentsCli(argv, ok.deps)).toBe(0);

      // claude-3-5-sonnet is declared, but for claude: on claude-ollama it stops the session.
      const other = harness([claudeInitLine('claude-3-5-sonnet'), claudeSuccessLine()], {
        providers: PROVIDERS_WITH_OLLAMA,
      });
      expect(await runAgentsCli(argv, other.deps)).toBe(1);
      expect(other.stderr.chunks.join('')).toContain('agent.yaml#providers.claude-ollama.models');
    });
  });

  it('runs with the first declared provider that is installed under auto, and refuses a preference it does not declare', async () => {
    await withAgent({ 'claude-ollama': ['qwen3.5:4b'] }, async (agentsDir) => {
      const auto = harness([], { providers: PROVIDERS_WITH_OLLAMA });
      expect(await runAgentsCli(['local', '--agents-dir', agentsDir, '--dry-run', 'x'], auto.deps)).toBe(0);
      expect(auto.stdout.chunks.join('')).toContain('[agente] claude-ollama · modelo qwen3.5:4b');

      const preferred = harness([], { providers: PROVIDERS_WITH_OLLAMA, config: { CHOL_AGENTS_PROVIDER: 'claude' } });
      expect(await runAgentsCli(['local', '--agents-dir', agentsDir, '--dry-run', 'x'], preferred.deps)).toBe(1);
      expect(preferred.stderr.chunks.join('')).toContain(
        'O agente local não declara o provider claude (declara: claude-ollama).',
      );
    });
  });

  it('runs --model on the provider that declares it, and refuses a model two providers declare', async () => {
    await withAgent(MIXED, async (agentsDir) => {
      const { deps, stdout } = harness([], { providers: PROVIDERS_WITH_OLLAMA });
      const argv = ['local', '--agents-dir', agentsDir, '--model', 'qwen3.5:4b', '--dry-run', 'x'];
      expect(await runAgentsCli(argv, deps)).toBe(0);
      expect(stdout.chunks.join('')).toContain('[agente] claude-ollama · modelo qwen3.5:4b');
    });
    await withAgent({ claude: ['m'], cursor: ['m'] }, async (agentsDir) => {
      const { deps, stderr } = harness([], { providers: PROVIDERS_WITH_OLLAMA });
      expect(await runAgentsCli(['local', '--agents-dir', agentsDir, '--model', 'm', 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain(
        'O modelo m está declarado em claude e cursor: diga qual com --provider.',
      );
    });
  });

  it('refuses a model the chosen provider does not declare, and a provider the agent does not declare', async () => {
    await withAgent(MIXED, async (agentsDir) => {
      const { deps, stderr } = harness([], { providers: PROVIDERS_WITH_OLLAMA });
      const argv = ['local', '--agents-dir', agentsDir, '--claude', '--model', 'qwen3.5:4b', 'x'];
      expect(await runAgentsCli(argv, deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain('O modelo qwen3.5:4b não está entre os de claude no agente local');
    });
    await withAgent({ claude: ['claude-3-5-sonnet'] }, async (agentsDir) => {
      const { deps, stderr } = harness([], { providers: PROVIDERS_WITH_OLLAMA });
      expect(await runAgentsCli(['local', '--agents-dir', agentsDir, '--claude-ollama', 'x'], deps)).toBe(1);
      expect(stderr.chunks.join('')).toContain(
        'O agente local não declara o provider claude-ollama (declara: claude).',
      );
    });
  });
});
