import type { ToolEntry, ToolPolicy } from '@choliba/sandbox';

import type { McpDeclaration } from '@choliba/domain';
import { SUBAGENT_TOOLS } from './delegation-guard';

/** A declared server: all of it, or only the tools it lists. */
function declaredTools(mcp: McpDeclaration): readonly ToolEntry[] {
  if (mcp.tools === undefined) return [{ server: mcp.name }];
  return mcp.tools.map((name) => ({ server: mcp.name, name }));
}

/**
 * The tools an agent may invoke, for the sandbox to decide on: the MCPs it declares (`agent.yaml#mcps`), within the
 * tools each lists. The subagent tools, which no agent uses, and the provider tools its permissions cannot limit are
 * denied by name. Any other provider tool is not named: the provider limits it, and the paths it reaches.
 */
export function toolPolicy(mcps: readonly McpDeclaration[], unenforcedTools: readonly string[]): ToolPolicy {
  return {
    allow: mcps.flatMap(declaredTools),
    deny: [...SUBAGENT_TOOLS, ...unenforcedTools].map((name) => ({ name })),
    exception: [],
  };
}
