import type { SandboxReach } from './container-mounts';

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
