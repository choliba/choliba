import { Inject, Injectable } from '@nestjs/common';

import type { CommandEntry, CommandSpec } from '@choliba/core/cli';
import { AgentsService } from '@choliba/agents/nest';
import { ProjectsService } from '@choliba/projects/nest';
import { TestsService } from '@choliba/runner/nest';

import { CHOLIBA_HELP, COMMANDS } from './app.help';

/** `read()`, or `fallback` when the workspace cannot be read (completion stays quiet outside one). */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** The help of the whole app as one spec: what `__complete` and `__describe` walk. */
@Injectable()
export class AppHelpService {
  constructor(
    @Inject(AgentsService) private readonly agents: AgentsService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(TestsService) private readonly tests: TestsService,
  ) {}

  /**
   * Every command, `agents`, `projects` and `tests` with the spec each builds from the workspace now, then the
   * agents themselves, the `choliba <agent>` shortcuts.
   */
  spec(): CommandSpec {
    return { ...CHOLIBA_HELP, commands: () => [...this.commands(), ...this.agentShortcuts()] };
  }

  private commands(): readonly CommandEntry[] {
    const live: Readonly<Record<string, () => CommandSpec>> = {
      agents: () => this.agents.helpSpec(),
      projects: () => this.projects.helpSpec(),
      tests: () => this.tests.helpSpec(),
    };
    return COMMANDS.map((entry) => {
      const read = live[entry.name];
      return read === undefined ? entry : { ...entry, spec: safely(read, entry.spec) };
    });
  }

  private agentShortcuts(): readonly CommandEntry[] {
    return safely(
      () =>
        (this.agents.helpSpec().commands?.() ?? [])
          .filter((entry) => entry.group === 'Agents')
          .map((entry) => ({ ...entry, asFlag: false })),
      [],
    );
  }
}
