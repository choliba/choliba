/**
 * Absolute path of the run tool `name` for the run in `runDir`: a file next to that folder, not inside it,
 * because the agent may write in the folder it runs in and could otherwise rewrite what it is allowed to run.
 */
export function runToolPath(runDir: string, name: string): string {
  return `${runDir}.${name}`;
}

/**
 * The folder of the run tools' shortcuts: one per tool, named after it (`ask`), which runs its script. It sits next to
 * the run folder, like the scripts, and goes first on the session's `PATH`, so a tool called by its name alone still
 * runs.
 */
export function runToolShortcuts(runDir: string): string {
  return `${runDir}.bin`;
}
