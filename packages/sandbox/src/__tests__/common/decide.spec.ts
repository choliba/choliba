import type { PathPolicy, PathRule, PermissionRequest } from '../../index';
import { PATH_ACTIONS, PERMISSION_FLOOR, WRITE_ACTIONS, decide } from '../../index';

const EMPTY: PathRule = { allow: [], deny: [], exception: [] };

const POLICY: PathPolicy = {
  read: { allow: ['/w'], deny: ['/w/secret'], exception: ['/w/secret/public'] },
  list: { allow: ['/w'], deny: [], exception: [] },
  create: { allow: ['/w'], deny: [], exception: [] },
  edit: { allow: ['/w'], deny: ['/w/locked'], exception: [] },
  delete: { allow: ['/w'], deny: [], exception: [] },
};

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
    const policy = { ...POLICY, read: EMPTY };
    expect(decide(request(), policy)).toBe('deny');
  });

  it('lets a deny win over an allow', () => {
    expect(decide(request({ object: { kind: 'path', path: '/w/secret/key' } }), POLICY)).toBe('deny');
  });

  it('takes an excepted path out of the deny and still requires an allow', () => {
    const excepted = request({ object: { kind: 'path', path: '/w/secret/public/note' } });
    expect(decide(excepted, POLICY)).toBe('allow');
    const withoutAllow = { ...POLICY, read: { allow: [], deny: ['/w'], exception: ['/w/secret/public'] } };
    expect(decide(excepted, withoutAllow)).toBe('deny');
  });

  it('keeps a narrower deny after a broader exception', () => {
    const read: PathRule = {
      allow: ['/w'],
      deny: ['/w', '/w/public/secret'],
      exception: ['/w/public'],
    };
    const policy = { ...POLICY, read };
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

  it('denies an action that is not a path, and a path action aimed at something else', () => {
    expect(
      decide(request({ action: 'invoke', object: { kind: 'tool', server: 'browser', name: 'open' } }), POLICY),
    ).toBe('deny');
    expect(decide(request({ action: 'read', object: { kind: 'env', name: 'TOKEN' } }), POLICY)).toBe('deny');
  });

  it('states the floor of each action without recording what a runtime imposed', () => {
    for (const action of PATH_ACTIONS) expect(PERMISSION_FLOOR[action]).toBe('enforced');
    expect(PERMISSION_FLOOR.execute).toBe('delegated');
    expect(PERMISSION_FLOOR.invoke).toBe('delegated');
    expect(PERMISSION_FLOOR.connect).toBe('enforced');
    expect(PERMISSION_FLOOR.bind).toBe('enforced');
  });
});
