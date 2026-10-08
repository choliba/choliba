import { Inject, Injectable } from '@nestjs/common';

import { type CommandSpec, ENV, STDERR, STDOUT, type Environment, type Writable } from '@choliba/core';
import { ConfigService, ThemeService } from '@choliba/core/nest';
import { listProjectNames, listTicketSuffixes, ticketsFolderPath } from '@choliba/projects';
import { LocationsService } from '@choliba/projects/nest';

import { runTests } from './run-tests';
import { RUNNER_ROOT, TESTS_HOOKS, type TestsHooks } from './tests.constants';
import { testsCliSpec } from './tests-spec';

/** `choliba tests`: the workspace's E2E tests through the runner's Playwright. */
@Injectable()
export class TestsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(LocationsService) private readonly locations: LocationsService,
    @Inject(RUNNER_ROOT) private readonly runnerRoot: string,
    @Inject(ENV) private readonly env: Environment,
    @Inject(STDOUT) private readonly stdout: Writable,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(TESTS_HOOKS) private readonly hooks: TestsHooks,
    @Inject(ThemeService) private readonly theme: ThemeService,
  ) {}

  /** Runs the command line after `choliba tests`; resolves with the exit code. */
  async run(argv: readonly string[]): Promise<number> {
    const result = await runTests({
      argv,
      packageRoot: this.runnerRoot,
      monorepoRoot: this.config.workspaceRoot(),
      // Playwright and the reporter run in a process of their own: without color here, none there either. Said
      // with FORCE_COLOR=0, not NO_COLOR: Playwright sets FORCE_COLOR=1 in its workers, and Node warns in each
      // one that has both.
      env: this.theme.enabled() ? { ...this.env } : { ...this.env, FORCE_COLOR: '0', NO_COLOR: undefined },
      stdout: this.stdout,
      stderr: this.stderr,
      theme: this.theme,
      ...this.hooks,
    });
    return result.exitCode;
  }

  /** `--help` and completion: the projects, and after `project:` its tickets, read from disk on every call. */
  helpSpec(): CommandSpec {
    return testsCliSpec(
      () => this.fromProjects(listProjectNames),
      (project) => this.fromProjects((projectsDir) => listTicketSuffixes(ticketsFolderPath(projectsDir, project))),
    );
  }

  /** What completion reads from CHOL_PROJECTS_DIR; nothing when the workspace's locations cannot be read. */
  private fromProjects(read: (projectsDir: string) => readonly string[]): readonly string[] {
    try {
      return read(this.locations.projectsDir());
    } catch {
      return [];
    }
  }
}
