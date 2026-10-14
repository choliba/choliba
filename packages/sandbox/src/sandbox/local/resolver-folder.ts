import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';

/** Where the system's name resolution is configured. */
const RESOLV_CONF = '/etc/resolv.conf';

/**
 * The folder the resolver configuration really lives in, when it is under `/run`, which `bwrap` replaces with an empty
 * one: `/run/systemd/resolve` with systemd-resolved (its `stub-resolv.conf` and the socket next to it), or the folder of
 * NetworkManager or resolvconf. `undefined` when it lives elsewhere (`/etc`, already mounted) or cannot be read.
 */
export function resolverFolder(realpath: (path: string) => string = realpathSync): string | undefined {
  try {
    const target = realpath(RESOLV_CONF);
    return target.startsWith('/run/') ? dirname(target) : undefined;
  } catch {
    return undefined;
  }
}
