import { CHOL_SANDBOX, CHOL_SANDBOX_IMAGE } from '@choliba/core';

/** Where the provider runs: on this machine, or in a container that sees only what the agent may reach. */
export type Sandbox = { readonly kind: 'local' } | { readonly kind: 'docker'; readonly image: string };

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

/** `CHOL_SANDBOX` (`local`, the default, or `docker`) and `CHOL_SANDBOX_IMAGE`; any other value is an error. */
export function readSandbox(config: Readonly<Record<string, string | undefined>>): Sandbox {
  const kind = config[CHOL_SANDBOX] ?? 'local';
  if (kind === 'local') return { kind };
  if (kind === 'docker') return { kind, image: config[CHOL_SANDBOX_IMAGE] ?? DEFAULT_SANDBOX_IMAGE };
  throw new SandboxConfigError(`${CHOL_SANDBOX}="${kind}" não existe: use local ou docker.`);
}

/** The credentials set in `config`, by name. */
export function presentCredentials(config: Readonly<Record<string, string | undefined>>): readonly string[] {
  return SANDBOX_CREDENTIALS.filter((name) => (config[name] ?? '') !== '');
}
