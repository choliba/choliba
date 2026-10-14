import type { DiskFacts } from '../mounts/interfaces/container-mounts.interface';
import type { ContainerUser } from '../docker/interfaces/docker-run.interface';

export type SandboxNetwork = 'isolated' | 'host';

/** Where the provider runs: on this machine, or in a container that sees only what the agent may reach. */
export type Sandbox =
  { readonly kind: 'local' } | { readonly kind: 'docker'; readonly image: string; readonly network: SandboxNetwork };

export interface SandboxBackendContext {
  readonly user: () => ContainerUser;
  readonly environment: Readonly<Record<string, string>>;
  readonly disk: DiskFacts;
}
