/** Defaults of the agent. */

/**
 * How often, in milliseconds, an agent waiting on approvals looks for new
 * ones (`Agent`, option `approvalPollMs`).
 */
export const APPROVAL_POLL_MS = 1000;

/**
 * Milliseconds between the `thinking` events while the model is silent
 * (`Agent`, option `thinkingTickMs`): a listener knows the agent is alive
 * without being flooded.
 */
export const THINKING_TICK_MS = 2000;

/**
 * The folder of Choliba's cache (`cholibaCacheDir`) with each workspace's
 * lock (`WorkspaceLock`, `<hash of the root>.json`): named after what a lock
 * tells, the agent that runs there and since when.
 */
export const LOCK_CACHE_DIR = 'agents';
