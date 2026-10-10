import { existsSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildTheme, ProcessRunnerService, type ProcessSpawner, type SignalSource, type Writable } from '@choliba/core';

import type { AgentDefinition } from '../../../common/interfaces/agent.interface';
import type { AgentEvent } from '../../../common/interfaces/event.interface';
import { readPlan } from '../../../agents/runs/plan-store';
import type { AgentProvider } from '../../../common/agent-provider';
import type { PlanContentContext, ProviderRequest } from '../../../common/interfaces/provider.interface';
import type { ResolvedProvider } from '../../../common/provider-registry';
import type { RunAgentRequest } from '../../../agents/runs/run-agent';
import { runAgent } from '../../../agents/runs/run-agent';
import { erroringStream, fakeSpawner, streamFromChunks, throwingSpawner } from '../../helpers/fake-spawner';
import { makeTmpDir } from '../../helpers/tmp';
import { NO_PERMISSIONS } from '../../../common/agent-permissions';
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
    supportedModels: [],
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
    unenforcedTools: [],
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
      provider: { adapter, command: ['fake-bin'] } satisfies ResolvedProvider,
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

  it('stops the session and returns 1 when the reported model is not in agent.yaml#supported_models', async () => {
    const lines = eventLines([{ type: 'init', model: 'opus-9', sessionId: 's1' }]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, { agent: fakeAgent({ supportedModels: ['sonnet-5'] }) });

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

    const exitCode = await run(s, undefined, { agent: fakeAgent({ supportedModels: ['sonnet-5'] }) });

    expect(exitCode).toBe(1);
    expect(s.stdout.chunks.join('')).not.toContain('late line');
  });

  it('stops when substantive output arrives without a reported model and supported_models is non-empty', async () => {
    const lines = eventLines([{ type: 'text', text: 'working without init' }]);
    const spawnerHandle = fakeSpawner({ stdout: streamFromChunks([lines]) });
    const s = setup(spawnerHandle.spawner);

    const exitCode = await run(s, undefined, { agent: fakeAgent({ supportedModels: ['sonnet-5'] }) });

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

    const exitCode = await run(s, undefined, { agent: fakeAgent({ supportedModels: ['sonnet-5'] }) });

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

  it('reports a stream failure and still resolves, instead of hanging', async () => {
    const s = setup(fakeSpawner({ stdout: erroringStream(new Error('boom')) }).spawner);

    const exitCode = await run(s);

    expect(exitCode).toBe(1);
    expect(s.stderr.chunks.join('')).toContain('session failed');
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
        provider: { adapter, command: ['fake-bin'] },
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
      { runner, stdout, stderr, signals: source, now: () => new Date() },
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
        expect(s.stderr.chunks.join('')).toContain('Nothing to save');
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
        expect(s.stderr.chunks.join('')).toContain('Nothing to save');
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
        mounts: [],
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
});
