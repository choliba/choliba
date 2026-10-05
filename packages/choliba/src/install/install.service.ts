import { Inject, Injectable } from '@nestjs/common';

import { resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '@choliba/agents';
import { ConfigService } from '@choliba/core/nest';
import { GIT, type GitRunner } from '@choliba/core/platform';

import type { Runtime } from '../runtime/interfaces/runtime.interface';
import { RUNTIME } from '../runtime/runtime.constants';
import { install, parseInstallArgs } from './install';

/** `choliba install <origem>`: an agent (with its skills and MCPs), a skill or an MCP, into the workspace. */
@Injectable()
export class InstallService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: Runtime,
    @Inject(GIT) private readonly git: GitRunner,
  ) {}

  /** What was installed (or, with --dry-run, would be); throws `InstallError` saying what is wrong. */
  install(args: readonly string[]): string {
    const workspaceRoot = this.config.workspaceRoot();
    const config = this.config.load(workspaceRoot);
    return install(parseInstallArgs(args), {
      workspaceRoot,
      config,
      targets: {
        agentsDir: resolveAgentsDir(undefined, config, workspaceRoot),
        skillsDir: resolveSkillsDir(config, workspaceRoot),
        mcpsDir: resolveMcpsDir(config, workspaceRoot),
      },
      source: {
        cwd: this.config.startDir(),
        git: this.git,
        bunAdd: (project, spec) => this.runtime.capture('bun', ['add', spec], project),
      },
    });
  }
}
