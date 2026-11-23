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

/**
 * The system's program folders, emptied in a sandbox that shows only the
 * selected programs (`programs`). `/bin` and `/sbin` count once when they are
 * links to the `/usr` ones.
 */
export const STANDARD_PROGRAM_DIRS: readonly string[] = [
  '/usr/bin',
  '/usr/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/bin',
  '/sbin',
];

/** The program folders of the user's home, relative to it: emptied too. */
export const USER_PROGRAM_DIRS: readonly string[] = ['.local/bin', '.bun/bin'];

/**
 * What a sandbox with `programs` always shows, selected or not: what
 * Choliba itself runs inside it (`env` before the CLI, `cat` keeping the
 * bubblewrap jail up) and the shell the CLIs run commands with. Choliba's
 * runtime comes too, by its own path. Nothing else: the rest is the user's
 * choice.
 */
export const BASE_PROGRAMS: readonly string[] = ['env', 'cat', 'sh', 'bash'];

/** Besides `BASE_PROGRAMS`, in a Docker sandbox: it drops root after `chroot`. */
export const DOCKER_BASE_PROGRAMS: readonly string[] = ['setpriv'];
