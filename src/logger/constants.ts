/** Defaults of the logger. */

/**
 * Characters of an error's text kept in the log (`truncateError`, argument
 * `maxLength`): stack traces and npm logs can be huge; the head says what
 * went wrong.
 */
export const MAX_ERROR_LENGTH = 4000;

/**
 * Names of environment variables whose value is a secret, hidden wherever
 * it appears (`envSecrets`): in the log, the config's envs; in a round's
 * record, the whole environment. Broad on purpose: hiding a value that was
 * not a secret costs a placeholder in the text, and missing one leaks it.
 */
export const SECRET_ENV_NAME = /key|token|secret|pass|auth|credential|cookie/i;

/**
 * The shortest value of such a variable that is hidden (`envSecrets`,
 * argument `minSecretLength`). Shorter values (`1`, `true`) would hide
 * unrelated text.
 */
export const MIN_SECRET_LENGTH = 8;

/**
 * `logger.logrotate.maxFileSize`, a size with its unit (src/logger/size.ts):
 * past it, the session goes on in a new file (`<sessão>.2.jsonl`). A soft
 * limit: the record being written ends where it is, so a file can pass it
 * by one record. 20 MB is hours of a debug session and still opens in an
 * editor.
 */
export const LOGROTATE_MAX_FILE_SIZE = '20mb';

/**
 * `logger.logrotate.days`: sessions older than this, in days, are deleted
 * when a new one opens. Two weeks keeps what is still being looked into.
 */
export const LOGROTATE_DAYS = 14;

/**
 * `logger.logrotate.maxTotalSize`, a size with its unit: past it, the
 * oldest sessions are deleted until the folder fits. 200 MB is ten full
 * files.
 */
export const LOGROTATE_MAX_TOTAL_SIZE = '200mb';

/**
 * `logger.logrotate.compress`: whether ended sessions become `.jsonl.gz`.
 * Off by default: the logs are read in an editor and with grep.
 */
export const LOGROTATE_COMPRESS = false;
