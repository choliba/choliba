/**
 * Absolute path of the run tool `name` for the run in `runDir`: a file next to that folder, not inside it,
 * because the agent may write in the folder it runs in and could otherwise rewrite what it is allowed to run.
 */
export function runToolPath(runDir: string, name: string): string {
  return `${runDir}.${name}`;
}
