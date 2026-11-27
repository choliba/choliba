/** Defaults of the approvals. */

/**
 * Milliseconds after which a gate directory with no owner yet is abandoned
 * and removed (`cleanAbandonedGates`, argument `unownedGraceMs`). A gate
 * being created gets its owner in milliseconds; a minute only removes one
 * left behind.
 */
export const UNOWNED_GRACE_MS = 60_000;

/**
 * The narrowest the COMMAND column of the approvals table gets, in columns
 * (`ApprovalReview`, option `minCommandWidth`), however narrow the line.
 */
export const MIN_COMMAND_WIDTH = 20;

/**
 * How long the hook inside the sandbox waits for an answer, in
 * milliseconds. Fixed, and paired with `HOOK_TIMEOUT_SECONDS`: a person may
 * take long to answer, but the hook must give up (denying) before the CLI
 * kills it, so it has the last word.
 */
export const HOOK_WAIT_MS = 55 * 60 * 1000;

/**
 * How long the CLI (Claude Code, Codex) lets the hook run, in seconds.
 * Fixed: it must stay above `HOOK_WAIT_MS`.
 */
export const HOOK_TIMEOUT_SECONDS = 3600;

/**
 * The folder of Choliba's cache with a gate per running agent (its hook and
 * its owner). Gates only, so what a dead run left behind is found and
 * removed without looking at anything else.
 */
export const GATE_CACHE_DIR = 'gate';
