/** Why `choliba run tests` cannot run, said to the person; the command prints the message and exits 1. */
import { ExpectedError } from '@choliba/kernel';

export class TestsError extends ExpectedError {}

export function fail(message: string): never {
  throw new TestsError(message);
}
