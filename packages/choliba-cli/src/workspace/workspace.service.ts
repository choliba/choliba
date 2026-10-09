import { Inject, Injectable } from '@nestjs/common';

import { RUNTIME, type CommandEntry, type HelpContributor, type RootFallback } from '@choliba/core';
import { ConfigService, RegisterHelp, RegisterRootFallback } from '@choliba/core/nest';

import type { CliRuntime } from '../runtime';
import { workspaceAt, workspaceCholiba, workspaceCommandEntries } from './workspace-choliba';

/**
 * Nest keeps one discovery key per class (`DiscoverableMetaHostCollection` is a map of class → key).
 * Help and the unknown-command fallback are therefore two classes: one class wearing both
 * `@RegisterHelp()` and `@RegisterRootFallback()` is found as only one of them.
 */

/** Lists the workspace's commands in this `--help` and `__complete`. */
@RegisterHelp()
@Injectable()
export class WorkspaceHelp implements HelpContributor {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
  ) {}

  helpEntries(): readonly CommandEntry[] {
    return workspaceCommandEntries(this.runtime, this.config.startDir());
  }
}

/**
 * The workspace's `choliba` behind this one: a command this one does not have (`agents`, `tests`, `check`,
 * `<agent>`…) runs there, in the version the workspace installed.
 */
@RegisterRootFallback()
@Injectable()
export class WorkspaceService implements RootFallback {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
  ) {}

  runUnknown(argv: readonly string[]): Promise<number> {
    const start = this.config.startDir();
    const root = workspaceAt(start);
    if (root === undefined) {
      return Promise.reject(
        new Error(`${start} não está numa pasta de trabalho do choliba: crie uma com \`choliba new\` ou entre numa.`),
      );
    }
    return Promise.resolve(this.runtime.exec(workspaceCholiba(root), argv, start));
  }
}
