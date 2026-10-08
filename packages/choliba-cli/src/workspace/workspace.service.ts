import { Inject, Injectable } from '@nestjs/common';

import { RUNTIME, type CommandEntry, type HelpContributor, type RootFallback } from '@choliba/core';
import { ConfigService, RegisterHelp, RegisterRootFallback } from '@choliba/core/nest';

import type { CliRuntime } from '../runtime';
import { workspaceAt, workspaceCholiba, workspaceEntries } from './workspace-choliba';

/**
 * The workspace's `choliba` behind this one: a command this one does not have (`agents`, `tests`, `check`,
 * `<agent>`…) runs there, in the version the workspace installed, and the help lists those commands too.
 */
@RegisterRootFallback()
@RegisterHelp()
@Injectable()
export class WorkspaceService implements RootFallback, HelpContributor {
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

  helpEntries(): readonly CommandEntry[] {
    const root = workspaceAt(this.config.startDir());
    return root === undefined ? [] : workspaceEntries(this.runtime, root);
  }
}
