import { ExpectedError } from '@choliba/core';

import type { DiskFacts } from '../mounts/interfaces/container-mounts.interface';
import { containerMounts } from '../mounts/container-mounts';
import type {
  SandboxBackend,
  SandboxPlan,
  SandboxPlanInput,
  SandboxProgram,
} from '../interfaces/sandbox-backend.interface';
import { bwrapCommand } from './bwrap-command';

/** What a local run is planned from: the disk the mounts are read off, and the `bwrap` binary when one was found. */
export interface LocalSandboxOptions {
  readonly disk: DiskFacts;
  readonly bwrap: string | undefined;
  readonly environment: Readonly<Record<string, string>>;
  /** The folder of the resolver configuration under `/run` (`resolverFolder`); absent when there is none. */
  readonly resolver?: string | undefined;
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

function requiredValue(value: string | undefined, message: string): string {
  if (value) return value;
  throw new SandboxEnforcementError(message);
}

function requireProgram(input: SandboxPlanInput, disk: DiskFacts): SandboxProgram {
  const program = input.program;
  if (program === undefined) {
    throw new SandboxEnforcementError(`O provider local não foi encontrado: ${input.command[0] ?? 'comando vazio'}.`);
  }
  const missing = program.readOnly.find((path) => !disk.exists(path));
  if (missing === undefined && disk.exists(program.executable)) return program;
  throw new SandboxEnforcementError(`O provider local não foi encontrado: ${input.command[0] ?? 'comando vazio'}.`);
}

function requireCredential(program: SandboxProgram, environment: Readonly<Record<string, string>>): void {
  const present = program.credentials.some((name) => (environment[name] ?? '') !== '');
  if (present) return;
  throw new SandboxEnforcementError(program.credentialHelp);
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
    const home = requiredValue(this.options.environment['HOME'], 'O sandbox local precisa da variável HOME definida.');
    const program = requireProgram(input, this.options.disk);
    const environment = { ...this.options.environment, ...input.variables };
    requireCredential(program, environment);
    const { mounts, skipped } = containerMounts(input.reach, this.options.disk);
    const [, ...args] = input.command;
    return {
      command: bwrapCommand({
        bwrap,
        home,
        resolver: this.options.resolver,
        programReadOnly: program.readOnly,
        mounts,
        cwd: input.reach.runDir,
        command: [program.executable, ...args],
      }),
      env: environment,
      place: { kind: 'local' },
      paths: mounts,
      skipped,
    };
  }
}
