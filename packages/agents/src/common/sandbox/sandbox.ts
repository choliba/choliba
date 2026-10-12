import { CHOL_NETWORK, CHOL_SANDBOX, CHOL_SANDBOX_IMAGE } from '@choliba/core';

export type SandboxNetwork = 'isolated' | 'host';

/** Where the provider runs: on this machine, or in a container that sees only what the agent may reach. */
export type Sandbox =
  { readonly kind: 'local' } | { readonly kind: 'docker'; readonly image: string; readonly network: SandboxNetwork };

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

export class SandboxConfigError extends Error {}

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

/** The credentials set in `config`, by name. */
export function presentCredentials(config: Readonly<Record<string, string | undefined>>): readonly string[] {
  return SANDBOX_CREDENTIALS.filter((name) => (config[name] ?? '') !== '');
}
