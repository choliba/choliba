import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentDefinition } from '../../../agents/interfaces/agent.interface';
import type { AgentEvent } from '../../../runs/interfaces/event.interface';
import type { ProviderRequest } from '../../../providers/interfaces/provider.interface';
import { cursorProvider } from '../../helpers/providers';
import { PromptTooLargeError, MAX_ARG_BYTES } from '../../../runs/prompt';
import { makeTmpDir } from '../../helpers/tmp';
import { NO_PERMISSIONS, readAgentPermissions } from '../../../runs/permissions';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';

const CURSOR_PLAN_FIXTURE = join(__dirname, '..', '..', 'fixtures', 'streams', 'cursor-create-plan-tool-call.jsonl');

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

function fakeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
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

describe('cursorProvider.buildArgs', () => {
  it('puts -p and the prompt first, with the instructions inlined ahead of the task', () => {
    const args = cursorProvider.buildArgs(fakeRequest());

    expect(args[0]).toBe('-p');
    expect(args[1]).toContain('be an echo');
    expect(args[1]).toContain('do the task');
    expect(String(args[1]).indexOf('be an echo')).toBeLessThan(String(args[1]).indexOf('do the task'));
  });

  it("opens the inlined instructions with the order to use the agent's skills", () => {
    const prompt = String(cursorProvider.buildArgs(fakeRequest({ skillsInstruction: 'Utilize a skill docs.' }))[1]);

    expect(prompt.indexOf('Utilize a skill docs.')).toBeLessThan(prompt.indexOf('be an echo'));
  });

  it('always sends --trust, stream-json output and the workspace', () => {
    const args = cursorProvider.buildArgs(fakeRequest({ runDir: '/repo/root/.cache/runs/x' }));

    expect(args).toEqual(
      expect.arrayContaining(['--trust', '--output-format', 'stream-json', '--workspace', '/repo/root/.cache/runs/x']),
    );
  });

  it('maps ask mode to --mode ask', () => {
    expect(cursorProvider.buildArgs(fakeRequest({ mode: 'ask', policy: 'read-only' }))).toEqual(
      expect.arrayContaining(['--mode', 'ask']),
    );
  });

  it('maps plan mode to --mode plan', () => {
    expect(cursorProvider.buildArgs(fakeRequest({ mode: 'plan', policy: 'read-only' }))).toEqual(
      expect.arrayContaining(['--mode', 'plan']),
    );
  });

  it('maps execute + read-only to --mode ask, the closest fit cursor has', () => {
    expect(cursorProvider.buildArgs(fakeRequest({ mode: 'execute', policy: 'read-only' }))).toEqual(
      expect.arrayContaining(['--mode', 'ask']),
    );
  });

  it('adds no extra flag for execute + edits', () => {
    const args = cursorProvider.buildArgs(fakeRequest({ mode: 'execute', policy: 'edits' }));

    expect(args.includes('--mode')).toBe(false);
    expect(args.includes('--force')).toBe(false);
  });

  it('approves MCP servers only when the agent lists some, and never twice', () => {
    expect(cursorProvider.buildArgs(fakeRequest({ policy: 'edits' })).includes('--approve-mcps')).toBe(false);
    const listed = cursorProvider.buildArgs(
      fakeRequest({
        policy: 'edits',
        mcpServers: [
          {
            name: 'browser',
            config: { command: 'npx', args: ['browser-mcp'] },
            path: '/repo/.choliba/mcps/browser.json',
          },
        ],
      }),
    );
    expect(listed).toContain('--approve-mcps');
    expect(listed.filter((arg) => arg === '--approve-mcps')).toHaveLength(1);
  });

  it('adds --model only when one is given', () => {
    expect(cursorProvider.buildArgs(fakeRequest()).includes('--model')).toBe(false);
    expect(cursorProvider.buildArgs(fakeRequest({ model: 'gpt-5' }))).toEqual(
      expect.arrayContaining(['--model', 'gpt-5']),
    );
  });

  it('repeats --add-dir once per directory', () => {
    const args = cursorProvider.buildArgs(fakeRequest({ addDirs: ['/a', '/b'] }));

    expect(args.filter((a) => a === '--add-dir')).toHaveLength(2);
    expect(args).toEqual(expect.arrayContaining(['--add-dir', '/a', '--add-dir', '/b']));
  });

  it('throws PromptTooLargeError instead of returning an oversized argument', () => {
    expect(() => {
      cursorProvider.buildArgs(fakeRequest({ userPrompt: 'x'.repeat(MAX_ARG_BYTES + 1) }));
    }).toThrow(PromptTooLargeError);
  });
});

