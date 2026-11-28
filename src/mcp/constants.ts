/** Defaults of the agents' own tools (src/mcp). */

/**
 * The MCP server the tools are served by, and the prefix of their names in
 * the provider's `tools` and in the policy: `choliba/consultar_ticket`.
 * Protocol, so not an option.
 */
export const TOOL_SERVER = 'choliba';

/**
 * A tool's name: lowercase letters, digits and `_`, starting with a letter.
 * What every CLI accepts in a tool's name.
 */
export const TOOL_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * Milliseconds the MCP server waits for the Choliba to answer one call (the
 * tool's `run` included) before telling the model it failed: long enough
 * for a request to an API, short enough not to hang a turn.
 */
export const TOOL_CALL_MS = 120_000;

/**
 * The version the tools' MCP server gives in the handshake (`serverInfo`):
 * the server's, not the protocol's, which the SDK negotiates with the CLI.
 */
export const TOOL_SERVER_VERSION = '2';

/**
 * The folder of Choliba's cache with the tools' server of each running agent
 * (bundled, with its owner): a folder of its own, apart from the other
 * modules' ones.
 */
export const TOOL_CACHE_DIR = 'tools';
