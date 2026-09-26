import { dirname, isAbsolute, join } from 'node:path';

import type { AgentDefinition, AgentStep } from './agent.types';
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

function missingError(file: string, missing: readonly string[], vars: Readonly<Record<string, string>>): AgentVarsError {
  return new AgentVarsError(
    `${file} usa ${missing.map((name) => `\${${name}}`).join(', ')}, sem valor ` +
      `(disponíveis: ${Object.keys(vars).join(', ')}).`,
  );
}

function usesVars(agent: AgentDefinition): boolean {
  const steps = [...(agent.beforeExecute ?? []), ...(agent.afterExecute ?? [])];
  return HAS_VAR.test(agent.instructions) || steps.some((step) => step.args.some((arg) => HAS_VAR.test(arg)));
}

function expandSteps(
  steps: readonly AgentStep[] | undefined,
  vars: Readonly<Record<string, string>>,
  missing: Set<string>,
): readonly AgentStep[] | undefined {
  return steps?.map((step) => ({
    ...step,
    args: step.args.map((arg) => {
      const expanded = expandVars(arg, vars);
      expanded.missing.forEach((name) => missing.add(name));
      return expanded.text;
    }),
  }));
}

/**
 * The agent with `${NAME}` replaced in its `system.md` — in the text the model reads and in the
 * `<permissions>` the providers enforce alike — and in the arguments of its `before_execute` and
 * `after_execute` steps. `loadVars` only runs when one of them uses a variable, so an agent that uses
 * none never needs them to be configured. A variable with no value stops the run.
 */
export function withExpandedInstructions(
  agent: AgentDefinition,
  loadVars: () => Readonly<Record<string, string>>,
): AgentDefinition {
  if (!usesVars(agent)) {
    return agent;
  }
  const vars = loadVars();
  const { text, missing } = expandVars(agent.instructions, vars);
  if (missing.length > 0) {
    throw missingError(agent.systemPromptPath, missing, vars);
  }
  const stepsMissing = new Set<string>();
  const beforeExecute = expandSteps(agent.beforeExecute, vars, stepsMissing);
  const afterExecute = expandSteps(agent.afterExecute, vars, stepsMissing);
  if (stepsMissing.size > 0) {
    throw missingError(join(agent.dir, 'agent.yaml'), [...stepsMissing], vars);
  }
  return {
    ...agent,
    instructions: text,
    ...(beforeExecute === undefined ? {} : { beforeExecute }),
    ...(afterExecute === undefined ? {} : { afterExecute }),
  };
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
