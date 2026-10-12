import type { SandboxNetwork } from '../../interfaces/sandbox.interface';
import type { DiskFacts } from './container-mounts.interface';
import type { ContainerUser } from './docker-run.interface';

export interface DockerSandboxOptions {
  readonly image: string;
  readonly network: SandboxNetwork;
  readonly user: ContainerUser;
  readonly credentialNames: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly disk: DiskFacts;
}
