import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { envSource } from '@choliba/config';

import {
  containerName,
  dockerRunArgs,
  DockerSandbox,
  agentURL,
  DEFAULT_SANDBOX_IMAGE,
  presentCredentials,
  readSandbox,
  sandboxConfig,
  SandboxConfigError,
} from '../../index';

describe('readSandbox', () => {
  it('is local by default, and docker with the default image or CHOL_SANDBOX_IMAGE', () => {
    expect(readSandbox({})).toEqual({ kind: 'local' });
    expect(readSandbox({ CHOL_SANDBOX: 'local' })).toEqual({ kind: 'local' });
    expect(readSandbox({ CHOL_SANDBOX: 'docker' })).toEqual({
      kind: 'docker',
      image: DEFAULT_SANDBOX_IMAGE,
      network: 'isolated',
    });
    expect(readSandbox({ CHOL_SANDBOX: 'docker', CHOL_SANDBOX_IMAGE: 'minha:1' })).toEqual({
      kind: 'docker',
      image: 'minha:1',
      network: 'isolated',
    });
    expect(readSandbox({ CHOL_SANDBOX: 'docker', CHOL_NETWORK: 'host' })).toEqual({
      kind: 'docker',
      image: DEFAULT_SANDBOX_IMAGE,
      network: 'host',
    });
  });

  it('refuses any other value, naming the ones it takes', () => {
    expect(() => readSandbox({ CHOL_SANDBOX: 'podman' })).toThrow(SandboxConfigError);
    expect(() => readSandbox({ CHOL_SANDBOX: 'podman' })).toThrow('use local ou docker');
    expect(() => readSandbox({ CHOL_SANDBOX: 'docker', CHOL_NETWORK: 'lan' })).toThrow(SandboxConfigError);
    expect(() => readSandbox({ CHOL_SANDBOX: 'docker', CHOL_NETWORK: 'lan' })).toThrow('use isolated ou host');
  });
});

