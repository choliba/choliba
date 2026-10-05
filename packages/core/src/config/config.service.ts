import { Inject, Injectable } from '@nestjs/common';

import type { Environment } from '../platform/interfaces/platform.interface';
import { CWD, ENV } from '../platform/platform.constants';
import { loadRepoConfig, type RepoConfig } from './repo-config';
import { findWorkspaceRoot } from './workspace';

/** The workspace a command runs in and its configuration, read from where the process started. */
@Injectable()
export class ConfigService {
  constructor(
    @Inject(CWD) private readonly cwd: string,
    @Inject(ENV) private readonly env: Environment,
  ) {}

  /** The workspace root; throws `WorkspaceNotFoundError` (with how to make one) outside a workspace. */
  workspaceRoot(): string {
    return findWorkspaceRoot(this.cwd);
  }

  /** The workspace root, or `undefined` outside one: for what must stay quiet there, like completion. */
  workspaceRootOrNothing(): string | undefined {
    try {
      return this.workspaceRoot();
    } catch {
      return undefined;
    }
  }

  /** The configuration of the workspace at `root` (`.env`, then the process environment on top). */
  load(root: string): RepoConfig {
    return loadRepoConfig(root, this.env);
  }

  /** The folder the process started in. */
  startDir(): string {
    return this.cwd;
  }
}
