import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentDefinition, ProviderRequest } from '../../..';
import { MAX_ARG_BYTES, modeInstruction } from '../../..';
import { NO_PERMISSIONS } from '../../../common/agent-permissions';
import { prepareCodexAuthentication, runCodexHome, userCodexHome } from '../../../providers/codex/codex-auth';
import { CodexConfigError, codexMcpArgs } from '../../../providers/codex/codex-config';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';
import { codexProvider } from '../../helpers/providers';
import { makeTmpDir } from '../../helpers/tmp';

const STREAM = join(__dirname, '..', '..', 'fixtures', 'streams', 'codex.jsonl');

function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'echo',
    id: 'example-echo-agent',
    displayName: 'Echo Agent',
    version: '1.0.0',
    description: 'repeats things',
    providers: [{ id: 'codex', models: ['gpt-6.1-sol'] }],
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

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    agent: fakeAgent(),
    mode: 'execute',
    policy: 'read-only',
    userPrompt: 'do the task',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/x',
    addDirs: [],
    model: undefined,
    ...overrides,
  };
}

describe('CodexAgentProvider', () => {
  it('runs an ephemeral JSON exec with developer instructions and reads the task from stdin', () => {
    const args = codexProvider.buildArgs(request());

    expect(args.slice(0, 7)).toEqual([
      '--dangerously-bypass-approvals-and-sandbox',
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-C',
      '/repo',
    ]);
    expect(args).toEqual(expect.arrayContaining(['-c', expect.stringContaining('be an echo')]));
    expect(args.at(-1)).toBe('-');
    expect(codexProvider.inputMessage('do the task')).toBe('do the task\n');
    expect(codexProvider.oneShotInput).toBe(true);
  });

  it.each(['ask', 'plan', 'execute'] as const)('keeps %s mode in the prompt contract', (mode) => {
    const notice = modeInstruction(mode);
    const userPrompt = [notice, 'do the task'].filter((part) => part !== '').join('\n\n');
    const input = codexProvider.inputMessage(userPrompt);

    expect(input).toContain('do the task');
    if (notice !== '') expect(input).toContain(notice);
  });

  it('passes model and each additional directory only when present', () => {
    const args = codexProvider.buildArgs(request({ model: 'gpt-6.1-sol', addDirs: ['/a', '/b'] }));

    expect(args).toEqual(expect.arrayContaining(['--model', 'gpt-6.1-sol']));
    expect(args.filter((arg) => arg === '--add-dir')).toHaveLength(2);
    expect(codexProvider.buildArgs(request())).not.toContain('--model');
  });

  it('names a model, checks the commands itself and reads only the task, with no credential in the environment', () => {
    expect(codexProvider).toMatchObject({
      needsModel: true,
      enforcesExecute: false,
      oneShotInput: true,
      credentials: [],
      inAuto: true,
    });
  });

  it('points Codex at the isolated home of this run', () => {
    expect(codexProvider.variables({ request: request(), config: {}, reachable: String })).toEqual({
      CODEX_HOME: '/repo/.cache/runs/x/.codex',
    });
  });

  it('keeps a prompt larger than the per-argument limit out of argv', () => {
    const prompt = 'x'.repeat(MAX_ARG_BYTES + 1);
    const args = codexProvider.buildArgs(request({ userPrompt: prompt }));

    expect(args).not.toContain(prompt);
    expect(codexProvider.inputMessage(prompt)).toBe(`${prompt}\n`);
  });

  it('hides Codex stdin progress and keeps other diagnostics', () => {
    expect(codexProvider.quietStderr('Reading additional input from stdin...')).toBe(true);
    expect(codexProvider.quietStderr('network error')).toBe(false);
  });
});