describe('cursorProvider.createParser', () => {
  const line = (obj: unknown): string => JSON.stringify(obj);

  it('returns nothing for a blank or malformed line', () => {
    const parser = cursorProvider.createParser();
    expect(parser.parseLine('')).toEqual([]);
    expect(parser.parseLine('not json')).toEqual([]);
  });

  it('parses a flat init event (no nested subtype, unlike claude)', () => {
    const events = cursorProvider.createParser().parseLine(line({ type: 'init', model: 'gpt-5', session_id: 'xyz' }));

    expect(events).toEqual([{ type: 'init', model: 'gpt-5', sessionId: 'xyz' }]);
  });

  it('parses assistant text and tool_use blocks the same way as claude', () => {
    const events = cursorProvider.createParser().parseLine(
      line({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.ts' } },
          ],
        },
      }),
    );

    expect(events).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'tool-call', id: 't1', name: 'Read', summary: 'a.ts' },
    ]);
  });

  it('ignores an assistant thinking block', () => {
    const events = cursorProvider
      .createParser()
      .parseLine(line({ type: 'assistant', message: { content: [{ type: 'thinking', text: 'hmm' }] } }));

    expect(events).toEqual([]);
  });

  it('falls back to "?" for a tool_use block with no name', () => {
    const events = cursorProvider
      .createParser()
      .parseLine(line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1' }] } }));

    expect(events).toEqual([{ type: 'tool-call', id: 't1', name: '?', summary: '' }]);
  });

  it('emits a plan event from createPlanToolCall', () => {
    const events = cursorProvider.createParser().parseLine(
      line({
        type: 'tool_call',
        subtype: 'started',
        call_id: 'p1',
        tool_call: { createPlanToolCall: { args: { plan: '## Docs plan\n1. step' } } },
      }),
    );

    expect(events).toEqual([{ type: 'plan', markdown: '## Docs plan\n1. step' }]);
  });

  it('resolvePlanContent treats blank plan markdown as missing', () => {
    expect(
      cursorProvider.resolvePlanContent({
        planMarkdown: '   ',
        doneEvent: undefined,
        textParts: [],
      }),
    ).toBeUndefined();
  });

  it('resolvePlanContent ignores done narration when no plan event was captured', () => {
    expect(
      cursorProvider.resolvePlanContent({
        planMarkdown: undefined,
        doneEvent: { type: 'done', isError: false, text: 'Creating the plan...' },
        textParts: ['Analyzing...'],
      }),
    ).toBeUndefined();
  });

  it('does not add a plan event for ExitPlanMode (that is a claude-only tool)', () => {
    const events = cursorProvider.createParser().parseLine(
      line({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'ExitPlanMode', input: { plan: 'x' } }] },
      }),
    );

    expect(events).toEqual([{ type: 'tool-call', id: 't1', name: 'ExitPlanMode', summary: '' }]);
  });

  it('pairs a tool_result with the recorded tool name, same shape as claude', () => {
    const parser = cursorProvider.createParser();
    parser.parseLine(
      line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Shell' }] } }),
    );

    const events = parser.parseLine(
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } }),
    );

    expect(events).toEqual([
      { type: 'tool-result', id: 't1', name: 'Shell', isError: false, denied: false, text: 'ok' },
    ]);
  });

  it('marks a permission denial separately from any other tool failure', () => {
    const denied = cursorProvider.createParser().parseLine(
      line({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't1',
              is_error: true,
              content: 'Permission to use Bash has been denied',
            },
          ],
        },
      }),
    );
    const failed = cursorProvider.createParser().parseLine(
      line({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'Exit code 1' }] },
      }),
    );

    expect(denied[0]).toMatchObject({ isError: true, denied: true });
    expect(failed[0]).toMatchObject({ isError: true, denied: false });
  });

  it('ignores a user-message block that is not a tool_result, or one missing tool_use_id', () => {
    const noResult = cursorProvider
      .createParser()
      .parseLine(line({ type: 'user', message: { content: [{ type: 'text', text: 'hi' }] } }));
    const noId = cursorProvider
      .createParser()
      .parseLine(line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }));

    expect(noResult).toEqual([]);
    expect(noId).toEqual([]);
  });

  it('parses a result event', () => {
    expect(cursorProvider.createParser().parseLine(line({ type: 'result', is_error: false, result: 'done' }))).toEqual([
      { type: 'done', isError: false, text: 'done' },
    ]);
  });

  it('defaults is_error and result when absent', () => {
    expect(cursorProvider.createParser().parseLine(line({ type: 'result' }))).toEqual([
      { type: 'done', isError: false, text: '' },
    ]);
  });

  it('returns nothing for an unrecognized event type', () => {
    expect(cursorProvider.createParser().parseLine(line({ type: 'stream_event' }))).toEqual([]);
  });

  it('parses the captured cursor plan-mode fixture end-to-end', () => {
    const parser = cursorProvider.createParser();
    const events: AgentEvent[] = [];
    for (const raw of readFileSync(CURSOR_PLAN_FIXTURE, 'utf8').split('\n')) {
      if (raw.trim() === '') {
        continue;
      }
      events.push(...parser.parseLine(raw));
    }

    const plan = events.find((event): event is Extract<AgentEvent, { type: 'plan' }> => event.type === 'plan');
    expect(plan?.markdown).toContain('## Documentation update plan');
    expect(
      cursorProvider.resolvePlanContent({
        planMarkdown: plan?.markdown,
        doneEvent: events.find((event): event is Extract<AgentEvent, { type: 'done' }> => event.type === 'done'),
        textParts: events
          .filter((event): event is Extract<AgentEvent, { type: 'text' }> => event.type === 'text')
          .map((event) => event.text),
      }),
    ).toContain('docs/01-agentes.md');
  });
});

