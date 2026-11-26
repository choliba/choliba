/**
 * The helpers that run where the project is not mounted (the gate's hook,
 * the MCP server, the network bridge, inside the sandbox), each bundled into
 * one file with what it imports. One place builds them, so one place says
 * why a build failed.
 */

import { UsageError } from '../errors';

export interface BundleHelperOptions {
  /** The helper's entry, a path (`besideModule(import.meta.url, './x.ts')`). */
  readonly entry: string;
  /** Where the bundled file goes. */
  readonly dir: string;
  /** Its name in `dir`. */
  readonly file: string;
  /** What it is, for the error: `o hook de execução`. */
  readonly what: string;
}

/**
 * Bundles `entry` and what it imports into `dir/file`, a program for Bun. A
 * build that fails is a `UsageError` that says what and why: with
 * `throw: false`, since by default Bun throws an `AggregateError` that says
 * neither.
 */
export async function bundleHelper({
  entry,
  dir,
  file,
  what,
}: BundleHelperOptions): Promise<void> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: dir,
    naming: file,
    target: 'bun',
    throw: false,
  });
  if (!result.success) {
    throw new UsageError(
      `Não foi possível preparar ${what}: ${result.logs.map(String).join('; ')}`,
    );
  }
}
