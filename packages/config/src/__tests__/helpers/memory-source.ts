import type { ConfigAddress, ConfigSource, ConfigValue } from '../../index';

/** A source over a plain object: by variable name when flat, by path when nested; writable when asked. */
export function memorySource(
  name: string,
  values: Record<string, unknown>,
  options: { readonly layout?: 'flat' | 'nested'; readonly writable?: boolean; readonly echoes?: boolean } = {},
): ConfigSource & { readonly values: Record<string, unknown> } {
  const layout = options.layout ?? 'flat';
  const at = (address: ConfigAddress): string => (layout === 'flat' ? address.env : address.path.join('.'));
  return {
    name,
    layout,
    values,
    ...(options.echoes === true ? { echoesLaterSources: true } : {}),
    read: (address) => values[at(address)],
    ...(options.writable === true
      ? {
          write: (address: ConfigAddress, value: ConfigValue) => {
            values[at(address)] = value;
          },
        }
      : {}),
  };
}
