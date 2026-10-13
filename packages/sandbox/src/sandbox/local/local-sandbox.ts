import { ExpectedError } from '@choliba/core';

import type { DiskFacts } from '../mounts/interfaces/container-mounts.interface';
import { containerMounts } from '../mounts/container-mounts';
import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from '../interfaces/sandbox-backend.interface';
import { bwrapCommand } from './bwrap-command';

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

function requireBwrap(bwrap: string | undefined): string {
  if (bwrap !== undefined) return bwrap;
  throw new SandboxEnforcementError(BWRAP_INSTALL);
}

/**
 * The provider on this machine, inside `bwrap`, seeing the same coarse paths the container mounts: nothing,
 * read-only, writable or hidden. Without `bwrap`, the command is refused.
 */
export class LocalSandbox implements SandboxBackend {
  readonly kind = 'local';

  constructor(private readonly options: LocalSandboxOptions) {}

  plan(input: SandboxPlanInput): SandboxPlan {
    const bwrap = requireBwrap(this.options.bwrap);
    const { mounts, skipped } = containerMounts(input.reach, this.options.disk);
    return {
      command: bwrapCommand({ bwrap, mounts, cwd: input.reach.runDir, command: input.command }),
      place: { kind: 'local' },
      paths: mounts,
      skipped,
    };
  }
}
