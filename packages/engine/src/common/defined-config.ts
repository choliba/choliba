type Config = Readonly<Record<string, string | undefined>>;

/** The config entries that have a value: what `${NAME}` in an MCP server's JSON may use. */
export function definedConfig(config: Config): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(config).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
