import type { ConfigSource } from '../common';

/**
 * The process environment as a source, by each key's variable name. Read only. It echoes later sources: Bun loads the
 * `.env` of the folder it starts in into the environment.
 */
export function envSource(env: Readonly<Record<string, string | undefined>>, name = 'ambiente'): ConfigSource {
  return {
    name,
    layout: 'flat',
    echoesLaterSources: true,
    read: (address) => env[address.env],
  };
}
