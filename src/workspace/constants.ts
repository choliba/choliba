/** Values of the workspace. */

/**
 * A Docker workspace's `image` when in doubt, and the example its error
 * shows: Bun's official image, where Choliba and the CLIs run as they do
 * here.
 */
export const DEFAULT_DOCKER_IMAGE = 'FROM oven/bun:latest';

/**
 * Where the agent works in any sandbox: the workspace root is mounted there
 * and it is the working directory. Under `/home`, like a user's home, and
 * the only thing there: the host's homes are never visible.
 */
export const AGENT_ROOT = '/home/choliba';

/** The host's homes: hidden in the sandbox, except what is mounted back elsewhere. */
export const HOST_HOMES = '/home';

/**
 * Where what the sandbox needs from the host's homes is mounted, outside
 * `/home`: the CLI's home (`home`), the tools and caches of the host user's
 * home (`user`) and anything else under `/home` (`host`).
 */
export const SANDBOX_SUPPORT_DIR = '/opt/choliba';
