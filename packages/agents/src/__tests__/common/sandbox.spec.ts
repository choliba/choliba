import { dockerRunArgs } from '../../common/sandbox/docker-run';
import {
  DEFAULT_SANDBOX_IMAGE,
  presentCredentials,
  readSandbox,
  SandboxConfigError,
} from '../../common/sandbox/sandbox';

describe('readSandbox', () => {
  it('is local by default, and docker with the default image or CHOL_SANDBOX_IMAGE', () => {
    expect(readSandbox({})).toEqual({ kind: 'local' });
    expect(readSandbox({ CHOL_SANDBOX: 'local' })).toEqual({ kind: 'local' });
    expect(readSandbox({ CHOL_SANDBOX: 'docker' })).toEqual({ kind: 'docker', image: DEFAULT_SANDBOX_IMAGE });
    expect(readSandbox({ CHOL_SANDBOX: 'docker', CHOL_SANDBOX_IMAGE: 'minha:1' })).toEqual({
      kind: 'docker',
      image: 'minha:1',
    });
  });

  it('refuses any other value, naming the ones it takes', () => {
    expect(() => readSandbox({ CHOL_SANDBOX: 'podman' })).toThrow(SandboxConfigError);
    expect(() => readSandbox({ CHOL_SANDBOX: 'podman' })).toThrow('use local ou docker');
  });
});

describe('presentCredentials', () => {
  it('names the provider credentials set to something', () => {
    expect(presentCredentials({ CLAUDE_CODE_OAUTH_TOKEN: 't', CURSOR_API_KEY: '', OUTRA: 'x' })).toEqual([
      'CLAUDE_CODE_OAUTH_TOKEN',
    ]);
  });
});

describe('dockerRunArgs', () => {
  const args = dockerRunArgs({
    image: 'choliba-agent',
    mounts: [
      { path: '/w', access: 'read', directory: true },
      { path: '/w/a,b', access: 'write', directory: true },
      { path: '/w/segredo', access: 'hidden', directory: true },
      { path: '/w/.env', access: 'hidden', directory: false },
    ],
    cwd: '/w/.cache/runs/1',
    user: { uid: 1000, gid: 1001 },
    env: ['CLAUDE_CODE_OAUTH_TOKEN'],
    command: ['claude', '-p', 'oi'],
  });

  it('runs as the owner, on the host network, read-only, without capabilities, with the command last', () => {
    expect(args.slice(0, 2)).toEqual(['docker', 'run']);
    expect(args).toEqual(expect.arrayContaining(['--rm', '-i', '--init', '--read-only']));
    expect(args.join(' ')).toContain('--user 1000:1001');
    expect(args.join(' ')).toContain('--network host');
    expect(args.join(' ')).toContain('--cap-drop ALL');
    expect(args.join(' ')).toContain('--security-opt no-new-privileges');
    expect(args.join(' ')).toContain('--env HOME=/home/choliba');
    expect(args.join(' ')).toContain('--env CLAUDE_CODE_OAUTH_TOKEN --mount');
    expect(args.slice(-5)).toEqual(['/w/.cache/runs/1', 'choliba-agent', 'claude', '-p', 'oi']);
    expect(args.join(' ')).not.toContain('docker.sock');
  });

  it('mounts each path at the same place: read-only, writable, or hidden under an empty folder or file', () => {
    const mounts = args.filter((_arg, index) => args[index - 1] === '--mount');
    expect(mounts).toEqual([
      'type=bind,src=/w,dst=/w,readonly',
      'type=bind,"src=/w/a,b","dst=/w/a,b"',
      'type=tmpfs,dst=/w/segredo',
      'type=bind,src=/dev/null,dst=/w/.env,readonly',
    ]);
  });
});
