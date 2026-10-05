import type { AgentDefinition, AgentModeSteps, AgentSections, AgentStep } from '../agents/interfaces/agent.interface';
import type { ExecutionMode } from '../agents/interfaces/command.interface';
import { mapPermissions } from './permissions';
import {
  CHOL_AGENTS_DIR,
  CHOL_GLOBAL_DIR,
  CHOL_MCPS_DIR,
  CHOL_ROOT,
  CHOL_SKILLS_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_TICKET_RUNS,
} from '@choliba/core/config';

const VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
/** Same pattern without `g`: `test` on a global regex keeps `lastIndex` between calls. */
const HAS_VAR = /\$\{[A-Z_][A-Z0-9_]*\}/;

/** Only in `steps.<mode>.after`: the agent's exit code, filled in once the agent has run. */
export const AGENT_EXIT_CODE = 'AGENT_EXIT_CODE';

/** The project variables: they only have a value when the run has a project (`--project`). */
export const PROJECT_VARS: readonly string[] = ['PROJECT', 'PROJECT_DIR', 'APP_DIR'];

/** The ticket variables: they only have a value when the run has a ticket, which needs `ticket_types`. */
export const TICKET_VARS: readonly string[] = ['TICKET', 'TICKET_FILE'];

/** The location variables: they only have a value once `CHOL_GLOBAL_DIR` is configured. */
export const LOCATION_VARS: readonly string[] = [CHOL_GLOBAL_DIR, CHOL_PROJECTS_DIR, CHOL_TICKET_RUNS];

/**
 * Every `${NAME}` an `agent.yaml` may use (the README's "Variáveis" lists them, with an example each).
 * Any other name is an error when the agent is loaded; `AGENT_EXIT_CODE` is only valid in `steps.<mode>.after`.
 */
export const AGENT_VARS: readonly string[] = [
  CHOL_ROOT,
  CHOL_AGENTS_DIR,
  CHOL_SKILLS_DIR,
  CHOL_MCPS_DIR,
  ...LOCATION_VARS,
  ...PROJECT_VARS,
  ...TICKET_VARS,
  AGENT_EXIT_CODE,
];

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

/** The `${NAME}`s in `text`, in order, repeated as often as they appear. */
export function varNames(text: string): readonly string[] {
  return [...text.matchAll(VAR_PATTERN)].map((match) => String(match[1]));
}

/** The declaration fields whose texts may hold `${NAME}`. */
export type AgentTexts = Pick<AgentDefinition, 'sections' | 'skills' | 'mcps' | 'permissions' | 'steps'>;

/** Changes one text; `field` says where it is in `agent.yaml` (`role`, `steps.execute.before`...). */
type TextChange = (text: string, field: string) => string;

function mapSections(sections: AgentSections, change: TextChange): AgentSections {
  return {
    role: change(sections.role, 'role'),
    context: sections.context.map((text) => change(text, 'context')),
    input: change(sections.input, 'input'),
    flow: change(sections.flow, 'flow'),
    output: change(sections.output, 'output'),
    notes: sections.notes.map((text) => change(text, 'notes')),
  };
}

function mapInstructions<Declaration extends { readonly name: string; readonly instructions?: string }>(
  declarations: readonly Declaration[],
  kind: string,
  change: TextChange,
): readonly Declaration[] {
  return declarations.map((declaration) =>
    declaration.instructions === undefined
      ? declaration
      : { ...declaration, instructions: change(declaration.instructions, `${kind}.${declaration.name}.instructions`) },
  );
}

function mapStepList(steps: readonly AgentStep[], field: string, change: TextChange): readonly AgentStep[] {
  return steps.map((step) => ({ ...step, args: step.args.map((arg) => change(arg, field)) }));
}

function mapModeSteps(steps: AgentModeSteps, mode: ExecutionMode, change: TextChange): AgentModeSteps {
  const after = `steps.${mode}.after`;
  return {
    before: mapStepList(steps.before, `steps.${mode}.before`, change),
    after: {
      success: mapStepList(steps.after.success, `${after}.success`, change),
      failure: mapStepList(steps.after.failure, `${after}.failure`, change),
      always: mapStepList(steps.after.always, `${after}.always`, change),
    },
  };
}

