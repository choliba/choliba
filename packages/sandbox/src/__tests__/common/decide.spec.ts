import type { PathPolicy, PathRule, PermissionPolicy, PermissionRequest, ToolPolicy } from '../../index';
import { PATH_ACTIONS, PERMISSION_FLOOR, WRITE_ACTIONS, decide } from '../../index';

const EMPTY: PathRule = { allow: [], deny: [], exception: [] };

const PATHS: PathPolicy = {
  read: { allow: ['/w'], deny: ['/w/secret'], exception: ['/w/secret/public'] },
  list: { allow: ['/w'], deny: [], exception: [] },
  create: { allow: ['/w'], deny: [], exception: [] },
  edit: { allow: ['/w'], deny: ['/w/locked'], exception: [] },
  delete: { allow: ['/w'], deny: [], exception: [] },
};

const TOOLS: ToolPolicy = {
  allow: [{ name: 'Read' }, { server: 'browser' }, { server: 'docs', name: 'search' }],
  deny: [{ name: 'Task' }, { server: 'browser' }, { server: 'browser', name: 'eval' }],
  exception: [{ server: 'browser' }, { server: 'browser', name: 'eval' }],
};

const POLICY: PermissionPolicy = { path: PATHS, tool: TOOLS };

/** `TOOLS` without its exceptions: the deny of the whole browser server holds. */
const STRICT: PermissionPolicy = { path: PATHS, tool: { ...TOOLS, exception: [] } };

function invoking(tool: { server?: string; name: string }, mode: PermissionRequest['context']['mode'] = 'execute') {
  return request({ action: 'invoke', object: { kind: 'tool', ...tool }, context: { mode } });
}

function request(over: Partial<PermissionRequest> = {}): PermissionRequest {
  return {
    subject: { kind: 'agent', id: 'writer' },
    action: 'read',
    object: { kind: 'path', path: '/w/src/a.ts' },
    context: { mode: 'execute' },
    ...over,
  };
}