describe('agentURL', () => {
  const isolated = { kind: 'docker', image: DEFAULT_SANDBOX_IMAGE, network: 'isolated' } as const;

  it("gives a container on the isolated network the machine's name for a local host, keeping the rest", () => {
    expect(agentURL('http://localhost:3000/a?b=1', isolated)).toBe('http://host.docker.internal:3000/a?b=1');
    expect(agentURL('http://127.0.0.1:3000', isolated)).toBe('http://host.docker.internal:3000');
    expect(agentURL('http://[::1]:3000/', isolated)).toBe('http://host.docker.internal:3000/');
    expect(agentURL('https://0.0.0.0', isolated)).toBe('https://host.docker.internal');
    expect(agentURL('http://user:pw@LOCALHOST:8931/mcp', isolated)).toBe(
      'http://user:pw@host.docker.internal:8931/mcp',
    );
  });

  it('leaves any other host, and every URL on this machine or on the host network, as it is', () => {
    expect(agentURL('https://exemplo.com', isolated)).toBe('https://exemplo.com');
    expect(agentURL('http://localhost.exemplo.com', isolated)).toBe('http://localhost.exemplo.com');
    expect(agentURL('http://exemplo.com/?next=http://localhost', isolated)).toBe(
      'http://exemplo.com/?next=http://localhost',
    );
    expect(agentURL('http://localhost:3000', { kind: 'local' })).toBe('http://localhost:3000');
    expect(agentURL('http://localhost:3000', { ...isolated, network: 'host' })).toBe('http://localhost:3000');
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
    name: 'choliba-1',
    mounts: [
      { path: '/w', access: 'read', directory: true },
      { path: '/w/a,b', access: 'write', directory: true },
      { path: '/w/segredo', access: 'hidden', directory: true },
      { path: '/w/.env', access: 'hidden', directory: false },
    ],
    cwd: '/w/.cache/runs/1',
    user: { uid: 1000, gid: 1001 },
    env: ['CLAUDE_CODE_OAUTH_TOKEN'],
    network: 'isolated',
    command: ['claude', '-p', 'oi'],
  });

  it('runs as the owner, on a bridge with a host alias, read-only, without capabilities, with the command last', () => {
    expect(args.slice(0, 2)).toEqual(['docker', 'run']);
    expect(args).toEqual(expect.arrayContaining(['--rm', '-i', '--init', '--read-only']));
    expect(args.slice(2, 5)).toEqual(['--rm', '--name', 'choliba-1']);
    expect(args.join(' ')).toContain('--user 1000:1001');
    expect(args.join(' ')).toContain('--network bridge');
    expect(args.join(' ')).toContain('--add-host host.docker.internal:host-gateway');
    expect(args.join(' ')).toContain('--cap-drop ALL');
    expect(args.join(' ')).toContain('--security-opt no-new-privileges');
    expect(args.join(' ')).toContain('--env HOME=/home/choliba');
    expect(args.join(' ')).toContain('--env PLAYWRIGHT_MCP_SANDBOX=false');
    expect(args.join(' ')).toContain('--env CLAUDE_CODE_OAUTH_TOKEN --mount');
    expect(args.slice(-5)).toEqual(['/w/.cache/runs/1', 'choliba-agent', 'claude', '-p', 'oi']);
    expect(args.join(' ')).not.toContain('docker.sock');
  });

  it('keeps the host network only when explicitly requested', () => {
    const hostArgs = dockerRunArgs({
      image: 'choliba-agent',
      name: 'choliba-1',
      mounts: [],
      cwd: '/w',
      user: { uid: 1000, gid: 1000 },
      env: [],
      network: 'host',
      command: ['claude'],
    });

    expect(hostArgs.join(' ')).toContain('--network host');
    expect(hostArgs.join(' ')).not.toContain('--add-host');
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

describe('the agent image', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..', '..');
  const dockerfile = readFileSync(join(ROOT, 'docker', 'agent.Dockerfile'), 'utf8');

  it('is built on the Playwright version every package pins, so its browsers are the ones that version expects', () => {
    const image = /^ARG PLAYWRIGHT_VERSION=(.+)$/m.exec(dockerfile)?.[1];
    const pinned = ['choliba', 'runner'].map((pkg) => {
      const manifest = JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8')) as Readonly<
        Record<'dependencies' | 'devDependencies', Readonly<Record<string, string>> | undefined>
      >;
      return { ...manifest.devDependencies, ...manifest.dependencies }['@playwright/test'];
    });
    expect(pinned).toEqual([image, image]);
  });

  it('runs no downloaded script, and installs the Cursor CLI of a pinned version checked against its sha256', () => {
    const commands = dockerfile.replace(/\\\n/g, ' ');
    expect(commands).not.toMatch(/\bcurl\b[^\n]*\|[^\n]*\b(ba|z)?sh\b/);
    expect(commands).toMatch(/^ARG CURSOR_VERSION=\d{4}\.\d{2}\.\d{2}-[0-9a-f]+$/m);
    expect(commands).toMatch(/^ARG CURSOR_SHA256_X64=[0-9a-f]{64}$/m);
    expect(commands).toMatch(/^ARG CURSOR_SHA256_ARM64=[0-9a-f]{64}$/m);
    expect(commands).toContain('sha256sum -c -');
  });

  it('installs the Codex CLI at the version covered by the provider fixtures', () => {
    expect(dockerfile).toContain('ARG CODEX_VERSION=0.163.0');
    expect(dockerfile).toContain('npm install -g "@openai/codex@${CODEX_VERSION}"');
  });
});

describe('containerName', () => {
  it('is choliba- and the run folder, with only the characters Docker takes', () => {
    expect(containerName('/w/.cache/runs/2026-10-12T05-53-29.739Z-383691')).toBe(
      'choliba-2026-10-12T05-53-29.739Z-383691',
    );
    expect(containerName('/w/runs/a b:c')).toBe('choliba-a-b-c');
  });
});

describe('DockerSandbox', () => {
  it("passes the provider's own variables into the container by name, over the inherited ones", () => {
    const sandbox = new DockerSandbox({
      image: 'choliba-agent',
      network: 'isolated',
      user: { uid: 1000, gid: 1000 },
      credentialNames: ['CLAUDE_CODE_OAUTH_TOKEN'],
      environment: { CLAUDE_CODE_OAUTH_TOKEN: 'segredo', PATH: '/usr/bin' },
      disk: { exists: () => false, isDirectory: () => false, read: () => [] },
    });
    const reach = {
      permissions: { allowRead: [], allowWrite: [], allowExecute: [], denyRead: [], denyWrite: [] },
      policy: 'edits',
      addDirs: [],
      runDir: '/w/.cache/runs/1',
      alsoRead: [],
      alsoWrite: [],
    } as const;

    const plan = sandbox.plan({
      command: ['claude'],
      reach,
      variables: { CLAUDE_CODE_OAUTH_TOKEN: '', ANTHROPIC_BASE_URL: 'http://host.docker.internal:11434' },
    });
    const passed = plan.command.flatMap((arg, index) => (plan.command[index - 1] === '--env' ? [arg] : []));
    expect(passed).toEqual([
      'HOME=/home/choliba',
      'PLAYWRIGHT_MCP_SANDBOX=false',
      'CLAUDE_CODE_OAUTH_TOKEN',
      'ANTHROPIC_BASE_URL',
    ]);
    expect(plan.env).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: '',
      PATH: '/usr/bin',
      ANTHROPIC_BASE_URL: 'http://host.docker.internal:11434',
    });
  });
});

describe('sandboxConfig', () => {
  it("declares the sandbox's own defaults", () => {
    expect(sandboxConfig.read([envSource({})])).toEqual({
      mode: readSandbox({}).kind,
      image: DEFAULT_SANDBOX_IMAGE,
      network: 'isolated',
    });
  });

  it('only accepts supported modes and networks', () => {
    expect(() => sandboxConfig.read([envSource({ CHOL_SANDBOX: 'podman' })])).toThrow('CHOL_SANDBOX');
    expect(() => sandboxConfig.read([envSource({ CHOL_NETWORK: 'lan' })])).toThrow('CHOL_NETWORK');
  });
});