/**
 * `fields` with `change` applied to every text that may hold `${NAME}`: the sections, the
 * `instructions` of skills and MCPs, the permissions (paths, directories and commands) and the
 * arguments of the steps, in the order of `agent.yaml`. The one list of those texts: checking,
 * expanding and listing them all go through here.
 */
export function mapAgentTexts<Fields extends AgentTexts>(fields: Fields, change: TextChange): Fields {
  const sections = mapSections(fields.sections, change);
  const skills = mapInstructions(fields.skills, 'skills', change);
  const mcps = mapInstructions(fields.mcps, 'mcps', change);
  const permissions = mapPermissions(fields.permissions, (text) => change(text, 'permissions'));
  const steps: Record<ExecutionMode, AgentModeSteps> = {
    execute: mapModeSteps(fields.steps.execute, 'execute', change),
    plan: mapModeSteps(fields.steps.plan, 'plan', change),
    ask: mapModeSteps(fields.steps.ask, 'ask', change),
  };
  return { ...fields, sections, skills, mcps, permissions, steps };
}

/** Every text of `fields` that may hold `${NAME}` (see `mapAgentTexts`). */
export function agentTexts(fields: AgentTexts): readonly string[] {
  const texts: string[] = [];
  mapAgentTexts(fields, (text) => {
    texts.push(text);
    return text;
  });
  return texts;
}

function isAfterStep(field: string): boolean {
  return /^steps\.[a-z]+\.after\./.test(field);
}

/** Why `name`, found in `field`, may not be there; `undefined` when it may. */
function varProblem(name: string, field: string): string | undefined {
  if (!AGENT_VARS.includes(name)) {
    return `\${${name}} (em ${field}) não é uma variável do agent.yaml; as que existem: ${AGENT_VARS.join(', ')}`;
  }
  if (name === AGENT_EXIT_CODE && !isAfterStep(field)) {
    return `\${${AGENT_EXIT_CODE}} só vale em steps.<modo>.after (está em ${field})`;
  }
  return undefined;
}

/** Every `${NAME}` of `fields` that is not in the catalog (`AGENT_VARS`) or not valid where it is. */
export function varProblems(fields: AgentTexts): readonly string[] {
  const problems = new Set<string>();
  mapAgentTexts(fields, (text, field) => {
    for (const name of varNames(text)) {
      const problem = varProblem(name, field);
      if (problem !== undefined) {
        problems.add(problem);
      }
    }
    return text;
  });
  return [...problems];
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

/**
 * The agent with `${NAME}` replaced in every text that may hold one (see `mapAgentTexts`), except
 * `${AGENT_EXIT_CODE}`, which only has a value once the agent has run (`expandExitCode`). `loadVars`
 * only runs when a text uses a variable, so an agent that uses none never needs them to be
 * configured. A variable with no value stops the run.
 */
export function withExpandedVars(
  agent: AgentDefinition,
  loadVars: () => Readonly<Record<string, string>>,
): AgentDefinition {
  if (!agentTexts(agent).some((text) => HAS_VAR.test(text))) {
    return agent;
  }
  const vars = loadVars();
  const kept = { ...vars, [AGENT_EXIT_CODE]: `\${${AGENT_EXIT_CODE}}` };
  const missing = new Set<string>();
  const expanded = mapAgentTexts(agent, (text) => {
    const result = expandVars(text, kept);
    result.missing.forEach((name) => missing.add(name));
    return result.text;
  });
  if (missing.size > 0) {
    throw missingError(agent.sourcePath, [...missing], vars);
  }
  return expanded;
}

/** `steps` with `${AGENT_EXIT_CODE}` replaced by the agent's exit code. */
export function expandExitCode(steps: readonly AgentStep[], exitCode: number): readonly AgentStep[] {
  const vars = { [AGENT_EXIT_CODE]: String(exitCode) };
  return steps.map((step) => ({ ...step, args: step.args.map((arg) => expandVars(arg, vars).text) }));
}
