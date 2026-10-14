import { basename } from 'node:path';

import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from '../interfaces/sandbox-backend.interface';
import { containerMounts } from '../mounts/container-mounts';
import { dockerRunArgs } from './docker-run';
import type { DockerSandboxOptions } from './interfaces/docker-sandbox.interface';

/**
 * The container of the run in `runDir`: `choliba-` and the run folder's name (`2026-10-12T05-53-29.739Z-383691`), unique
 * per run and made only of the characters Docker takes in a name.
 */
export function containerName(runDir: string): string {
  return `choliba-${basename(runDir).replaceAll(/[^\w.-]/g, '-')}`;
}

export class DockerSandbox implements SandboxBackend {
  readonly kind = 'docker';

  constructor(private readonly options: DockerSandboxOptions) {}

  plan(input: SandboxPlanInput): SandboxPlan {
    const { mounts, skipped } = containerMounts(input.reach, this.options.disk);
    const container = containerName(input.reach.runDir);
    return {
      command: dockerRunArgs({
        image: this.options.image,
        name: container,
        mounts,
        cwd: input.reach.runDir,
        user: this.options.user,
        env: [...new Set([...this.options.credentialNames, ...Object.keys(input.variables ?? {})])],
        network: this.options.network,
        command: input.command,
      }),
      env: { ...this.options.environment, ...input.variables },
      place: { kind: 'docker', image: this.options.image, container },
      paths: mounts,
      skipped,
    };
  }
}
