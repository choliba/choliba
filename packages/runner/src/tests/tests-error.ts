/** Why `choliba tests` cannot run, said to the person; the command prints the message and exits 1. */
export class TestsError extends Error {}

export function fail(message: string): never {
  throw new TestsError(message);
}
