import { decide, type PermissionRequest } from '@choliba/sandbox';

import { readAgentPermissions } from '../../common/agent-permissions';
import { pathPolicy } from '../../common/path-policy';

const PERMISSIONS = readAgentPermissions({
  allow: { read: ['/w/'], write: ['/w/tickets/'], delete: ['/w/app/'] },
  deny: { read: ['/w/segredo/'], write: ['/w/tickets/'], delete: ['/w/app/node_modules/'] },
  exception: { read: ['/w/segredo/publico/'], write: ['/w/tickets/1.json'] },
});

function asked(action: PermissionRequest['action'], path: string): PermissionRequest {
  return {
    subject: { kind: 'agent', id: 'po' },
    action,
    object: { kind: 'path', path },
    context: { mode: 'execute' },
  };
}

describe('pathPolicy', () => {
  it('turns read into read and list, write into create and edit, and takes the exceptions out of the deny', () => {
    const policy = pathPolicy(PERMISSIONS);

    expect(policy.read).toEqual({ allow: ['/w/'], deny: ['/w/segredo/'], exception: ['/w/segredo/publico/'] });
    expect(policy.list).toEqual(policy.read);
    expect(policy.create).toEqual({ allow: ['/w/tickets/'], deny: ['/w/tickets/'], exception: ['/w/tickets/1.json'] });
    expect(policy.edit).toEqual(policy.create);
    expect(policy.delete).toEqual({ allow: ['/w/app/'], deny: ['/w/app/node_modules/'], exception: [] });
  });

  it('reaches what the agent reached: the sandbox decides as the permissions say', () => {
    const policy = { path: pathPolicy(PERMISSIONS), tool: { allow: [], deny: [], exception: [] } };

    expect(decide(asked('read', '/w/src/a.ts'), policy)).toBe('allow');
    expect(decide(asked('list', '/w/segredo/x'), policy)).toBe('deny');
    expect(decide(asked('read', '/w/segredo/publico/a.md'), policy)).toBe('allow');
    expect(decide(asked('edit', '/w/tickets/1.json'), policy)).toBe('allow');
    expect(decide(asked('create', '/w/tickets/2.json'), policy)).toBe('deny');
    expect(decide(asked('delete', '/w/app/dist/x.js'), policy)).toBe('allow');
    expect(decide(asked('delete', '/w/app/node_modules/x'), policy)).toBe('deny');
  });
});
