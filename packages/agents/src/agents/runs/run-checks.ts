// The checks a run passes before anything is prepared; each writes why it failed on stderr.

import { loadProjectSettings, type ProjectSettings } from '@choliba/projects';

import { loadAgent } from '../agent-loader';
import { agentFlagNames } from './agents-spec';
import { resolveInvocation } from '../invocation-registry';
import { CLI_PROGRAM_NAME, PREPARE_FLAGS, USAGE } from './agents-flags';
import type { AgentDefinition } from '../../common';
import type { AgentInvocation } from '../interfaces/invocation.interface';
import type { ExecutionMode } from '../../common';
import { readPlan } from './plan-store';
import { validateExplicitModel } from '../../common';
import { absolutePermissions, canRead, outsideExecuteDirs } from '../../common';
import type { RunAgentsCliDeps, RunArgs } from './run-context';
import type { RunProject } from '../../common';
import { errorMessage, projectsDir, toAbsolute } from './run-context';
import { specContext } from './spec-context';
import type { TicketTarget } from './ticket-run';
import { resolveTicketTarget } from './ticket-run';

/** Step 1: which command, and which agent it loads — the only two things every later step needs. */
export function resolveAgentForCommand(
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
  agentsDir: string,
): { command: AgentInvocation; agent: AgentDefinition } | undefined {
  let command: AgentInvocation | undefined;
  try {
    command = resolveInvocation(parsed.command, deps.commands, agentsDir);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
  if (command === undefined) {
    deps.stderr.write(
      `Unknown command "${parsed.command}". Run "${CLI_PROGRAM_NAME} list" to see available agents.\n${USAGE}\n`,
    );
    return undefined;
  }
  try {
    const agent = loadAgent(agentsDir, command.agent);
    return { command, agent };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The first flag on the command line that is not in this agent's own `--help`, if any. A command
 * defined in code with its own `prepare` also takes the diff-base flags, which it receives as `since`.
 */
export function foreignFlag(
  parsed: RunArgs,
  command: AgentInvocation,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): string | undefined {
  const accepted = new Set([
    ...agentFlagNames(agent, specContext([], deps)),
    ...(command.prepare === undefined ? [] : PREPARE_FLAGS),
  ]);
  return parsed.flags.find((flag) => !accepted.has(flag));
}

/**
 * Pre-flight: when `--model` is explicit, it must be one `agent.yaml#models` actually
 * declares — checked before resolving a provider or building a prompt, so a bad model never gets
 * anywhere near invoking one. An agent with no declared models (`supportedModels.length === 0`)
 * has nothing to validate against, so anything goes for it. `true` means "ok to proceed"; on
 * `false` the error (naming every supported model) has already been written to `stderr`.
 */
export function checkModelSupported(parsed: RunArgs, agent: AgentDefinition, deps: RunAgentsCliDeps): boolean {
  if (parsed.model === undefined) {
    return true;
  }
  const error = validateExplicitModel(parsed.model, agent.supportedModels, agent.name);
  if (error === undefined) {
    return true;
  }
  deps.stderr.write(`${error}\n`);
  return false;
}

/**
 * Pre-flight for `--project`: required when the agent acts on a project (it uses a project variable
 * or declares `ticket_types`, see `AgentDefinition.projectRequired`), and, when given,
 * checked by `@choliba/projects` (`loadProjectSettings`: files, active environment, no
 * `CHANGE_ME`) — never by this CLI and never by the agent. A project that is not ready stops the run
 * here, with the resolver's message on `stderr`; the provider is never called. Gives the project's variables
 * and the project itself, which the prompt names (`formatProject`).
 */
export function resolveProjectVars(
  parsed: RunArgs,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
):
  | {
      readonly vars: Readonly<Record<string, string>>;
      readonly project?: RunProject;
      readonly settings?: ProjectSettings;
    }
  | undefined {
  if (parsed.project === undefined) {
    if (!agent.projectRequired) {
      return { vars: {} };
    }
    deps.stderr.write(
      `Project is required for "${agent.name}" (it uses a project variable or ticket_types): pass --project <name>. ${USAGE}\n`,
    );
    return undefined;
  }
  try {
    const settings = loadProjectSettings(projectsDir(deps), parsed.project);
    return {
      vars: { PROJECT: settings.project, PROJECT_DIR: settings.projectPath, APP_DIR: settings.appDir },
      project: { name: settings.project, baseURL: settings.environment.baseURL, appDir: settings.appDir },
      settings,
    };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The ticket this run works on (`--type`/`--ticket`, see `ticket-run.ts`): `undefined` for an agent
 * without `ticket_types`, `null` when the flags do not fit the agent — the reason is already on `stderr`.
 */
export function resolveRunTicket(
  parsed: RunArgs,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): TicketTarget | undefined | null {
  try {
    return resolveTicketTarget(agent, parsed, () => projectsDir(deps));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return null;
  }
}

/** Step 2: the effective mode and task text, after the `modes.allow`/`--plan-from`/`taskRequired` checks. */
export function resolveTaskAndMode(
  parsed: RunArgs,
  command: AgentInvocation,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): { mode: ExecutionMode; task: string } | undefined {
  const mode: ExecutionMode = parsed.mode ?? command.defaultMode;
  if (!agent.modes.includes(mode)) {
    deps.stderr.write(
      `Mode "${mode}" is not allowed for "${agent.name}" (modes.allow: ${agent.modes.join(', ')}). ${USAGE}\n`,
    );
    return undefined;
  }
  if (parsed.planFrom !== undefined && mode !== 'execute') {
    deps.stderr.write(
      `--plan-from can only be used with --mode execute (or no --mode, on a command whose default is execute). ${USAGE}\n`,
    );
    return undefined;
  }
  if (parsed.task === '' && parsed.planFrom === undefined && command.taskRequired) {
    deps.stderr.write(`Task is required for "${command.name}". ${USAGE}\n`);
    return undefined;
  }
  const task = parsed.task === '' && parsed.planFrom !== undefined ? 'Continue with the plan above.' : parsed.task;
  return { mode, task };
}

/** Step 3: the resumed plan's content, if `--plan-from` was given — `undefined` inside the object is a valid "no plan"; `undefined` as the whole result is the failure case. */
export function resolvePlanContent(
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
): { planContent: string | undefined } | undefined {
  if (parsed.planFrom === undefined) {
    return { planContent: undefined };
  }
  const planPath = toAbsolute(parsed.planFrom, deps.repoRoot);
  try {
    return { planContent: readPlan(planPath) };
  } catch (error) {
    deps.stderr.write(`Could not read plan "${planPath}": ${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The directories `execute` names outside the workspace root, each of which must be readable: a command
 * run in a folder reaches what is in it anyway, and a provider can only enter a folder it may read freely.
 * `undefined` when one is not; the reason is already on `stderr`.
 */
export function checkedExecuteDirs(agent: AgentDefinition, deps: RunAgentsCliDeps): readonly string[] | undefined {
  const permissions = absolutePermissions(agent.permissions, deps.repoRoot);
  const dirs = outsideExecuteDirs(permissions, deps.repoRoot);
  const unreadable = dirs.filter((dir) => !canRead(permissions, dir));
  if (unreadable.length === 0) {
    return dirs;
  }
  deps.stderr.write(
    `"${agent.name}" runs commands in ${unreadable.join(', ')}, which permissions.allow.read does not cover: ` +
      'add the folder to allow.read (running commands in it reaches what is there anyway).\n',
  );
  return undefined;
}
