import { join } from 'node:path';

import type { AgentDefinition, AgentStep } from './agent.types';
import { mapPermissions, permissionTexts } from './permissions';

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

function missingError(
  file: string,
  missing: readonly string[],
  vars: Readonly<Record<string, string>>,
): AgentVarsError {
  return new AgentVarsError(
    `${file} usa ${missing.map((name) => `\${${name}}`).join(', ')}, sem valor ` +
      `(disponíveis: ${Object.keys(vars).join(', ')}).`,
  );
}

/** The texts of `agent.yaml` that may hold `${NAME}`: step arguments, permission paths and commands. */
function yamlTexts(agent: AgentDefinition): readonly string[] {
  const steps = [...(agent.beforeExecute ?? []), ...(agent.afterExecute ?? [])];
  return [...steps.flatMap((step) => step.args), ...permissionTexts(agent.permissions)];
}

function usesVars(agent: AgentDefinition): boolean {
  return HAS_VAR.test(agent.instructions) || yamlTexts(agent).some((text) => HAS_VAR.test(text));
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
 * The agent with `${NAME}` replaced in its `system.md`, in the arguments of its steps and in its
 * `permissions` (paths, directories and commands, which the providers enforce and the prompt shows). `loadVars` only runs when one of them uses a variable, so an agent that uses
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
  const yamlMissing = new Set<string>();
  const beforeExecute = expandSteps(agent.beforeExecute, vars, yamlMissing);
  const afterExecute = expandSteps(agent.afterExecute, vars, yamlMissing);
  const permissions = mapPermissions(agent.permissions, (value) => {
    const expanded = expandVars(value, vars);
    expanded.missing.forEach((name) => yamlMissing.add(name));
    return expanded.text;
  });
  if (yamlMissing.size > 0) {
    throw missingError(join(agent.dir, 'agent.yaml'), [...yamlMissing], vars);
  }
  return {
    ...agent,
    instructions: text,
    permissions,
    ...(beforeExecute === undefined ? {} : { beforeExecute }),
    ...(afterExecute === undefined ? {} : { afterExecute }),
  };
}
