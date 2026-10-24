import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildTheme, ProcessRunnerService, type Panel, type PanelOptions, type PanelReply } from '@choliba/shell';
import { type ProcessSpawner, type SignalSource, type Writable } from '@choliba/kernel';

import { type AgentDefinition, NO_PERMISSIONS, readAgentPermissions } from '@choliba/domain';
import {
  type AgentEvent,
  readPlan,
  type AgentProvider,
  type PlanContentContext,
  type ProviderRequest,
  type ResolvedProvider,
  type RunFooterInfo,
  everySecond,
} from '@choliba/engine';
import { type RunAgentDeps, type RunAgentRequest, runAgent } from '../../../agents/agents/runs/run-agent';
import {
  createRunScreen,
  FOOTER_REFRESH_MS,
  screenWidth,
  type RunScreenDeps,
} from '../../../agents/agents/runs/run-screen';
import { erroringStream, fakeSpawner, streamFromChunks, throwingSpawner } from '../../helpers/fake-spawner';
import { makeTmpDir } from '../../helpers/tmp';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';

/** A run dir of its own per request: `runAgent` creates it and removes it. */
let runDirCount = 0;
function freshRunDir(): string {
  runDirCount += 1;
  return join(tmpdir(), `run-agent-spec-${String(process.pid)}-${String(runDirCount)}`, 'runs', 'x');
}

function cursorResolvePlan(context: PlanContentContext): string | undefined {
  const content = context.planMarkdown?.trim();
  if (content === undefined || content === '') {
    return undefined;
  }
  return content;
}

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

function fakeSignalSource(): { source: SignalSource; trigger: (event: NodeJS.Signals) => void } {
  const listeners = new Map<NodeJS.Signals, Set<() => void>>();
  return {
    source: {
      on(event, listener) {
        const set = listeners.get(event) ?? new Set<() => void>();
        set.add(listener);
        listeners.set(event, set);
      },
      off(event, listener) {
        listeners.get(event)?.delete(listener);
      },
    },
    trigger(event) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
  };
}

function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'echo',
    id: 'example-echo-agent',
    displayName: 'Echo Agent',
    version: '1.0.0',
    description: 'repeats things',
    providers: [],
    skills: [],
    mcps: [],
    policy: 'read-only',
    taskRequired: true,
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute', 'plan', 'ask'],
    permissions: NO_PERMISSIONS,
    dir: '/repo/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/repo/agents/echo/agent.yaml',
    ...overrides,
  };
}

/**
 * Feeds each stdout line straight through `JSON.parse` as an `AgentEvent` — the provider's own
 * translation from its native format is tested separately (`providers/*.spec.ts`); here we only
 * care what `runAgent` does with the already-normalized events.
 */
function fakeAdapter(overrides: Partial<AgentProvider> = {}): AgentProvider {
  return {
    id: 'claude',
    binaries: [['fake']],
    autoPriority: 1,
    credentials: ['FAKE_TOKEN'],
    credentialHelp: 'set FAKE_TOKEN',
    needsModel: false,
    enforcesExecute: true,
    oneShotInput: false,
    unenforcedTools: [],
    inAuto: true,
    declaredModel: (model) => model,
    buildArgs: () => ['--arg'],
    createParser: () => {
      let sawInitWithModel = false;
      return {
        get sawInitWithModel() {
          return sawInitWithModel;
        },
        parseLine(line: string) {
          const trimmed = line.trim();
          if (trimmed === '') {
            return [];
          }
          const event = JSON.parse(trimmed) as AgentEvent;
          if (event.type === 'init' && event.model !== undefined) {
            sawInitWithModel = true;
          }
          return [event];
        },
      };
    },
    ...overrides,
    localReadOnly: overrides.localReadOnly ?? ((executable) => [executable]),
  };
}

