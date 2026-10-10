import { NO_PERMISSIONS, type AgentPermissions } from '../../common/agent-permissions';
import {
  containerMounts,
  type ContainerMount,
  type DiskFacts,
  type SandboxReach,
} from '../../common/sandbox/container-mounts';

/** Only what the container mounts. */
function mountsFor(reach: SandboxReach, facts: DiskFacts): readonly ContainerMount[] {
  return containerMounts(reach, facts).mounts;
}

/** A disk of folders (ending in `/`) and files. */
function disk(entries: readonly string[]): DiskFacts {
  const folders = new Set(entries.filter((entry) => entry.endsWith('/')).map((entry) => entry.slice(0, -1)));
  const files = new Set(entries.filter((entry) => !entry.endsWith('/')));
  const exists = (path: string): boolean => path === '/' || folders.has(path) || files.has(path);
  return {
    exists,
    isDirectory: (path) => path === '/' || folders.has(path),
    read: (dir) =>
      [...folders, ...files]
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
        .map((path) => ({ name: path.slice(dir.length + 1), isDirectory: folders.has(path) })),
  };
}

const DISK = disk([
  '/w/',
  '/w/.cache/',
  '/w/.cache/runs/',
  '/w/.cache/runs/1/',
  '/w/.cache/runs/1.delete',
  '/w/docs/',
  '/w/docs/publico/',
  '/w/docs/segredo/',
  '/w/.env',
  '/w/node_modules/',
  '/w/projects/',
  '/w/projects/loja/',
  '/w/projects/loja/tests/',
  '/w/src/',
  '/app/',
]);

function reach(permissions: Partial<AgentPermissions>, more: Partial<SandboxReach> = {}): SandboxReach {
  return {
    permissions: { ...NO_PERMISSIONS, ...permissions },
    policy: 'edits',
    addDirs: [],
    runDir: '/w/.cache/runs/1',
    alsoRead: [],
    alsoWrite: [],
    ...more,
  };
}

describe('containerMounts', () => {
  it('mounts only the run folder when the agent may reach nothing', () => {
    expect(mountsFor(reach({}), DISK)).toEqual([{ path: '/w/.cache/runs/1', access: 'write', directory: true }]);
  });

  it('reads allow.read, --add-dir, the folders commands run in and alsoRead; writes allow.write and alsoWrite', () => {
    const mounts = mountsFor(
      reach(
        {
          allowRead: ['/w/docs/', '/w/src/**/*.ts'],
          allowWrite: ['/app/'],
          allowExecute: [{ dir: '/w/', commands: ['bunx choliba tests'] }],
        },
        {
          addDirs: ['/w/projects'],
          alsoRead: ['/w/.cache/runs/1.delete', '/w/node_modules'],
          alsoWrite: ['/w/.cache'],
        },
      ),
      DISK,
    );
    expect(mounts).toEqual([
      { path: '/app', access: 'write', directory: true },
      { path: '/w', access: 'read', directory: true },
      { path: '/w/.cache', access: 'write', directory: true },
      { path: '/w/.cache/runs/1', access: 'write', directory: true },
      { path: '/w/.cache/runs/1.delete', access: 'read', directory: false },
      { path: '/w/docs', access: 'read', directory: true },
      { path: '/w/node_modules', access: 'read', directory: true },
      { path: '/w/projects', access: 'read', directory: true },
      { path: '/w/src', access: 'read', directory: true },
    ]);
  });

  it('opens the folder of a file the agent may create, never one higher, and nothing for a path not on disk', () => {
    const mounts = mountsFor(
      reach({
        allowWrite: ['/w/projects/loja/tests/loja-1.spec.ts', '/w/projects/loja/novo/x.spec.ts'],
        allowRead: ['/nada/aqui/', '/w/src/nao-existe.ts'],
      }),
      DISK,
    );
    expect(mounts).toEqual([
      { path: '/w/.cache/runs/1', access: 'write', directory: true },
      { path: '/w/projects/loja/tests', access: 'write', directory: true },
    ]);
  });

  it('writes nothing of allow.write under read-only, only the run folder', () => {
    const mounts = mountsFor(reach({ allowWrite: ['/app/'] }, { policy: 'read-only' }), DISK);
    expect(mounts).toEqual([{ path: '/w/.cache/runs/1', access: 'write', directory: true }]);
  });

  it('hides a deny.read inside a mount, keeping its ! exceptions, and turns a deny.write back to read-only', () => {
    const mounts = mountsFor(
      reach({
        allowRead: ['/w/'],
        allowWrite: ['/w/docs/'],
        denyRead: ['/w/docs/', '!/w/docs/publico/', '/w/.env', '/fora/'],
        denyWrite: ['/w/docs/publico/'],
      }),
      DISK,
    );
    expect(mounts).toEqual(
      expect.arrayContaining([
        { path: '/w/docs', access: 'write', directory: true },
        { path: '/w/docs/publico', access: 'read', directory: true },
        { path: '/w/docs/segredo', access: 'hidden', directory: true },
        { path: '/w/.env', access: 'hidden', directory: false },
      ]),
    );
    expect(mounts.some((mount) => mount.path.startsWith('/fora'))).toBe(false);
  });

  it('mounts a path named twice once, writable when any of them writes', () => {
    const mounts = mountsFor(reach({ allowRead: ['/app/'], allowWrite: ['/app/'] }, { alsoWrite: ['/app'] }), DISK);
    expect(mounts.filter((mount) => mount.path === '/app')).toEqual([
      { path: '/app', access: 'write', directory: true },
    ]);
  });

  it('lets a deny override an allow at the very same path', () => {
    const mounts = mountsFor(reach({ allowWrite: ['/app/'], denyWrite: ['/app/'] }), DISK);
    expect(mounts).toContainEqual({ path: '/app', access: 'read', directory: true });
  });
});

describe('containerMounts — the image keeps its own folders', () => {
  const SYSTEM = disk([
    '/',
    '/etc/',
    '/etc/passwd',
    '/usr/',
    '/opt/',
    '/opt/x/',
    '/home/',
    '/home/choliba/',
    '/home/jackson/',
    '/home/jackson/dev/',
    '/home/jackson/dev/x/',
    '/var/',
    '/var/www/',
    '/var/www/app/',
    '/tmp/',
    '/tmp/w/',
    '/w/',
    '/w/.cache/',
    '/w/.cache/runs/',
    '/w/.cache/runs/1/',
  ]);

  it('never mounts the root nor anything in the system folders, and says which paths it left to the image', () => {
    const plan = containerMounts(
      reach({
        allowRead: ['/', '/etc/passwd', '/usr/', '/opt/x/', '/home/choliba/'],
        denyRead: ['/etc/'],
      }),
      SYSTEM,
    );
    expect(plan.mounts).toEqual([{ path: '/w/.cache/runs/1', access: 'write', directory: true }]);
    expect(plan.skipped).toEqual(['/', '/etc/passwd', '/home/choliba', '/opt/x', '/usr']);
  });

  it("still mounts the user's own folders, wherever they are", () => {
    const plan = containerMounts(reach({ allowRead: ['/home/jackson/dev/x/', '/var/www/app/', '/tmp/w/'] }), SYSTEM);
    expect(plan.mounts.map((mount) => mount.path)).toEqual([
      '/home/jackson/dev/x',
      '/tmp/w',
      '/var/www/app',
      '/w/.cache/runs/1',
    ]);
    expect(plan.skipped).toEqual([]);
  });
});
