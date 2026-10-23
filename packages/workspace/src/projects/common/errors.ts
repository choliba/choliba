import { ExpectedError } from '@choliba/kernel';

export class ProjectsError extends ExpectedError {}

/** A command line the command cannot run: what is wrong, said to the person. */
export class UsageError extends ExpectedError {}

/** Rethrows `fn`'s failure as `ProjectsError`, so callers keep catching that class. */
export function wrapProjects<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ProjectsError) throw error;
    throw new ProjectsError((error as Error).message);
  }
}
