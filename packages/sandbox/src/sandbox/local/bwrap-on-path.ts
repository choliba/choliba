import { commandOnPath } from '@choliba/kernel';

/** The `bwrap` binary on `pathEnv` (or on `PATH`, when omitted), or `undefined` when none of its directories has one. */
export function bwrapOnPath(pathEnv?: string): string | undefined {
  return commandOnPath('bwrap', pathEnv);
}