describe('Codex authentication', () => {
  it('resolves CODEX_HOME before the conventional home folder', () => {
    expect(userCodexHome({ CODEX_HOME: '/custom' }, '/home/person')).toBe('/custom');
    expect(userCodexHome({}, '/home/person')).toBe('/home/person/.codex');
  });

  it('copies only auth.json into the isolated run home with private permissions', () => {
    const tmp = makeTmpDir('codex-auth');
    try {
      const source = join(tmp.path, 'source');
      const run = join(tmp.path, 'run');
      mkdirSync(source);
      mkdirSync(run);
      writeFileSync(join(source, 'auth.json'), '{"token":"secret"}');
      writeFileSync(join(source, 'config.toml'), 'model = "private"');

      prepareCodexAuthentication(run, source);

      const home = runCodexHome(run);
      expect(readFileSync(join(home, 'auth.json'), 'utf8')).toBe('{"token":"secret"}');
      expect(existsSync(join(home, 'config.toml'))).toBe(false);
      expect(statSync(join(home, 'auth.json')).mode & 0o777).toBe(0o600);
    } finally {
      tmp.cleanup();
    }
  });

  it("reads the user's login from CODEX_HOME when the workspace is prepared, leaving the copy to the run dir", () => {
    const tmp = makeTmpDir('codex-prepare');
    const previous = process.env['CODEX_HOME'];
    try {
      const source = join(tmp.path, 'source');
      const run = join(tmp.path, 'run');
      mkdirSync(source);
      mkdirSync(run);
      writeFileSync(join(source, 'auth.json'), '{}');
      process.env['CODEX_HOME'] = source;

      expect(userCodexHome()).toBe(source);
      const undo = codexProvider.prepareWorkspace(request({ runDir: run }));
      undo();
      expect(existsSync(join(runCodexHome(run), 'auth.json'))).toBe(true);
    } finally {
      if (previous === undefined) delete process.env['CODEX_HOME'];
      else process.env['CODEX_HOME'] = previous;
      tmp.cleanup();
    }
  });

  it('fails with the login command when auth.json is absent', () => {
    expect(() => prepareCodexAuthentication('/run', '/missing')).toThrow('codex login');
  });
});

describe('Codex MCP configuration', () => {
  it('turns declared stdio, URL and tool restrictions into isolated config overrides', () => {
    const args = codexMcpArgs([
      {
        name: 'browser',
        config: { command: 'npx', args: ['browser-mcp'], env: { TOKEN: 'secret' } },
        tools: ['open'],
        path: '/repo/.choliba/mcps/browser.json',
      },
      { name: 'docs', config: { url: 'https://example.com/mcp' }, path: '/repo/.choliba/mcps/docs.json' },
    ]);

    expect(args).toEqual(
      expect.arrayContaining([
        '-c',
        '"mcp_servers"."browser"."command"="npx"',
        '-c',
        '"mcp_servers"."browser"."args"=["browser-mcp"]',
        '-c',
        '"mcp_servers"."browser"."env"."TOKEN"="secret"',
        '-c',
        '"mcp_servers"."browser"."enabled_tools"=["open"]',
        '-c',
        '"mcp_servers"."docs"."url"="https://example.com/mcp"',
      ]),
    );
  });

  it('writes booleans and numbers as TOML scalars', () => {
    expect(
      codexMcpArgs([{ name: 'n', config: { enabled: false, timeout: 30 }, path: '/repo/.choliba/mcps/n.json' }]),
    ).toEqual(['-c', '"mcp_servers"."n"."enabled"=false', '-c', '"mcp_servers"."n"."timeout"=30']);
  });

  it('rejects values that TOML overrides cannot represent', () => {
    expect(() =>
      codexMcpArgs([{ name: 'bad', config: { nested: null }, path: '/repo/.choliba/mcps/bad.json' }]),
    ).toThrow(CodexConfigError);
    expect(() =>
      codexMcpArgs([{ name: 'bad', config: { timeout: Infinity }, path: '/repo/.choliba/mcps/bad.json' }]),
    ).toThrow(CodexConfigError);
  });
});

