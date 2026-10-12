import type { SandboxReach } from './container-mounts';

export interface SandboxPath {
  readonly path: string;
  readonly access: 'read' | 'write' | 'hidden';
  readonly directory: boolean;
}

export interface SandboxPlan {
  readonly command: readonly string[];
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
