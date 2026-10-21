import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

/** Docker's bridge on Linux, whose address is where a container's `host-gateway` (`host.docker.internal`) leads. */
const DOCKER_BRIDGE = 'docker0';

/**
 * The address a container on Docker's isolated network reaches this machine by: the IPv4 of `docker0`. `undefined`
 * where there is none (Docker Desktop, which reaches this machine's `localhost` by itself; rootless Docker).
 */
export function dockerHostAddress(
  interfaces: NodeJS.Dict<readonly NetworkInterfaceInfo[]> = networkInterfaces(),
): string | undefined {
  return interfaces[DOCKER_BRIDGE]?.find((address) => address.family === 'IPv4')?.address;
}