function eventLines(events: readonly AgentEvent[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('');
}

interface Setup {
  readonly runner: ProcessRunnerService;
  readonly stdout: Writable & { chunks: string[] };
  readonly stderr: Writable & { chunks: string[] };
  readonly signals: SignalSource;
  readonly request: (
    overrides?: Partial<RunAgentRequest>,
    providerOverrides?: Partial<ProviderRequest>,
  ) => RunAgentRequest;
}

function setup(spawner: ProcessSpawner, adapterOverrides: Partial<AgentProvider> = {}, plansDir = '/plans'): Setup {
  const runner = new ProcessRunnerService({ spawner });
  const stdout = fakeWritable();
  const stderr = fakeWritable();
  const { source: signals } = fakeSignalSource();
  const adapter = fakeAdapter(adapterOverrides);

  return {
    runner,
    stdout,
    stderr,
    signals,
    request: (overrides = {}, providerOverrides = {}) => ({
      provider: { adapter, command: ['fake-bin'], executable: '/bin/fake-bin' } satisfies ResolvedProvider,
      providerRequest: {
        agent: fakeAgent(),
        mode: 'execute',
        policy: 'read-only',
        userPrompt: 'do it',
        workspaceRoot: '/repo',
        runDir: freshRunDir(),
        addDirs: [],
        model: undefined,
        ...providerOverrides,
      },
      commandName: 'echo',
      task: 'do it',
      plansDir,
      theme: buildTheme({}, false),
      ...overrides,
    }),
  };
}

async function run(
  setupResult: Setup,
  overrides?: Partial<RunAgentRequest>,
  providerOverrides?: Partial<ProviderRequest>,
): Promise<number> {
  return runAgent(setupResult.request(overrides, providerOverrides), {
    runner: setupResult.runner,
    stdout: setupResult.stdout,
    stderr: setupResult.stderr,
    signals: setupResult.signals,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    screen: (info, request) =>
      createRunScreen(info, request, {
        stdout: setupResult.stdout,
        stderr: setupResult.stderr,
        now: () => new Date('2026-01-01T00:00:00.000Z'),
        footer: false,
        hostedPanel: false,
      }),
  });
}

describe('runAgent', () => {
  it('returns 0 and renders text/init events when the provider finishes cleanly', async () => {
    const lines = eventLines([
      { type: 'init', model: 'sonnet-5', sessionId: 's1' },
      { type: 'text', text: 'hello' },
      { type: 'done', isError: false, text: 'all good' },
    ]);
    const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner);

    const exitCode = await run(s);

    expect(exitCode).toBe(0);
    const output = s.stdout.chunks.join('');
    expect(output.startsWith('[provider] claude\n')).toBe(true);
    expect(output).toContain('· ready (sonnet-5)');
    expect(output).toContain('hello');
    expect(s.stderr.chunks).toEqual([]);
  });

  it('returns 1 when the done event reports an error, even though the process exited 0', async () => {
    const lines = eventLines([{ type: 'done', isError: true, text: 'model refused' }]);
    const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner);

    expect(await run(s)).toBe(1);
  });

  it('returns 1 when the process exits 0 but no done event was ever seen', async () => {
    const s = setup(fakeSpawner({ stdout: streamFromChunks(['{"type":"text","text":"partial"}\n']) }).spawner);

    expect(await run(s)).toBe(1);
  });

  it('returns 1 and says why when the model wrote its tool call as the answer instead of making it', async () => {
    const written = '```json\n{"name": "Read", "arguments": {"file_path": "config.json"}}\n```';
    const lines = eventLines([
      { type: 'init', model: 'qwen2.5-coder:7b', sessionId: 's1' },
      { type: 'text', text: written },
      { type: 'done', isError: false, text: written },
    ]);
    const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner);

    expect(await run(s)).toBe(1);
    expect(s.stderr.chunks.join('')).toContain(
      'O modelo qwen2.5-coder:7b escreveu a chamada da ferramenta Read como texto em vez de chamá-la',
    );
  });

  it('reads the last text when the done event carries none, and lets a prose answer pass', async () => {
    const written = '<tool_call>{"name": "Write", "arguments": {}}</tool_call>';
    const writtenRun = setup(
      fakeSpawner({
        stdout: streamFromChunks([
          eventLines([
            { type: 'text', text: written },
            { type: 'done', isError: false, text: '' },
          ]),
        ]),
      }).spawner,
    );
    const proseRun = setup(
      fakeSpawner({
        stdout: streamFromChunks([
          eventLines([
            { type: 'tool-call', id: 't1', name: 'Read', summary: 'config.json' },
            { type: 'done', isError: false, text: 'Li o config.json e gravei o ticket.' },
          ]),
        ]),
      }).spawner,
    );

    expect(await run(writtenRun)).toBe(1);
    expect(writtenRun.stderr.chunks.join('')).toContain('O modelo escreveu a chamada da ferramenta Write');
    expect(await run(proseRun)).toBe(0);
  });

  it('hands the final answer on when the session ends clean, and nothing when it fails', async () => {
    const answers: string[] = [];
    const deps = (s: Setup) => ({
      runner: s.runner,
      stdout: s.stdout,
      stderr: s.stderr,
      signals: s.signals,
      now: () => new Date(0),
      answered: (answer: string) => answers.push(answer),
      screen: (info: RunFooterInfo, request: RunAgentRequest) =>
        createRunScreen(info, request, {
          stdout: s.stdout,
          stderr: s.stderr,
          now: () => new Date(0),
          footer: false,
          hostedPanel: false,
        }),
    });
    const clean = setup(
      fakeSpawner({ stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'a análise' }])]) })
        .spawner,
    );
    const failed = setup(
      fakeSpawner({
        stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'pela metade' }])]),
        exitCode: 2,
      }).spawner,
    );
    const silent = setup(
      fakeSpawner({ stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: '' }])]) }).spawner,
    );

    expect(await runAgent(clean.request(), deps(clean))).toBe(0);
    expect(await runAgent(failed.request(), deps(failed))).toBe(2);
    expect(await runAgent(silent.request(), deps(silent))).toBe(0);
    expect(answers).toEqual(['a análise']);
  });

  it('propagates a non-zero process exit code even when the last done event looked successful', async () => {
    const lines = eventLines([{ type: 'done', isError: false, text: 'ok' }]);
    const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]), exitCode: 3 }).spawner);

    expect(await run(s)).toBe(3);
  });

  it('reports 128 + signal number when the process was killed by a signal', async () => {
    const spawner: ProcessSpawner = {
      spawn: () => ({
        pid: 1,
        stdout: streamFromChunks([]),
        stderr: streamFromChunks([]),
        exited: Promise.resolve(null as unknown as number),
        signalCode: 'SIGTERM',
        kill: jest.fn(),
      }),
    };
    const s = setup(spawner);

    expect(await run(s)).toBe(128 + constants.signals.SIGTERM);
  });

  it("stops the session and returns 1 when the reported model is not one the agent declares for the run's provider", async () => {
    const lines = eventLines([{ type: 'init', model: 'opus-9', sessionId: 's1' }]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, {
      agent: fakeAgent({ providers: [{ id: 'claude', models: ['sonnet-5'] }] }),
    });

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('"opus-9"');
    expect(s.stderr.chunks.join('')).toContain('sonnet-5');
    expect(s.stdout.chunks.join('')).not.toContain('· ready');
    expect(spawnerHandle.kill).toHaveBeenCalled();
  });

  it('ignores further stream lines after model guard stops the session', async () => {
    const lines = eventLines([
      { type: 'init', model: 'opus-9', sessionId: 's1' },
      { type: 'text', text: 'late line' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, {
      agent: fakeAgent({ providers: [{ id: 'claude', models: ['sonnet-5'] }] }),
    });

    expect(exitCode).toBe(1);
    expect(s.stdout.chunks.join('')).not.toContain('late line');
  });

  it('stops when substantive output arrives without a reported model and the provider has declared models', async () => {
    const lines = eventLines([{ type: 'text', text: 'working without init' }]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, {
      agent: fakeAgent({ providers: [{ id: 'claude', models: ['sonnet-5'] }] }),
    });

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('did not report a model');
    expect(s.stdout.chunks.join('')).not.toContain('working without init');
    expect(spawnerHandle.kill).toHaveBeenCalled();
  });

  it.each(['Agent', 'Task'])('stops the session and returns 1 when the agent calls %s, a subagent', async (tool) => {
    const lines = eventLines([
      { type: 'tool-call', id: 't1', name: tool, summary: 'investigar a falha' },
      { type: 'text', text: 'late line' },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    expect(await run(s)).toBe(1);
    expect(s.stderr.chunks.join('')).toContain(
      `✗ o agente tentou delegar a um subagente (${tool}); a execução foi interrompida: nenhum agente do choliba delega trabalho.\n`,
    );
    expect(s.stdout.chunks.join('')).not.toContain('late line');
    expect(spawnerHandle.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stops the session and returns 1 when the agent calls a tool its provider cannot limit', async () => {
    const lines = eventLines([
      { type: 'tool-call', id: 't1', name: 'Read', summary: '/repo/ok.txt' },
      { type: 'tool-call', id: 't2', name: 'Grep', summary: '/repo' },
      { type: 'text', text: 'late line' },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner, { unenforcedTools: ['Grep', 'Glob'] });

    expect(await run(s)).toBe(1);
    expect(s.stderr.chunks.join('')).toContain(
      '✗ o agente usou Grep, que as permissões deste provider não conseguem limitar; a execução foi interrompida.\n',
    );
    expect(s.stdout.chunks.join('')).not.toContain('late line');
    expect(spawnerHandle.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('stops the session and returns 1 when the agent uses an MCP it does not declare', async () => {
    const lines = eventLines([
      { type: 'tool-call', id: 't1', name: 'GetMcpTools', summary: '', mcp: { kind: 'discovery' } },
      { type: 'text', text: 'late line' },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    expect(await run(s)).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('✗ o agente tentou usar um MCP não declarado (GetMcpTools)');
    expect(s.stdout.chunks.join('')).not.toContain('late line');
    expect(spawnerHandle.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('lets the agent call a tool of an MCP it declares', async () => {
    const lines = eventLines([
      { type: 'tool-call', id: 't1', name: 'Mcp', summary: '', mcp: { kind: 'call', server: 'issues', tool: 'x' } },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    expect(await run(s, undefined, { agent: fakeAgent({ mcps: [{ name: 'issues' }] }) })).toBe(0);
    expect(spawnerHandle.kill).not.toHaveBeenCalled();
  });

  it('lets the agent call any other tool', async () => {
    const lines = eventLines([
      { type: 'tool-call', id: 't1', name: 'Read', summary: '/w/app/a.ts' },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    expect(await run(s)).toBe(0);
    expect(spawnerHandle.kill).not.toHaveBeenCalled();
  });

  it('does not stop the session when the reported model is in agent.yaml#supported_models', async () => {
    const lines = eventLines([
      { type: 'init', model: 'sonnet-5', sessionId: 's1' },
      { type: 'done', isError: false, text: 'ok' },
    ]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, {
      agent: fakeAgent({ providers: [{ id: 'claude', models: ['sonnet-5'] }] }),
    });

    expect(exitCode).toBe(0);
    expect(spawnerHandle.kill).not.toHaveBeenCalled();
  });

  it('returns 1 and writes a message when the process cannot be spawned', async () => {
    const s = setup(throwingSpawner(new Error('spawn ENOENT')));

    const exitCode = await run(s);

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('spawn ENOENT');
  });

  it('returns 1 and never spawns when buildArgs itself throws (e.g. an oversized prompt)', async () => {
    const spawnerHandle = fakeSpawner();
    const s = setup(spawnerHandle.spawner, {
      buildArgs: () => {
        throw new Error('argument too large');
      },
    });

    const exitCode = await run(s);

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('argument too large');
    expect(spawnerHandle.spawnCalls).toEqual([]);
    expect(s.stdout.chunks).toEqual([]);
  });

  it('runs the provider in its run dir, created before and removed after, whatever the outcome', async () => {
    const handle = fakeSpawner({ stdout: streamFromChunks([]) });
    const seen: boolean[] = [];
    const prepareWorkspace = (request: ProviderRequest): (() => void) => {
      seen.push(existsSync(request.runDir));
      return () => undefined;
    };
    const runDir = freshRunDir();

    await run(setup(handle.spawner, { prepareWorkspace }), {}, { runDir });

    expect(seen).toEqual([true]);
    expect(handle.spawnCalls.at(-1)?.cwd).toBe(runDir);
    expect(existsSync(runDir)).toBe(false);

    const failedDir = freshRunDir();
    await run(setup(throwingSpawner(new Error('spawn ENOENT'))), {}, { runDir: failedDir });
    expect(existsSync(failedDir)).toBe(false);
  });

  it('prepares the workspace before the run and restores it after, whatever the outcome', async () => {
    const events: string[] = [];
    const prepareWorkspace = (): (() => void) => {
      events.push('prepare');
      return () => events.push('restore');
    };

    const ok = setup(
      fakeSpawner({ stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'x' }])]) }).spawner,
      {
        prepareWorkspace,
      },
    );
    expect(await run(ok)).toBe(0);
    const failed = setup(throwingSpawner(new Error('spawn ENOENT')), { prepareWorkspace });
    expect(await run(failed)).toBe(1);

    expect(events).toEqual(['prepare', 'restore', 'prepare', 'restore']);
  });

  it('writes the run tools before preparing the workspace and removes them after, whatever the outcome', async () => {
    const runDir = freshRunDir();
    const toolFiles = [{ path: `${runDir}.delete`, content: '#!/usr/bin/env bun\n' }];
    const seen: boolean[] = [];
    const prepareWorkspace = (): (() => void) => {
      seen.push(existsSync(`${runDir}.delete`));
      return () => undefined;
    };

    await run(
      setup(fakeSpawner({ stdout: streamFromChunks([]) }).spawner, { prepareWorkspace }),
      { toolFiles },
      { runDir },
    );
    expect(seen).toEqual([true]);
    expect(existsSync(`${runDir}.delete`)).toBe(false);

    const failing = setup(fakeSpawner().spawner, {
      prepareWorkspace: () => {
        throw new Error('cli.json inválido');
      },
    });
    expect(await run(failing, { toolFiles }, { runDir })).toBe(1);
    expect(existsSync(`${runDir}.delete`)).toBe(false);
  });

  it('returns 1 without spawning when preparing the workspace fails', async () => {
    const spawnerHandle = fakeSpawner();
    const s = setup(spawnerHandle.spawner, {
      prepareWorkspace: () => {
        throw new Error('cli.json inválido');
      },
    });

    expect(await run(s)).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('cli.json inválido');
    expect(spawnerHandle.spawnCalls).toEqual([]);
  });

  it('passes stderr lines straight through, unrendered', async () => {
    const s = setup(fakeSpawner({ stderr: streamFromChunks(['a raw error line\n']) }).spawner);

    await run(s);

    expect(s.stderr.chunks.join('')).toContain('a raw error line');
  });

  it('leaves out the stderr lines the provider says are quiet, and keeps the others', async () => {
    const lines = ['[aviso] modelo desconhecido\n', 'a raw error line\n'];
    const s = setup(fakeSpawner({ stderr: streamFromChunks(lines) }).spawner, {
      quietStderr: (line) => line.startsWith('[aviso]'),
    });

    await run(s);

    expect(s.stderr.chunks.join('')).toContain('a raw error line');
    expect(s.stderr.chunks.join('')).not.toContain('modelo desconhecido');
  });

  it('writes a stderr line as the provider makes it readable', async () => {
    const s = setup(fakeSpawner({ stderr: streamFromChunks(['interno: x\n', 'a raw error line\n']) }).spawner, {
      readableStderr: (line) => (line.startsWith('interno:') ? '✗ ferramenta recusou: x' : line),
    });

    await run(s);

    expect(s.stderr.chunks.join('')).toContain('✗ ferramenta recusou: x\n');
    expect(s.stderr.chunks.join('')).toContain('a raw error line');
    expect(s.stderr.chunks.join('')).not.toContain('interno:');
  });

  it('reports a stream failure and still resolves, instead of hanging', async () => {
    const s = setup(fakeSpawner({ stdout: erroringStream(new Error('boom')) }).spawner);

    const exitCode = await run(s);

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('a sessão de claude falhou');
    expect(s.stderr.chunks.join('')).toContain('boom');
  });

  it('forwards SIGINT and SIGTERM to the underlying process', async () => {
    const spawnerHandle = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner: spawnerHandle.spawner });
    const stdout = fakeWritable();
    const stderr = fakeWritable();
    const { source, trigger } = fakeSignalSource();
    const adapter = fakeAdapter();

    const pending = runAgent(
      {
        provider: { adapter, command: ['fake-bin'], executable: '/bin/fake-bin' },
        providerRequest: {
          agent: fakeAgent(),
          mode: 'execute',
          policy: 'read-only',
          userPrompt: 'do it',
          workspaceRoot: '/repo',
          runDir: freshRunDir(),
          addDirs: [],
          model: undefined,
        },
        commandName: 'echo',
        task: 'do it',
        plansDir: '/plans',
        theme: buildTheme({}, false),
      },
      {
        runner,
        stdout,
        stderr,
        signals: source,
        now: () => new Date(),
        screen: (info, request) =>
          createRunScreen(info, request, {
            stdout,
            stderr,
            now: () => new Date(),
            footer: false,
            hostedPanel: false,
          }),
      },
    );

    trigger('SIGINT');
    trigger('SIGTERM');
    await pending;

    expect(spawnerHandle.kill).toHaveBeenNthCalledWith(1, 'SIGINT');
    expect(spawnerHandle.kill).toHaveBeenNthCalledWith(2, 'SIGTERM');
  });

  describe('plan mode', () => {
    it('saves the done text as the plan and prints where it went', async () => {
      const tmp = makeTmpDir('run-agent-plan');
      try {
        const lines = eventLines([{ type: 'done', isError: false, text: '1. step one\n2. step two' }]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        const exitCode = await run(s, undefined, { mode: 'plan' });

        expect(exitCode).toBe(0);
        const printed = s.stdout.chunks.join('');
        expect(printed).toContain('Plan saved:');
        const path = join(tmp.path, 'echo', '2026-01-01T00-00-00Z-claude.do-it.md');
        expect(printed).toContain(path);
        expect(readPlan(path)).toBe('1. step one\n2. step two');
      } finally {
        tmp.cleanup();
      }
    });

    it('does not save a tool call the model wrote as the plan', async () => {
      const tmp = makeTmpDir('run-agent-plan-written-call');
      try {
        const written = '{"name": "Read", "arguments": {"file_path": "x"}}';
        const lines = eventLines([{ type: 'done', isError: false, text: written }]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        expect(await run(s, undefined, { mode: 'plan' })).toBe(1);
        expect(s.stdout.chunks.join('')).not.toContain('Plan saved:');
      } finally {
        tmp.cleanup();
      }
    });

    it('prefers the plan event over done narration', async () => {
      const tmp = makeTmpDir('run-agent-plan-prefer-plan');
      try {
        const lines = eventLines([
          { type: 'plan', markdown: '## Real plan\n1. step' },
          { type: 'done', isError: false, text: 'Creating the plan...' },
        ]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        await run(s, undefined, { mode: 'plan' });

        expect(readPlan(join(tmp.path, 'echo', '2026-01-01T00-00-00Z-claude.do-it.md'))).toBe('## Real plan\n1. step');
      } finally {
        tmp.cleanup();
      }
    });

    it('falls back to the plan event when done carries no text', async () => {
      const tmp = makeTmpDir('run-agent-plan-fallback');
      try {
        const lines = eventLines([
          { type: 'plan', markdown: '1. from ExitPlanMode' },
          { type: 'done', isError: false, text: '' },
        ]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        await run(s, undefined, { mode: 'plan' });

        expect(readPlan(join(tmp.path, 'echo', '2026-01-01T00-00-00Z-claude.do-it.md'))).toBe('1. from ExitPlanMode');
      } finally {
        tmp.cleanup();
      }
    });

    it('warns and returns 1 when there is nothing to save', async () => {
      const tmp = makeTmpDir('run-agent-plan-empty');
      try {
        const lines = eventLines([{ type: 'done', isError: false, text: '' }]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        const exitCode = await run(s, undefined, { mode: 'plan' });

        expect(exitCode).toBe(1);
        expect(s.stderr.chunks.join('')).toContain('nada para salvar');
      } finally {
        tmp.cleanup();
      }
    });

    it('cursor saves createPlanToolCall markdown and ignores done narration', async () => {
      const tmp = makeTmpDir('run-agent-cursor-plan');
      try {
        const lines = eventLines([
          { type: 'text', text: 'Analyzing...' },
          { type: 'plan', markdown: '## Docs\n- update README' },
          { type: 'done', isError: false, text: 'Creating the plan...' },
        ]);
        const s = setup(
          fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner,
          { id: 'cursor', resolvePlanContent: cursorResolvePlan },
          tmp.path,
        );

        const exitCode = await run(s, undefined, { mode: 'plan' });

        expect(exitCode).toBe(0);
        expect(readPlan(join(tmp.path, 'echo', '2026-01-01T00-00-00Z-cursor.do-it.md'))).toBe(
          '## Docs\n- update README',
        );
      } finally {
        tmp.cleanup();
      }
    });

    it('cursor returns 1 when createPlanToolCall never arrives', async () => {
      const tmp = makeTmpDir('run-agent-cursor-plan-empty');
      try {
        const lines = eventLines([
          { type: 'text', text: 'Analyzing...' },
          { type: 'done', isError: false, text: 'Creating the plan...' },
        ]);
        const s = setup(
          fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner,
          { id: 'cursor', resolvePlanContent: cursorResolvePlan },
          tmp.path,
        );

        const exitCode = await run(s, undefined, { mode: 'plan' });

        expect(exitCode).toBe(1);
        expect(s.stderr.chunks.join('')).toContain('nada para salvar');
      } finally {
        tmp.cleanup();
      }
    });

    it('does not save a plan in execute mode', async () => {
      const tmp = makeTmpDir('run-agent-plan-not-execute');
      try {
        const lines = eventLines([{ type: 'done', isError: false, text: '1. x' }]);
        const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]) }).spawner, {}, tmp.path);

        await run(s, undefined, { mode: 'execute' });

        expect(s.stdout.chunks.join('')).not.toContain('Plan saved');
      } finally {
        tmp.cleanup();
      }
    });
  });
});

describe('runAgent — launch', () => {
  it('starts what the launch says, with its environment, and names the paths left to the image first', async () => {
    const handle = fakeSpawner({
      stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
    });
    const s = setup(handle.spawner);

    const exitCode = await run(s, {
      launch: (command) => ({
        command: ['docker', 'run', 'img', ...command],
        env: { TOKEN: 't' },
        place: { kind: 'docker', image: 'img', container: 'choliba-1' },
        paths: [],
        skipped: ['/etc/passwd', '/usr'],
      }),
    });

    expect(exitCode).toBe(0);
    expect(handle.spawnCalls[0]?.command.slice(0, 4)).toEqual(['docker', 'run', 'img', 'fake-bin']);
    expect(handle.spawnCalls[0]?.env).toEqual({ TOKEN: 't' });
    expect(s.stderr.chunks.join('')).toContain(
      'No container, estes caminhos são da imagem e não vêm desta máquina: /etc/passwd, /usr.',
    );
  });

  it('names the paths the local sandbox leaves to the system', async () => {
    const handle = fakeSpawner({
      stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
    });
    const s = setup(handle.spawner);

    const exitCode = await run(s, {
      launch: (command) => ({
        command,
        place: { kind: 'local' },
        paths: [],
        skipped: ['/etc/passwd'],
      }),
    });

    expect(exitCode).toBe(0);
    expect(s.stderr.chunks.join('')).toContain(
      'No sandbox local, estes caminhos são do sistema e não são montados à parte: /etc/passwd.',
    );
  });
});

describe('runAgent — footer', () => {
  /** A run with the footer on, a clock that moves 1 s each time it is read, and the timer under the spec's control. */
  async function withFooter(
    lines: string,
    launch?: RunAgentRequest['launch'],
    stderr: readonly string[] = [],
    fakeTimer = true,
    model?: string,
  ): Promise<{ code: number; out: string; err: string; intervals: number[]; stopped: number }> {
    const s = setup(fakeSpawner({ stdout: streamFromChunks([lines]), stderr: streamFromChunks([...stderr]) }).spawner);
    let seconds = 0;
    const intervals: number[] = [];
    let stopped = 0;
    const code = await runAgent(
      s.request(launch === undefined ? {} : { launch }, model === undefined ? {} : { model }),
      {
        runner: s.runner,
        stdout: s.stdout,
        stderr: s.stderr,
        signals: s.signals,
        now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds++)),
        screen: (info, request) =>
          createRunScreen(info, request, {
            stdout: s.stdout,
            stderr: s.stderr,
            now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds++)),
            footer: true,
            hostedPanel: false,
            ...(fakeTimer
              ? {
                  every: (ms: number, tick: () => void) => {
                    intervals.push(ms);
                    tick();
                    return () => {
                      stopped += 1;
                    };
                  },
                }
              : {}),
          }),
        ...(fakeTimer
          ? {
              every: (ms: number, tick: () => void) => {
                intervals.push(ms);
                tick();
                return () => {
                  stopped += 1;
                };
              },
            }
          : {}),
      },
    );
    return { code, out: s.stdout.chunks.join(''), err: s.stderr.chunks.join(''), intervals, stopped };
  }

  it('frames the session under the command and keeps the table at the bottom, without repeating them', async () => {
    const run = await withFooter(
      eventLines([
        { type: 'init', model: 'sonnet-5', sessionId: 's1' },
        { type: 'text', text: 'olá' },
        { type: 'done', isError: false, text: 'ok' },
      ]),
      (command) => ({
        command,
        place: { kind: 'docker', image: 'choliba-agent', container: 'choliba-1' },
        paths: [],
        skipped: [],
      }),
    );

    expect(run.code).toBe(0);
    expect(run.out.startsWith('\n┌─ echo ─')).toBe(true);
    expect(run.out).toMatch(/│ olá +│\n/);
    expect(run.out).toMatch(/provider │ modelo +│ sandbox │ imagem +│ container │ decorrido\n/);
    expect(run.out).toMatch(/claude +│ sonnet-5 │ docker +│ choliba-agent │ choliba-1 +│ 00:00:0\d\.000\n/);
    expect(run.out).not.toContain('[provider]');
    expect(run.out).not.toContain('[echo]');
    expect(run.out).not.toContain('ready');
    expect(run.out).toMatch(/└─+┘\nclaude · sonnet-5 · docker · decorrido 00:00:0\d\.000 · código 0\n$/);
    expect(run.intervals).toEqual([FOOTER_REFRESH_MS]);
    expect(run.stopped).toBe(1);
  });

  it('frames what the session says on stderr too, and still closes with the exit code when it fails', async () => {
    // The real timer (no fake one): it is stopped when the session closes.
    const run = await withFooter(
      eventLines([{ type: 'done', isError: true, text: 'falhou' }]),
      undefined,
      ['\n', 'aviso do provider\n', '\n'],
      false,
    );

    expect(run.code).toBe(1);
    expect(run.err).toMatch(/^│ aviso do provider +│\n$/);
    expect(run.out).toMatch(/claude · — · local · decorrido 00:00:0\d\.000 · código 1\n$/);
  });

  it('shows the model asked of the provider when its stream never says which it runs', async () => {
    const run = await withFooter(
      eventLines([{ type: 'done', isError: false, text: 'ok' }]),
      undefined,
      [],
      false,
      'gpt-6.1-sol',
    );

    expect(run.code).toBe(0);
    expect(run.out).toMatch(/claude · gpt-6\.1-sol · local · decorrido 00:00:0\d\.000 · código 0\n$/);
  });
});

describe('runAgent — panel', () => {
  /** A panel that records what the run did with it, and calls the interrupt listener as soon as it is set when asked. */
  function fakePanel(interruptAtOnce = false, reply: PanelReply = { status: 'skipped' }, message?: string) {
    const written: string[] = [];
    const record = { written, refreshes: 0, closed: 0, options: [] as PanelOptions[], asked: [] as string[] };
    const open = (options: PanelOptions): Promise<Panel> => {
      record.options.push(options);
      return Promise.resolve({
        write: (text) => {
          written.push(text);
        },
        refresh: () => {
          record.refreshes += 1;
        },
        onInterrupt: (listener) => {
          if (interruptAtOnce) listener();
        },
        ask: (question) => {
          record.asked.push(question.question);
          return Promise.resolve(reply);
        },
        onMessage: (listener) => {
          if (message !== undefined) listener(message);
        },
        close: () => {
          record.closed += 1;
        },
      });
    };
    return { open, record };
  }

  /** The run's dependencies with `panel`; the spec's own timer, unless `realTimer` keeps `everySecond`'s. */
  function deps(s: Setup, panel: RunScreenDeps['panel'], realTimer = false): RunAgentDeps {
    const timer = {
      every: (_ms: number, tick: () => void) => {
        tick();
        return () => undefined;
      },
    };
    return {
      runner: s.runner,
      stdout: s.stdout,
      stderr: s.stderr,
      signals: s.signals,
      now: () => new Date(Date.UTC(2026, 0, 1)),
      ...(realTimer ? {} : timer),
      screen: (info, request, hostedPanel) =>
        createRunScreen(info, request, {
          stdout: s.stdout,
          stderr: s.stderr,
          now: () => new Date(Date.UTC(2026, 0, 1)),
          footer: true,
          hostedPanel,
          ...(realTimer ? {} : timer),
          ...(panel === undefined ? {} : { panel }),
        }),
    };
  }

  it('draws the session in the panel, and prints the whole frame and the summary once it closes', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([
          eventLines([
            { type: 'init', model: 'sonnet-5', sessionId: 's1' },
            { type: 'text', text: 'olá' },
            { type: 'done', isError: false, text: 'ok' },
          ]),
        ]),
      }).spawner,
    );
    const { open, record } = fakePanel();

    expect(await runAgent(s.request(), deps(s, open))).toBe(0);

    expect(record.written.join('')).toContain('olá');
    expect(record.refreshes).toBe(1);
    expect(record.closed).toBe(1);
    expect(record.options[0]?.title).toBe('echo');
    expect(record.options[0]?.footer(80).some((line) => line.startsWith('└'))).toBe(false);
    // The footer shows the model the provider reported, as the frame and footer do.
    expect(record.options[0]?.footer(80).join('\n')).toContain('sonnet-5');
    const out = s.stdout.chunks.join('');
    expect(out).toMatch(
      /^\n┌─ echo ─+┐\n│ olá +│\n└─+┘\nclaude · sonnet-5 · local · decorrido 00:00:00\.000 · código 0\n$/,
    );
  });

  it("leaves the lines in a host's panel, printing no frame on the terminal, when the panel is lent", async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([
          eventLines([
            { type: 'text', text: 'olá' },
            { type: 'done', isError: false, text: 'ok' },
          ]),
        ]),
      }).spawner,
    );
    const { open, record } = fakePanel();

    expect(await runAgent(s.request(), { ...deps(s, open), hostedPanel: true })).toBe(0);

    expect(record.written.join('')).toContain('olá');
    expect(record.closed).toBe(1);
    expect(s.stdout.chunks.join('')).toBe('');
  });

  it('asks the panel the questions of the ask run tool, and keeps question and answer in the frame', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
      }).spawner,
    );
    const request = s.request(
      {},
      { agent: fakeAgent({ permissions: readAgentPermissions({ allow: { tools: { ask: ['*'] } } }) }) },
    );
    const exchange = join(request.providerRequest.runDir, '.choliba-ask');
    mkdirSync(exchange, { recursive: true });
    writeFileSync(
      join(exchange, '1.question.json'),
      JSON.stringify({ id: '1', question: 'Nome?', options: [], multi: false }),
    );
    const { open, record } = fakePanel(false, { status: 'answered', answer: ['Ana', 'Bia'] });

    expect(await runAgent(request, deps(s, open))).toBe(0);

    expect(record.asked).toEqual(['Nome?']);
    expect(record.written.join('')).toContain('? Nome?\n→ Ana, Bia\n');
  });

  it('keeps in the frame what the person sends, and a question they skip, with the real timer', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
      }).spawner,
    );
    const request = s.request(
      {},
      { agent: fakeAgent({ permissions: readAgentPermissions({ allow: { tools: { ask: ['*'] } } }) }) },
    );
    const { open, record } = fakePanel(false, { status: 'skipped' }, 'use React');

    expect(await runAgent(request, deps(s, open, true))).toBe(0);
    expect(record.written.join('')).toContain(
      '› use React (não entregue: este provider não recebe mensagens durante a execução)\n',
    );

    const skipping = fakePanel(false, { status: 'skipped' });
    const panel = await skipping.open({ title: 'x', titleColor: 'cyan', footer: () => [], hint: '' });
    expect(await panel.ask({ question: 'Nome?', options: [], multi: false })).toEqual({ status: 'skipped' });
  });

  it('sends the task, then what the person sends, on stdin, and closes it when the last turn ends', async () => {
    const handle = fakeSpawner({
      stdout: streamFromChunks([
        eventLines([
          { type: 'done', isError: false, text: 'um' },
          { type: 'done', isError: false, text: 'dois' },
        ]),
      ]),
    });
    const s = setup(handle.spawner, { inputMessage: (text) => `>${text}\n` });
    const { open, record } = fakePanel(false, { status: 'skipped' }, 'use React');

    expect(await runAgent(s.request(), deps(s, open))).toBe(0);

    expect(handle.spawnCalls[0]).toMatchObject({ input: true });
    expect(handle.stdin.written).toEqual(['>do it\n', '>use React\n']);
    expect(handle.stdin.ended).toBe(true);
    expect(record.written.join('')).toContain('› use React\n');
    expect(record.options[0]?.hint).toBe('Enter envia · Ctrl+J cria uma linha');
  });

  it("in a host's panel, which already shows what was said, writes only that a message did not reach the agent", async () => {
    const delivered = setup(
      fakeSpawner({ stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]) }).spawner,
      { inputMessage: (text) => `>${text}\n` },
    );
    const sent = fakePanel(false, { status: 'skipped' }, 'use React');
    expect(await runAgent(delivered.request(), { ...deps(delivered, sent.open), hostedPanel: true })).toBe(0);
    expect(sent.record.written.join('')).not.toContain('use React');

    const refusing = setup(
      fakeSpawner({ stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]) }).spawner,
    );
    const refused = fakePanel(false, { status: 'skipped' }, 'use React');
    expect(await runAgent(refusing.request(), { ...deps(refusing, refused.open), hostedPanel: true })).toBe(0);
    expect(refused.record.written.join('')).toContain(
      '(não entregue: este provider não recebe mensagens durante a execução)\n',
    );
    expect(refused.record.written.join('')).not.toContain('› use React');
  });

  it('closes stdin when a guard stops the session', async () => {
    const handle = fakeSpawner({
      stdout: streamFromChunks([eventLines([{ type: 'tool-call', id: 't', name: 'Agent', summary: '' }])]),
    });
    const s = setup(handle.spawner, { inputMessage: (text) => `>${text}\n` });

    await run(s);

    expect(handle.stdin.ended).toBe(true);
  });

  it('writes a skipped question as having no answer', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
      }).spawner,
    );
    const request = s.request(
      {},
      { agent: fakeAgent({ permissions: readAgentPermissions({ allow: { tools: { ask: ['*'] } } }) }) },
    );
    const exchange = join(request.providerRequest.runDir, '.choliba-ask');
    mkdirSync(exchange, { recursive: true });
    writeFileSync(
      join(exchange, '1.question.json'),
      JSON.stringify({ id: '1', question: 'Nome?', options: [], multi: false }),
    );
    const { open, record } = fakePanel();

    await runAgent(request, deps(s, open));

    expect(record.written.join('')).toContain('? Nome?\n→ (sem resposta)\n');
  });

  it('answers that nobody can when the screen has no field', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([eventLines([{ type: 'done', isError: false, text: 'ok' }])]),
      }).spawner,
    );
    const request = s.request(
      {},
      { agent: fakeAgent({ permissions: readAgentPermissions({ allow: { tools: { ask: ['*'] } } }) }) },
    );
    const exchange = join(request.providerRequest.runDir, '.choliba-ask');
    mkdirSync(exchange, { recursive: true });
    writeFileSync(
      join(exchange, '1.question.json'),
      JSON.stringify({ id: '1', question: 'Nome?', options: [], multi: false }),
    );
    let answered = '';
    const every = (_ms: number, tick: () => void): (() => void) => {
      tick();
      // Stopped when the session ends, before the run folder goes: the answer is there by then.
      return () => {
        answered = readFileSync(join(exchange, '1.answer.json'), 'utf8');
      };
    };

    await runAgent(request, {
      ...deps(s, undefined),
      every,
      screen: (info, req) =>
        createRunScreen(info, req, {
          stdout: s.stdout,
          stderr: s.stderr,
          now: () => new Date(Date.UTC(2026, 0, 1)),
          footer: false,
          hostedPanel: false,
          every,
        }),
    });

    expect(JSON.parse(answered)).toEqual({ status: 'unavailable' });
  });

  it('keeps the frame and footer when the panel does not open', async () => {
    const s = setup(
      fakeSpawner({
        stdout: streamFromChunks([
          eventLines([
            { type: 'text', text: 'olá' },
            { type: 'done', isError: false, text: 'ok' },
          ]),
        ]),
      }).spawner,
    );

    expect(
      await runAgent(
        s.request(),
        deps(s, () => Promise.resolve(undefined)),
      ),
    ).toBe(0);
    expect(s.stdout.chunks.join('')).toMatch(/^\n┌─ echo ─/);
  });

  it('passes Ctrl+C in the panel on to the provider as SIGINT', async () => {
    const spawnerHandle = fakeSpawner();
    const s = setup(spawnerHandle.spawner);
    await runAgent(s.request(), deps(s, fakePanel(true).open, true));

    expect(spawnerHandle.kill).toHaveBeenCalledWith('SIGINT');
  });
});

describe('screenWidth', () => {
  it("takes the terminal's width, and the default one when it says none or 0", () => {
    const write = (): void => undefined;
    expect(screenWidth({ write, columns: 120 })).toBe(120);
    expect(screenWidth({ write, columns: 0 })).toBe(80);
    expect(screenWidth({ write })).toBe(80);
  });
});

describe('everySecond', () => {
  it('calls the tick on its interval until stopped', () => {
    jest.useFakeTimers();
    try {
      const tick = jest.fn();
      const stop = everySecond(1000, tick);
      jest.advanceTimersByTime(2500);
      stop();
      jest.advanceTimersByTime(2000);
      expect(tick).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
