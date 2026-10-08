import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { discover } from '../common/nest';
import type { CommandEntry, CommandSpec, HelpContributor, RootSpec } from './interfaces/help.interface';
import { RegisterHelp } from './register-help.decorator';

function isHelpContributor(value: unknown): value is HelpContributor {
  return typeof (value as Partial<HelpContributor> | undefined)?.helpEntries === 'function';
}

/** `read()`, or `fallback` when it throws (a workspace that cannot be read leaves completion quiet). */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/**
 * The app's commands as the root help lists them: every `@RegisterHelp()` command, in the order the app registers
 * them, each asked for its entries every time (they may read the workspace, as `agents` does).
 */
@Injectable()
export class HelpRegistryService {
  constructor(@Inject(DiscoveryService) private readonly discovery: DiscoveryService) {}

  entries(): readonly CommandEntry[] {
    return discover(this.discovery, RegisterHelp, isHelpContributor).flatMap((contributor) =>
      safely(() => contributor.helpEntries(), []),
    );
  }

  /** The whole CLI as one spec: `root` with the registered commands, what `--help` and `__complete` read. */
  spec(root: RootSpec): CommandSpec {
    return { ...root, commands: () => this.entries() };
  }
}
