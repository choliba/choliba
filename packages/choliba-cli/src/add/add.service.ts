import { Inject, Injectable } from '@nestjs/common';

import { install, parseInstallArgs, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '@choliba/agents';
import { ConfigService } from '@choliba/core/nest';
import { GIT, loadRepoConfig, RUNTIME, type GitRunner } from '@choliba/core';

import type { CliRuntime } from '../runtime';

/** `choliba add <origem>`: an agent (with its skills and MCPs), a skill or an MCP, into a workspace. */
@Injectable()
export class AddService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
    @Inject(GIT) private readonly git: GitRunner,
  ) {}

  /** Into the workspace the command runs in; what was installed (or, with --dry-run, would be). */
  add(args: readonly string[]): string {
    return this.addTo(this.config.workspaceRoot(), this.config.startDir(), args);
  }

  /**
   * Into the workspace at `workspaceRoot`, a relative local source counting from `cwd` (`choliba new` installs the
   * agents of the workspace it has just made). Throws `InstallError` saying what is wrong.
   */
  addTo(workspaceRoot: string, cwd: string, args: readonly string[]): string {
    const config = loadRepoConfig(workspaceRoot);
    return install(parseInstallArgs(args), {
      workspaceRoot,
      config,
      targets: {
        agentsDir: resolveAgentsDir(undefined, config, workspaceRoot),
        skillsDir: resolveSkillsDir(config, workspaceRoot),
        mcpsDir: resolveMcpsDir(config, workspaceRoot),
      },
      source: {
        cwd,
        git: this.git,
        bunAdd: (project, spec) => this.runtime.capture('bun', ['add', spec], project),
      },
    });
  }
}
