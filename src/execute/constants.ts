/**
 * Values of execute. A default can be changed where it is used, by the
 * option named; a protocol value is fixed.
 */

/**
 * Two Ctrl+C within this many milliseconds are one keypress
 * (`listenForInterrupt`, option `sameKeypressMs`): under `bun run`, one
 * Ctrl+C arrives twice (the terminal's and the runner's). Half a second is
 * shorter than anyone presses twice on purpose.
 */
export const SAME_KEYPRESS_MS = 500;

/**
 * The most a short helper program may print, in bytes, before it is an error
 * (`runProgram`, option `maxOutputBytes`). Helpers answer in a line or a
 * small JSON; 2 MiB only stops one that went wrong.
 */
export const HELPER_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Milliseconds a program has to end after SIGTERM before SIGKILL
 * (`Executor`, option `killGraceMs`). Enough for a CLI to save its session;
 * short enough that a stuck one does not hold the agent.
 */
export const KILL_GRACE_MS = 2000;

/**
 * Added to a signal's number for the exit code of a program it ended
 * (`runAttached`): 143 for SIGTERM, as a shell reports it. Fixed: protocol.
 */
export const SIGNAL_EXIT_BASE = 128;

/**
 * The code the program ends with on a second Ctrl+C (`listenForInterrupt`):
 * 128 + SIGINT (2), what a shell reports for Ctrl+C. Fixed: protocol.
 */
export const INTERRUPTED_EXIT_CODE = 130;
