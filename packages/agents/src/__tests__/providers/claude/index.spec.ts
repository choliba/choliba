import type { AgentDefinition } from '../../../agent.types';
import type { ProviderRequest } from '../../../providers/provider.types';
import { claudeProvider } from '../../../providers/claude';
import { PromptTooLargeError, MAX_ARG_BYTES } from '../../../prompt';
import { NO_PERMISSIONS, readAgentPermissions } from '../../../permissions';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';

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

describe('claudeProvider.buildArgs', () => {
  it('puts -p and the prompt first, and includes stream-json + verbose + the system prompt', () => {
    const args = claudeProvider.buildArgs(fakeRequest());

    expect(args[0]).toBe('-p');
    expect(args[1]).toBe('do the task');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('--verbose');
    expect(args).toContain('--append-system-prompt');
    expect(args.at(args.indexOf('--append-system-prompt') + 1)).toContain('be an echo');
  });

  it("puts the order to use the agent's skills in the system prompt, ahead of the instructions", () => {
    const args = claudeProvider.buildArgs(fakeRequest({ skillsInstruction: 'Utilize a skill docs.' }));
    const system = String(args.at(args.indexOf('--append-system-prompt') + 1));

    expect(system.indexOf('Utilize a skill docs.')).toBeLessThan(system.indexOf('be an echo'));
    expect(args[1]).toBe('do the task');
  });

  const DECLARED = readAgentPermissions({
    allow: {
      read: ['src/'],
      write: ['docs/', 'README.md'],
      execute: { './': ['git diff'], '/app/': ['git diff', 'composer test'] },
    },
    deny: { read: ['.env'], write: ['packages/'], execute: { './': ['prettier'], '/etc/': ['*'] } },
  });

  it('maps read-only to dontAsk with only the read tools (and Bash), rules at the end of the argv', () => {
    const args = claudeProvider.buildArgs(
      fakeRequest({ policy: 'read-only', agent: fakeAgent({ permissions: DECLARED }) }),
    );

    expect(args).toEqual(
      expect.arrayContaining(['--permission-mode', 'dontAsk', '--tools', 'Read,Grep,Glob,Bash', '--strict-mcp-config']),
    );
    const allowed = args.slice(args.indexOf('--allowedTools') + 1, args.indexOf('--disallowedTools'));
    // Relative paths become absolute from the workspace root: the provider runs in its run dir.
    expect(allowed).toEqual(['Read(//repo/src/**)', 'Bash(git diff:*)', 'Bash(composer test:*)']);
    expect(args.slice(args.indexOf('--disallowedTools') + 1)).toEqual([
      'Read(//repo/.env)',
      'Edit(//repo/packages/**)',
      'Write(//repo/packages/**)',
      'Bash(prettier:*)',
      'Bash(cd /etc:*)',
    ]);
  });

  it('gives an agent that declares nothing no tool at all, and no rules', () => {
    const args = claudeProvider.buildArgs(fakeRequest({ policy: 'read-only' }));

    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'dontAsk', '--strict-mcp-config']));
    expect(args.at(args.indexOf('--tools') + 1)).toBe('');
    expect(args.includes('--allowedTools')).toBe(false);
    expect(args.includes('--disallowedTools')).toBe(false);
  });

  it('maps edits with an allowlist to dontAsk, allowing the declared writes', () => {
    const args = claudeProvider.buildArgs(
      fakeRequest({ policy: 'edits', agent: fakeAgent({ permissions: DECLARED }) }),
    );

    expect(args).toEqual(
      expect.arrayContaining(['--permission-mode', 'dontAsk', '--tools', 'Read,Grep,Glob,Edit,Write,Bash']),
    );
    expect(args).toEqual(
      expect.arrayContaining([
        'Edit(//repo/docs/**)',
        'Write(//repo/docs/**)',
        'Edit(//repo/README.md)',
        'Write(//repo/README.md)',
      ]),
    );
  });

  it('writes a filesystem-absolute path with two slashes, as Claude Code rules expect', () => {
    const permissions = readAgentPermissions({
      allow: { read: ['/p/*/config.json'], write: ['/p/*/tickets/'] },
      deny: { read: ['/p/secret/'], write: ['/p/secret/'] },
    });
    const args = claudeProvider.buildArgs(fakeRequest({ policy: 'edits', agent: fakeAgent({ permissions }) }));

    expect(args).toEqual(
      expect.arrayContaining([
        'Read(//p/*/config.json)',
        'Edit(//p/*/tickets/**)',
        'Write(//p/*/tickets/**)',
        'Read(//p/secret/**)',
        'Edit(//p/secret/**)',
      ]),
    );
  });

  it('denies without asking in edits too, when the agent declares nothing to write', () => {
    const args = claudeProvider.buildArgs(fakeRequest({ policy: 'edits' }));

    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'dontAsk']));
    expect(args.at(args.indexOf('--tools') + 1)).toBe('');
    expect(args.includes('--allowedTools')).toBe(false);
  });

  it('keeps only the read tools when read-only declares no commands', () => {
    const permissions = readAgentPermissions({ allow: { read: ['src/'] } });
    const args = claudeProvider.buildArgs(fakeRequest({ policy: 'read-only', agent: fakeAgent({ permissions }) }));

    expect(args).toEqual(expect.arrayContaining(['--tools', 'Read,Grep,Glob']));
  });

  it('writes the permissions into the system prompt, ahead of the instructions', () => {
    const args = claudeProvider.buildArgs(fakeRequest({ agent: fakeAgent({ permissions: DECLARED }) }));
    const system = String(args.at(args.indexOf('--append-system-prompt') + 1));

    expect(system).toContain('- in /app/: git diff, composer test');
    expect(system.indexOf('<permissions>')).toBeLessThan(system.indexOf('be an echo'));
  });

  it('keeps every MCP server but the listed ones out of the session, whatever the policy', () => {
    for (const policy of ['read-only', 'edits'] as const) {
      const args = claudeProvider.buildArgs(fakeRequest({ policy }));
      expect(args).toContain('--strict-mcp-config');
      expect(args.includes('--mcp-config')).toBe(false);
    }
  });

  it('loads the listed MCP servers inline and allows their tools', () => {
    const args = claudeProvider.buildArgs(
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

    expect(args.at(args.indexOf('--mcp-config') + 1)).toBe(
      JSON.stringify({ mcpServers: { browser: { command: 'npx', args: ['browser-mcp'] } } }),
    );
    expect(args.slice(args.indexOf('--allowedTools') + 1)).toEqual(['mcp__browser']);
  });

  it("allows only the tools an MCP server's declaration lists", () => {
    const server = {
      name: 'app',
      config: { command: 'x' },
      path: '/a.json',
      tools: ['jira_search', 'use_environment'],
    };
    const args = claudeProvider.buildArgs(fakeRequest({ policy: 'edits', mcpServers: [server] }));

    expect(args.slice(args.indexOf('--allowedTools') + 1)).toEqual([
      'mcp__app__jira_search',
      'mcp__app__use_environment',
    ]);
  });

  it('adds --model only when one is given', () => {
    expect(claudeProvider.buildArgs(fakeRequest()).includes('--model')).toBe(false);
    expect(claudeProvider.buildArgs(fakeRequest({ model: 'sonnet' }))).toEqual(
      expect.arrayContaining(['--model', 'sonnet']),
    );
  });

  it('adds --add-dir with every directory, only when addDirs is non-empty', () => {
    expect(claudeProvider.buildArgs(fakeRequest()).includes('--add-dir')).toBe(false);
    const args = claudeProvider.buildArgs(fakeRequest({ addDirs: ['/a', '/b'] }));
    expect(args.slice(args.indexOf('--add-dir') + 1, args.indexOf('--add-dir') + 3)).toEqual(['/a', '/b']);
  });

  it('throws PromptTooLargeError instead of returning an oversized argument', () => {
    expect(() => {
      claudeProvider.buildArgs(fakeRequest({ userPrompt: 'x'.repeat(MAX_ARG_BYTES + 1) }));
    }).toThrow(PromptTooLargeError);
  });
});

