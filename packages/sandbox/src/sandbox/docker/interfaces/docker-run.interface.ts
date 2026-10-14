import type { SandboxNetwork } from '../../interfaces/sandbox.interface';
import type { ContainerMount } from '../../mounts/interfaces/container-mounts.interface';

/** The user the container runs as, so what it writes in a mounted folder belongs to whoever owns the workspace. */
export interface ContainerUser {
  readonly uid: number;
  readonly gid: number;
}

export interface DockerRun {
  readonly image: string;
  /** The container's name (`choliba-<run id>`), so `docker ps` and `docker logs` find the session. */
  readonly name: string;
  readonly mounts: readonly ContainerMount[];
  /** Where the command starts, a mounted folder (the run folder). */
  readonly cwd: string;
  readonly user: ContainerUser;
  /** The variables the container gets, by name: `docker` reads each value from its own environment. */
  readonly env: readonly string[];
  readonly network: SandboxNetwork;
  readonly command: readonly string[];
}