describe('decide', () => {
  it('denies a path no allow covers', () => {
    const policy = { ...POLICY, path: { ...PATHS, read: EMPTY } };
    expect(decide(request(), policy)).toBe('deny');
  });

  it('lets a deny win over an allow', () => {
    expect(decide(request({ object: { kind: 'path', path: '/w/secret/key' } }), POLICY)).toBe('deny');
  });

  it('takes an excepted path out of the deny and still requires an allow', () => {
    const excepted = request({ object: { kind: 'path', path: '/w/secret/public/note' } });
    expect(decide(excepted, POLICY)).toBe('allow');
    const withoutAllow = {
      ...POLICY,
      path: { ...PATHS, read: { allow: [], deny: ['/w'], exception: ['/w/secret/public'] } },
    };
    expect(decide(excepted, withoutAllow)).toBe('deny');
  });

  it('keeps a narrower deny after a broader exception', () => {
    const read: PathRule = {
      allow: ['/w'],
      deny: ['/w', '/w/public/secret'],
      exception: ['/w/public'],
    };
    const policy = { ...POLICY, path: { ...PATHS, read } };
    expect(decide(request({ object: { kind: 'path', path: '/w/public/note' } }), policy)).toBe('allow');
    expect(decide(request({ object: { kind: 'path', path: '/w/public/secret/key' } }), policy)).toBe('deny');
  });

  it.each(WRITE_ACTIONS)('denies %s in plan and ask, and allows it in execute', (action) => {
    const asking = request({ action, object: { kind: 'path', path: '/w/src/a.ts' }, context: { mode: 'plan' } });
    expect(decide(asking, POLICY)).toBe('deny');
    expect(decide({ ...asking, context: { mode: 'ask' } }, POLICY)).toBe('deny');
    expect(decide({ ...asking, context: { mode: 'execute' } }, POLICY)).toBe('allow');
  });

  it('still allows a read in plan', () => {
    expect(decide(request({ context: { mode: 'plan' } }), POLICY)).toBe('allow');
  });

  it('denies a command, the network and the environment, and an action aimed at the wrong kind of object', () => {
    const command = { kind: 'command', dir: '/w', argv: ['ls'] } as const;
    expect(decide(request({ action: 'execute', object: command }), POLICY)).toBe('deny');
    expect(decide(request({ action: 'invoke', object: command }), POLICY)).toBe('deny');
    expect(decide(request({ action: 'connect', object: { kind: 'network', host: 'x.dev' } }), POLICY)).toBe('deny');
    expect(decide(request({ action: 'read', object: { kind: 'env', name: 'TOKEN' } }), POLICY)).toBe('deny');
    expect(decide(request({ action: 'read', object: { kind: 'tool', name: 'Read' } }), POLICY)).toBe('deny');
  });

  it('allows a tool an allow covers, a whole server by its name, and denies any other', () => {
    expect(decide(invoking({ name: 'Read' }), POLICY)).toBe('allow');
    expect(decide(invoking({ server: 'docs', name: 'search' }), POLICY)).toBe('allow');
    expect(decide(invoking({ server: 'docs', name: 'write' }), POLICY)).toBe('deny');
    expect(decide(invoking({ name: 'Bash' }), POLICY)).toBe('deny');
  });

  it('keeps a built-in apart from an MCP tool of the same name', () => {
    expect(decide(invoking({ server: 'files', name: 'Read' }), POLICY)).toBe('deny');
    const mcpOnly = { ...POLICY, tool: { ...TOOLS, allow: [{ server: 'files', name: 'Read' }] } };
    expect(decide(invoking({ name: 'Read' }), mcpOnly)).toBe('deny');
  });

  it('reads a tool named * as that tool, not as every tool', () => {
    const star = { ...POLICY, tool: { allow: [{ server: 'docs', name: '*' }], deny: [], exception: [] } };
    expect(decide(invoking({ server: 'docs', name: '*' }), star)).toBe('allow');
    expect(decide(invoking({ server: 'docs', name: 'search' }), star)).toBe('deny');
  });

  it('lets a deny of a tool win, and an exception take a server out without granting', () => {
    expect(decide(invoking({ name: 'Task' }), POLICY)).toBe('deny');
    expect(decide(invoking({ server: 'browser', name: 'open' }), STRICT)).toBe('deny');
    expect(decide(invoking({ server: 'browser', name: 'open' }), POLICY)).toBe('allow');
    const withoutAllow = { ...POLICY, tool: { ...TOOLS, allow: [] } };
    expect(decide(invoking({ server: 'browser', name: 'open' }), withoutAllow)).toBe('deny');
  });

  it('keeps a narrower deny of a tool after a broader exception of its server', () => {
    const tool: ToolPolicy = {
      allow: [{ server: 'browser' }],
      deny: [{ server: 'browser' }, { server: 'browser', name: 'eval' }],
      exception: [{ server: 'browser' }],
    };
    const policy = { ...POLICY, tool };
    expect(decide(invoking({ server: 'browser', name: 'open' }), policy)).toBe('allow');
    expect(decide(invoking({ server: 'browser', name: 'eval' }), policy)).toBe('deny');
  });

  it('does not block a tool in plan or ask, and the subject does not change the decision', () => {
    expect(decide(invoking({ name: 'Read' }, 'plan'), POLICY)).toBe('allow');
    expect(decide(invoking({ name: 'Read' }, 'ask'), POLICY)).toBe('allow');
    const step = { ...invoking({ name: 'Task' }), subject: { kind: 'step', id: 'run' } } as const;
    expect(decide(step, POLICY)).toBe('deny');
  });

  it('states the floor of each action without recording what a runtime imposed', () => {
    for (const action of PATH_ACTIONS) expect(PERMISSION_FLOOR[action]).toBe('enforced');
    expect(PERMISSION_FLOOR.execute).toBe('delegated');
    expect(PERMISSION_FLOOR.invoke).toBe('delegated');
    expect(PERMISSION_FLOOR.connect).toBe('enforced');
    expect(PERMISSION_FLOOR.bind).toBe('enforced');
  });
});
