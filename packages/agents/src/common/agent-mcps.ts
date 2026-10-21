import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { expandMcpConfig, McpError, mcpConfig, type McpDeclaration, type McpServer } from '@choliba/domain';

import { asString } from './json';

export { expandMcpConfig, McpError, mcpConfig, mcpServersMap } from '@choliba/domain';
export type { McpServer } from '@choliba/domain';

function serverPaths(
  raw: Readonly<Record<string, unknown>>,
  expanded: Readonly<Record<string, unknown>>,
): readonly { readonly raw: string; readonly path: string }[] {
  const strings = (config: Readonly<Record<string, unknown>>): string[] => {
    const args: unknown = config['args'];
    const list: readonly unknown[] = Array.isArray(args) ? args : [];
    return [config['command'], ...list].map((item) => asString(item) ?? '');
  };
  const written = strings(raw);
  return strings(expanded).map((path, index) => ({ raw: String(written[index]), path }));
}

function assertServerFiles(
  name: string,
  raw: Readonly<Record<string, unknown>>,
  expanded: Readonly<Record<string, unknown>>,
): void {
  const missing = serverPaths(raw, expanded).find(({ path }) => isAbsolute(path) && !existsSync(path));
  if (missing === undefined) {
    return;
  }
  const variable = /\$\{([A-Z0-9_]+)\}/.exec(missing.raw)?.[1];
  const hint = variable === undefined ? '' : ` (veja ${variable} no .env)`;
  throw new McpError(`o servidor do MCP ${name} não existe: ${missing.path}${hint}.`);
}

export function resolveMcps(
  mcpsDir: string,
  declarations: readonly McpDeclaration[],
  vars: Readonly<Record<string, string>>,
): readonly McpServer[] {
  return declarations.map(({ name, tools }) => {
    const path = join(mcpsDir, `${name}.json`);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new McpError(`mcp "${name}" não encontrado: ${path} não existe.`);
    }
    const raw = mcpConfig(text, path);
    const config = expandMcpConfig(raw, vars, path);
    assertServerFiles(name, raw, config);
    return { name, config, path, ...(tools === undefined ? {} : { tools }) };
  });
}