/** The cli.json written into `dir/.cursor`, as allow and deny lists. */
function cliJsonIn(dir: string): { allow: string[]; deny: string[] } {
  const written = JSON.parse(readFileSync(join(dir, '.cursor/cli.json'), 'utf8')) as {
    permissions: { allow: string[]; deny: string[] };
  };
  return written.permissions;
}

describe('cursorProvider.prepareWorkspace', () => {
  it("writes the agent's permissions into its run dir for the run and removes them afterwards", () => {
    const tmp = makeTmpDir('cursor-prepare');
    try {
      const permissions = readAgentPermissions({ deny: { execute: { './': ['prettier'] } } });
      const restore = cursorProvider.prepareWorkspace(
        fakeRequest({ workspaceRoot: '/', runDir: tmp.path, agent: fakeAgent({ permissions }) }),
      );

      const { allow, deny } = cliJsonIn(tmp.path);
      expect(allow).toEqual([]);
      expect(deny[0]).toBe('Shell(prettier)');
      restore();
      expect(existsSync(join(tmp.path, '.cursor'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('denies the rest of the disk even to an agent that declares no permissions', () => {
    const tmp = makeTmpDir('cursor-prepare-none');
    try {
      const restore = cursorProvider.prepareWorkspace(fakeRequest({ workspaceRoot: '/', runDir: tmp.path }));

      const { allow, deny } = cliJsonIn(tmp.path);
      expect(allow).toEqual([]);
      expect(deny).toEqual(expect.arrayContaining(['Read(/etc/**)', 'Write(/etc/**)']));
      restore();
    } finally {
      tmp.cleanup();
    }
  });

  it('writes the listed MCP servers and their permission for the run, then removes both files', () => {
    const tmp = makeTmpDir('cursor-prepare-mcps');
    try {
      const restore = cursorProvider.prepareWorkspace(
        fakeRequest({
          workspaceRoot: '/',
          runDir: tmp.path,
          mcpServers: [
            {
              name: 'browser',
              config: { command: 'npx', args: ['browser-mcp'] },
              path: '/repo/.choliba/mcps/browser.json',
            },
          ],
        }),
      );

      const mcpJson: unknown = JSON.parse(readFileSync(join(tmp.path, '.cursor/mcp.json'), 'utf8'));
      expect(mcpJson).toEqual({ mcpServers: { browser: { command: 'npx', args: ['browser-mcp'] } } });
      expect(cliJsonIn(tmp.path).allow).toEqual(['Mcp(browser:*)']);
      restore();
      expect(existsSync(join(tmp.path, '.cursor'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('undoes the permissions already written when the MCP file cannot be', () => {
    const tmp = makeTmpDir('cursor-prepare-mcps-invalid');
    try {
      mkdirSync(join(tmp.path, '.cursor'));
      writeFileSync(join(tmp.path, '.cursor/mcp.json'), '{ nope');

      expect(() =>
        cursorProvider.prepareWorkspace(
          fakeRequest({
            workspaceRoot: '/',
            runDir: tmp.path,
            mcpServers: [
              {
                name: 'browser',
                config: { command: 'npx', args: ['browser-mcp'] },
                path: '/repo/.choliba/mcps/browser.json',
              },
            ],
          }),
        ),
      ).toThrow('não é um JSON válido');
      expect(existsSync(join(tmp.path, '.cursor/cli.json'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('cursorProvider.previewWorkspace', () => {
  it('shows what prepareWorkspace would write, without writing anything', () => {
    const tmp = makeTmpDir('cursor-preview');
    try {
      const browser = { name: 'browser', config: { command: 'npx' }, path: '/repo/.choliba/mcps/browser.json' };
      const request = fakeRequest({ workspaceRoot: '/', runDir: tmp.path, mcpServers: [browser] });

      const files = cursorProvider.previewWorkspace(request);

      expect(files.map((file) => file.path)).toEqual([
        join(tmp.path, '.cursor', 'cli.json'),
        join(tmp.path, '.cursor', 'mcp.json'),
      ]);
      expect(JSON.parse(files[1]?.content ?? '')).toEqual({ mcpServers: { browser: { command: 'npx' } } });
      expect(existsSync(join(tmp.path, '.cursor'))).toBe(false);

      const restore = cursorProvider.prepareWorkspace(request);
      expect(readFileSync(join(tmp.path, '.cursor', 'cli.json'), 'utf8')).toBe(files[0]?.content);
      restore();
      expect(cursorProvider.previewWorkspace(fakeRequest({ workspaceRoot: '/', runDir: tmp.path }))).toHaveLength(1);
    } finally {
      tmp.cleanup();
    }
  });
});
