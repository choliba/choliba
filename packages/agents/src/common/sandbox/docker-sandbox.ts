import { containerMounts, type DiskFacts } from './container-mounts';
import { dockerRunArgs, type ContainerUser } from './docker-run';
import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from './sandbox-backend';
import type { SandboxNetwork } from './sandbox';

export interface DockerSandboxOptions {
  readonly image: string;
  readonly network: SandboxNetwork;
  readonly user: ContainerUser;
  readonly credentialNames: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly disk: DiskFacts;
}

export class DockerSandbox implements SandboxBackend {
  readonly kind = 'docker';

  constructor(private readonly options: DockerSandboxOptions) {}

  plan(input: SandboxPlanInput): SandboxPlan {
    const { mounts, skipped } = containerMounts(input.reach, this.options.disk);
    return {
      command: dockerRunArgs({
        image: this.options.image,
        mounts,
        cwd: input.reach.runDir,
        user: this.options.user,
        env: this.options.credentialNames,
        network: this.options.network,
        command: input.command,
      }),
      env: this.options.environment,
      paths: mounts,
      skipped,
    };
  }
}
