/** Values of the filesystem. */

/**
 * Permissions of a folder only its owner reads, writes and enters. Fixed:
 * what Choliba keeps for itself (the log, the gate and its approvals, the
 * tools' server, the network's sockets, the locks, a workspace's home) may
 * hold commands, answers and credentials, and no option should open it to
 * the other users of the machine.
 */
export const PRIVATE_DIR_MODE = 0o700;

/** Permissions of a file only its owner reads and writes. Fixed, for the same reason. */
export const PRIVATE_FILE_MODE = 0o600;

/**
 * Where each XDG base directory is when its variable is unset or empty,
 * relative to the home (`xdgDir`): the defaults of the XDG Base Directory
 * specification, which the CLIs and Choliba's own cache follow. Fixed:
 * protocol.
 */
export const XDG_DEFAULTS = {
  XDG_CONFIG_HOME: '.config',
  XDG_CACHE_HOME: '.cache',
  XDG_DATA_HOME: '.local/share',
} as const;

/**
 * Choliba's folder in the cache directory (`cholibaCacheDir`): named after
 * it, as every program's folder there is, so a person knows whose it is.
 */
export const CHOLIBA_CACHE_NAME = 'choliba';