describe('claudeProvider.createParser', () => {
  const line = (obj: unknown): string => JSON.stringify(obj);

  it('returns nothing for a blank line', () => {
    expect(claudeProvider.createParser().parseLine('')).toEqual([]);
  });

  it('returns nothing for malformed JSON', () => {
    expect(claudeProvider.createParser().parseLine('not json')).toEqual([]);
  });

  it('returns nothing for JSON that is not an object', () => {
    expect(claudeProvider.createParser().parseLine('[1,2]')).toEqual([]);
  });

  it('returns nothing for an unrecognized event type', () => {
    expect(claudeProvider.createParser().parseLine(line({ type: 'stream_event' }))).toEqual([]);
  });

  it('parses a system/init event', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(line({ type: 'system', subtype: 'init', model: 'sonnet-5', session_id: 'abc' }));

    expect(events).toEqual([{ type: 'init', model: 'sonnet-5', sessionId: 'abc' }]);
  });

  it('does not treat a system event of another subtype as init', () => {
    expect(claudeProvider.createParser().parseLine(line({ type: 'system', subtype: 'other' }))).toEqual([]);
  });

  it('parses assistant text blocks', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(line({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } }));

    expect(events).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('ignores an assistant thinking block', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(line({ type: 'assistant', message: { content: [{ type: 'thinking', text: 'hmm' }] } }));

    expect(events).toEqual([]);
  });

  it('parses an assistant tool_use block, summarizing its input', () => {
    const events = claudeProvider.createParser().parseLine(
      line({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'git status' } }] },
      }),
    );

    expect(events).toEqual([{ type: 'tool-call', id: 't1', name: 'Bash', summary: 'git status' }]);
  });

  it('falls back to "?" for a tool_use block with no name', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1' }] } }));

    expect(events).toEqual([{ type: 'tool-call', id: 't1', name: '?', summary: '' }]);
  });

  it('emits an extra plan event for ExitPlanMode, in addition to the tool-call', () => {
    const events = claudeProvider.createParser().parseLine(
      line({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'ExitPlanMode', input: { plan: '1. do x' } }] },
      }),
    );

    expect(events).toEqual([
      { type: 'tool-call', id: 't1', name: 'ExitPlanMode', summary: '' },
      { type: 'plan', markdown: '1. do x' },
    ]);
  });

  it('does not emit a plan event for ExitPlanMode without input.plan', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(
        line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'ExitPlanMode' }] } }),
      );

    expect(events).toEqual([{ type: 'tool-call', id: 't1', name: 'ExitPlanMode', summary: '' }]);
  });

  it('pairs a tool_result with the tool_use name recorded earlier in the same session', () => {
    const parser = claudeProvider.createParser();
    parser.parseLine(line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash' }] } }));

    const events = parser.parseLine(
      line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } }),
    );

    expect(events).toEqual([
      { type: 'tool-result', id: 't1', name: 'Bash', isError: false, denied: false, text: 'ok' },
    ]);
  });

  it('leaves the name undefined for a tool_result whose call was never seen', () => {
    const events = claudeProvider
      .createParser()
      .parseLine(
        line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'unknown', content: 'x' }] } }),
      );

    expect(events).toEqual([
      { type: 'tool-result', id: 'unknown', name: undefined, isError: false, denied: false, text: 'x' },
    ]);
  });

  it('marks a permission denial separately from any other tool failure', () => {
    const denied = claudeProvider.createParser().parseLine(
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
    const failed = claudeProvider.createParser().parseLine(
      line({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'Exit code 128' }] },
      }),
    );

    expect(denied[0]).toMatchObject({ isError: true, denied: true });
    expect(failed[0]).toMatchObject({ isError: true, denied: false });
  });

  it('ignores a user-message block that is not a tool_result, or one missing tool_use_id', () => {
    const noResult = claudeProvider
      .createParser()
      .parseLine(line({ type: 'user', message: { content: [{ type: 'text', text: 'hi' }] } }));
    const noId = claudeProvider
      .createParser()
      .parseLine(line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }));

    expect(noResult).toEqual([]);
    expect(noId).toEqual([]);
  });

  it('parses a successful result', () => {
    const events = claudeProvider.createParser().parseLine(line({ type: 'result', is_error: false, result: 'done' }));

    expect(events).toEqual([{ type: 'done', isError: false, text: 'done' }]);
  });

  it('defaults is_error to false and result to empty when absent', () => {
    expect(claudeProvider.createParser().parseLine(line({ type: 'result' }))).toEqual([
      { type: 'done', isError: false, text: '' },
    ]);
  });
});
