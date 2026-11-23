/**
 * Where a round runs: its own folder in `rounds.dir` (choliba.config.ts),
 * outside the project and recreated on every run started from a fixture.
 */

import { requireRounds } from '../config/index';
import { join } from '../filesystem/index';

/** `<rounds.dir>/<id>`; without `rounds.dir`, a `UsageError` saying what to do. */
export function roundDir(id: string): string {
  return join(requireRounds('dir').dir, id);
}
