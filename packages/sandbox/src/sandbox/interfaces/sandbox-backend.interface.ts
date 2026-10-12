import type { SandboxPermissions, SandboxPolicy } from '../../common';

/** What a run lets the agent reach, already absolute (`absolutePermissions`). */
export interface SandboxReach {
  readonly permissions: SandboxPermissions;
  readonly policy: SandboxPolicy;
  /** `--add-dir`: read like `allow.read`. */
  readonly addDirs: readonly string[];
  /** Where the provider runs, always writable. */
  readonly runDir: string;
  /** What the session needs to read beyond the permissions: the run tools' scripts, the installed packages. */
  readonly alsoRead: readonly string[];
  /** What the session's commands write beyond the permissions: choliba's own output folders. */
  readonly alsoWrite: readonly string[];
}

export interface SandboxPath {
  readonly path: string;
  readonly access: 'read' | 'write' | 'hidden';
  readonly directory: boolean;
}

/** Where the provider runs, as the run's footer shows it: on this machine, or in a named container of an image. */
export type SandboxPlace =
  { readonly kind: 'local' } | { readonly kind: 'docker'; readonly image: string; readonly container: string };

export interface SandboxPlan {
  readonly command: readonly string[];
  readonly place: SandboxPlace;
  readonly env?: Readonly<Record<string, string>>;
  readonly paths: readonly SandboxPath[];
  readonly skipped: readonly string[];
}

export interface SandboxPlanInput {
  readonly command: readonly string[];
  readonly reach: SandboxReach;
}

export interface SandboxBackend {
  readonly kind: 'local' | 'docker';
  plan(input: SandboxPlanInput): SandboxPlan;
}
