import { dirname, isAbsolute } from 'node:path';

import type { AgentDefinition } from './agent.types';
import type { AgentPermissions } from './permissions';

const VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
/** Same pattern without `g`: `test` on a global regex keeps `lastIndex` between calls. */
const HAS_VAR = /\$\{[A-Z_][A-Z0-9_]*\}/;

export class AgentVarsError extends Error {}

/** `${NAME}` in `text`, each replaced by `vars[NAME]`; the names with no value are listed in `missing`. */
export function expandVars(
  text: string,
  vars: Readonly<Record<string, string>>,
): { readonly text: string; readonly missing: readonly string[] } {
  const missing = new Set<string>();
  const expanded = text.replaceAll(VAR_PATTERN, (whole: string, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      missing.add(name);
      return whole;
    }
    return value;
  });
  return { text: expanded, missing: [...missing] };
}

/**
 * The agent with `${NAME}` in its `system.md` replaced — in the text the model reads and in the
 * `<permissions>` the providers enforce alike. `loadVars` only runs when the text uses a variable, so an
 * agent that uses none never needs them to be configured. A variable with no value stops the run.
 */
export function withExpandedInstructions(
  agent: AgentDefinition,
  loadVars: () => Readonly<Record<string, string>>,
): AgentDefinition {
  if (!HAS_VAR.test(agent.instructions)) {
    return agent;
  }
  const vars = loadVars();
  const { text, missing } = expandVars(agent.instructions, vars);
  if (missing.length > 0) {
    throw new AgentVarsError(
      `${agent.systemPromptPath} usa ${missing.map((name) => `\${${name}}`).join(', ')}, sem valor ` +
        `(disponíveis: ${Object.keys(vars).join(', ')}).`,
    );
  }
  return { ...agent, instructions: text };
}

/** The directory a declared path lives under: the part before the first glob segment, or its folder. */
export function pathBase(path: string): string {
  const segments = path.split('/');
  const globAt = segments.findIndex((segment) => /[*?[\]]/.test(segment));
  if (globAt !== -1) {
    return segments.slice(0, globAt).join('/') || '/';
  }
  return path.endsWith('/') ? path.slice(0, -1) || '/' : dirname(path);
}

/**
 * The absolute directories the agent's `<permissions>` let it read or write. A provider only reaches a
 * directory outside the workspace when it is granted (`--add-dir`), so these go there.
 */
export function permissionDirs(permissions: AgentPermissions): readonly string[] {
  const paths = [...permissions.allowRead, ...permissions.allowWrite].filter((path) => isAbsolute(path));
  return [...new Set(paths.map(pathBase))];
}
