import type { CommandSpec, ConfigService, Platform, ThemeService } from '@choliba/core';
import { listProjectNames, listTicketSuffixes, resolveLocations, ticketsFolderPath } from '@choliba/projects';

import { runTests, type RunTestsOptions } from './run-tests';
import { testsCliSpec } from './tests-spec';

/** The parts of a run specs replace: how Playwright starts, the report prompt, and whether stdin is a terminal. */
export type TestsHooks = Pick<
  RunTestsOptions,
  'spawnPlaywright' | 'promptOpenReport' | 'openHtmlReport' | 'stdinIsTTY'
>;

/** What `choliba tests` reads from the process: the environment and where it writes. */
export type TestsPlatform = Pick<Platform, 'env' | 'stdout' | 'stderr'>;

/** `choliba tests`: the workspace's E2E tests through the runner's Playwright. */
export class TestsService {
  constructor(
    private readonly config: ConfigService,
    /** The folder with the runner's Playwright config: looked for only when the tests run, not for the help. */
    private readonly runnerRoot: () => string,
    private readonly platform: TestsPlatform,
    private readonly hooks: TestsHooks,
    private readonly theme: ThemeService,
  ) {}

  /** Runs the command line after `choliba tests`; resolves with the exit code. */
  async run(argv: readonly string[]): Promise<number> {
    const { env, stdout, stderr } = this.platform;
    const result = await runTests({
      argv,
      packageRoot: this.runnerRoot(),
      monorepoRoot: this.config.workspaceRoot(),
      // Playwright and the reporter run in a process of their own: without color here, none there either. Said
      // with FORCE_COLOR=0, not NO_COLOR: Playwright sets FORCE_COLOR=1 in its workers, and Node warns in each
      // one that has both.
      env: this.theme.enabled() ? { ...env } : { ...env, FORCE_COLOR: '0', NO_COLOR: undefined },
      stdout,
      stderr,
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
      return read(resolveLocations(this.config.workspaceRoot(), this.platform.env).CHOL_PROJECTS_DIR);
    } catch {
      return [];
    }
  }
}
