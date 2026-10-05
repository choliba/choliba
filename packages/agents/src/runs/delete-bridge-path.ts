/**
 * Absolute path of the delete helper of the run in `runDir`: a file next to that folder, not inside it,
 * because the agent may write in the folder it runs in and could otherwise rewrite what it is allowed to run.
 */
export function deleteBridgePath(runDir: string): string {
  return `${runDir}.choliba-delete`;
}
