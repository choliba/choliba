/** Values of the filesystem. */

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