describe('Codex JSONL parser', () => {
  it('normalizes a representative stream and keeps call details on results', () => {
    const parser = codexProvider.createParser();
    const events = readFileSync(STREAM, 'utf8')
      .trim()
      .split('\n')
      .flatMap((line) => parser.parseLine(line));

    expect(events).toContainEqual({ type: 'init', model: undefined, sessionId: 'thread-1' });
    expect(events).toContainEqual({ type: 'text', text: 'Vou ler o arquivo.' });
    expect(events).toContainEqual({
      type: 'tool-call',
      id: 'command-1',
      name: 'Bash',
      summary: "sed -n '1,20p' README.md",
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool-result',
        id: 'command-1',
        isError: false,
        target: "sed -n '1,20p' README.md",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool-result', id: 'command-2', isError: true, denied: true }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool-call', id: 'edit-1', name: 'Edit', summary: 'README.md' }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool-call',
        id: 'mcp-1',
        mcp: { kind: 'call', server: 'browser', tool: 'open' },
      }),
    );
    expect(events.at(-1)).toEqual({ type: 'done', isError: false, text: '' });
  });

  it('ignores malformed and unknown lines and reports a failed turn', () => {
    const parser = codexProvider.createParser();

    expect(parser.parseLine('not json')).toEqual([]);
    expect(parser.parseLine('{"type":"unknown"}')).toEqual([]);
    expect(parser.parseLine('{"type":"turn.failed","error":{"message":"boom"}}')).toEqual([
      { type: 'done', isError: true, text: 'boom' },
    ]);
  });

  it('reads items with missing fields as calls and results without them', () => {
    const parser = codexProvider.createParser();
    const line = (doc: unknown): string => JSON.stringify(doc);

    expect(parser.parseLine(line({ type: 'item.started' }))).toEqual([]);
    expect(parser.parseLine(line({ type: 'item.completed', item: 'x' }))).toEqual([]);
    expect(parser.parseLine(line({ type: 'item.started', item: { type: 'reasoning' } }))).toEqual([]);
    expect(parser.parseLine(line({ type: 'item.completed', item: { type: 'reasoning' } }))).toEqual([]);
    expect(parser.parseLine(line({ type: 'item.completed', item: { type: 'agent_message' } }))).toEqual([]);
    expect(parser.parseLine(line({ type: 'item.started', item: { type: 'command_execution' } }))).toEqual([
      { type: 'tool-call', id: '?', name: 'Bash', summary: '' },
    ]);
    expect(
      parser.parseLine(line({ type: 'item.started', item: { id: 'f', type: 'file_change', changes: 'x' } })),
    ).toEqual([{ type: 'tool-call', id: 'f', name: 'Edit', summary: '' }]);
    expect(
      parser.parseLine(
        line({ type: 'item.started', item: { id: 'g', type: 'file_change', changes: [1, {}, { path: 'a' }] } }),
      ),
    ).toEqual([{ type: 'tool-call', id: 'g', name: 'Edit', summary: 'a' }]);
    expect(parser.parseLine(line({ type: 'item.started', item: { id: 'm', type: 'mcp_tool_call' } }))).toEqual([
      { type: 'tool-call', id: 'm', name: 'MCP', summary: '' },
    ]);
    expect(
      parser.parseLine(line({ type: 'item.completed', item: { id: 'm', type: 'mcp_tool_call', status: 'completed' } })),
    ).toEqual([{ type: 'tool-result', id: 'm', name: 'MCP', isError: false, denied: false, text: '' }]);
    expect(
      parser.parseLine(
        line({
          type: 'item.completed',
          item: { id: 'n', type: 'mcp_tool_call', server: 's', tool: 't', result: 'ok' },
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        id: 'n',
        name: 'mcp__s__t',
        text: 'ok',
        mcp: { kind: 'call', server: 's', tool: 't' },
      }),
    ]);
    expect(parser.parseLine(line({ type: 'turn.failed' }))).toEqual([{ type: 'done', isError: true, text: '' }]);
    expect(parser.parseLine(line({ type: 'turn.failed', error: {} }))).toEqual([
      { type: 'done', isError: true, text: '' },
    ]);
  });
});
