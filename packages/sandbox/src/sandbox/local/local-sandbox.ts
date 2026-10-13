import { ExpectedError } from '@choliba/core';

import type { DiskFacts } from '../docker/interfaces/container-mounts.interface';
import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from '../interfaces/sandbox-backend.interface';

/** What a local run is planned from: the disk the mounts are read off, and the `bwrap` binary when one was found. */
export interface LocalSandboxOptions {
  readonly disk: DiskFacts;
  readonly bwrap: string | undefined;
}

/**
 * A path rule the local sandbox cannot impose. The command is refused; the session is not. Installing `bwrap`
 * is how the same mounts the container uses get imposed here.
 */
export class SandboxEnforcementError extends ExpectedError {}

const BWRAP_INSTALL =
  'O sandbox local não impõe regra de caminho sem o bwrap. Instale o pacote bubblewrap (no Debian e no Ubuntu: sudo apt install bubblewrap) e confira com `bwrap --version`.';

/**
 * On this machine the command stays as it is while `bwrap` is present and not yet imposing paths. Without `bwrap`,
 * a path rule is refused.
 */
export class LocalSandbox implements SandboxBackend {
  readonly kind = 'local';

  constructor(private readonly options: LocalSandboxOptions) {}

  plan(input: SandboxPlanInput): SandboxPlan {
    if (this.options.bwrap === undefined) throw new SandboxEnforcementError(BWRAP_INSTALL);
    return { command: input.command, place: { kind: 'local' }, paths: [], skipped: [] };
  }
}
