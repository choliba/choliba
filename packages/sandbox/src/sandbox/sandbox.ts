import { ExpectedError } from '@choliba/core';

const CHOL_NETWORK = 'CHOL_NETWORK';
const CHOL_SANDBOX = 'CHOL_SANDBOX';
const CHOL_SANDBOX_IMAGE = 'CHOL_SANDBOX_IMAGE';

import { DockerSandbox } from './docker/docker-sandbox';
import { bwrapOnPath } from './local/bwrap-on-path';
import { resolverFolder } from './local/resolver-folder';
import { LocalSandbox } from './local/local-sandbox';
import type { SandboxBackend } from './interfaces/sandbox-backend.interface';
import type { Sandbox, SandboxBackendContext, SandboxNetwork } from './interfaces/sandbox.interface';

/** The image `CHOL_SANDBOX=docker` runs without `CHOL_SANDBOX_IMAGE`: the one `docker/agent.Dockerfile` builds. */
export const DEFAULT_SANDBOX_IMAGE = 'choliba-agent';

/**
 * The provider's credentials, passed into the container by name when they are set: Claude Code's token from
 * `claude setup-token` or an API key, and Cursor's API key. The agent can read them there, as it can on this machine.
 */
export const SANDBOX_CREDENTIALS: readonly string[] = [
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CURSOR_API_KEY',
];

export class SandboxConfigError extends ExpectedError {}

function readNetwork(config: Readonly<Record<string, string | undefined>>): SandboxNetwork {
  const network = config[CHOL_NETWORK] ?? 'isolated';
  if (network === 'isolated' || network === 'host') return network;
  throw new SandboxConfigError(`${CHOL_NETWORK}="${network}" não existe: use isolated ou host.`);
}

/** Reads the sandbox, image and Docker network; any unsupported value is an error. */
export function readSandbox(config: Readonly<Record<string, string | undefined>>): Sandbox {
  const kind = config[CHOL_SANDBOX] ?? 'local';
  if (kind === 'local') return { kind };
  if (kind === 'docker') {
    return { kind, image: config[CHOL_SANDBOX_IMAGE] ?? DEFAULT_SANDBOX_IMAGE, network: readNetwork(config) };
  }
  throw new SandboxConfigError(`${CHOL_SANDBOX}="${kind}" não existe: use local ou docker.`);
}

/** The scheme and any `user@` of a URL, then a host that names this machine, which the container reaches by another name. */
const LOOPBACK_HOST = /^([a-z][a-z\d+.-]*:\/\/(?:[^@/?#]*@)?)(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?=[:/?#]|$)/i;

/** The name a container on Docker's isolated network gives this machine (`--add-host host.docker.internal:host-gateway`). */
export const CONTAINER_HOST_NAME = 'host.docker.internal';

/**
 * `url` as the agent reaches it. In a container on the isolated network, `localhost` is the container itself, so a host
 * that names this machine (`localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`) becomes `host.docker.internal`, with the rest
 * of the URL as is. On this machine or on the host network, and for any other host, `url` is unchanged.
 */
export function agentURL(url: string, sandbox: Sandbox): string {
  if (sandbox.kind === 'local' || sandbox.network === 'host') return url;
  return url.replace(LOOPBACK_HOST, `$1${CONTAINER_HOST_NAME}`);
}

/** The credentials set in `config`, by name. */
export function presentCredentials(config: Readonly<Record<string, string | undefined>>): readonly string[] {
  return SANDBOX_CREDENTIALS.filter((name) => (config[name] ?? '') !== '');
}

export function createSandboxBackend(sandbox: Sandbox, context: SandboxBackendContext): SandboxBackend {
  if (sandbox.kind === 'local') {
    return new LocalSandbox({
      disk: context.disk,
      bwrap: bwrapOnPath(),
      environment: context.environment,
      resolver: resolverFolder(),
    });
  }
  return new DockerSandbox({
    image: sandbox.image,
    network: sandbox.network,
    user: context.user(),
    credentialNames: presentCredentials(context.environment),
    environment: context.environment,
    disk: context.disk,
  });
}
