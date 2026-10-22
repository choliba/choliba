import { dirname } from 'node:path';

import type { AgentDefinition, McpServer } from '@choliba/domain';
import { withDefinitionDenies } from '@choliba/domain';
import { EXCEPTION_PREFIX } from '@choliba/sandbox';
import { resolveMcpsDir, resolveSkillsDir } from '@choliba/workspace';

import { definedConfig } from '../common';
import { formatSkillsInstruction, resolveSkills, type SkillSummary } from './agent-skills';
import { invocationFromAgent } from './invocation';
import type { AgentInvocation } from './invocation.interface';
import {
  checkModelSupported,
  checkedDefinitionExceptions,
  checkedDenyExceptions,
  checkedExecuteDirs,
} from './prepare-checks';
import { buildProviderRequest, reachableMcp, resolveAddDirs } from './prepare-request';
import { withProjectDenies } from './project-denies';
import { resolveMcps } from './resolve-mcps';
import { agentRunChoice } from './run-choice';
import type { PreparedRun, PrepareRunDeps, RunContext, RunRequest, Stopped } from './run-context';
import { STOPPED, errorMessage, toAbsolute } from './run-context';
import { expandAgent } from './location-vars';

const CHOL_AGENTS_PROVIDER = 'CHOL_AGENTS_PROVIDER';

/**
 * The skills the agent lists, found in the skills dir. A missing or malformed skill stops the run
 * here, before any provider is involved; the error (naming the file) is already on `stderr`.
 */
function resolveAgentSkills(
  agent: AgentDefinition,
  deps: PrepareRunDeps,
): { skillsDir: string; skills: readonly SkillSummary[] } | undefined {
  const skillsDir = resolveSkillsDir(deps.config, deps.repoRoot);
  try {
    return { skillsDir, skills: resolveSkills(skillsDir, agent.skills) };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The MCP servers the agent lists, found in the mcps dir. A missing or malformed server stops the
 * run here, before any provider is involved; the error (naming the file) is already on `stderr`.
 */
function resolveAgentMcps(agent: AgentDefinition, deps: PrepareRunDeps): readonly McpServer[] | undefined {
  try {
    return resolveMcps(resolveMcpsDir(deps.config, deps.repoRoot), agent.mcps, definedConfig(deps.config));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The command a run uses once its agent's `${…}` are filled in: one defined in code stays as is; one
 * derived from `agent.yaml` is derived again, so its steps get the filled-in arguments.
 */
function commandFor(context: RunContext, command: AgentInvocation, agent: AgentDefinition): AgentInvocation {
  return context.synthesized ? invocationFromAgent(agent) : command;
}

/** The agent with `folders` added to what it may read; what it may not (`deny.read`) still wins. */
function withReads(agent: AgentDefinition, folders: readonly string[]): AgentDefinition {
  return folders.length === 0
    ? agent
    : { ...agent, permissions: { ...agent.permissions, allowRead: [...agent.permissions.allowRead, ...folders] } };
}

/**
 * The agent with the folder of each skill it lists taken out of `deny.read` (a `!` exception): declaring a skill
 * is asking to read it, so no deny of the agent's hides it. Only that folder, not the skills dir.
 */
function withSkillExceptions(agent: AgentDefinition, skills: readonly SkillSummary[]): AgentDefinition {
  const exceptions = skills.map((skill) => `${EXCEPTION_PREFIX}${dirname(skill.path)}/`);
  return exceptions.length === 0
    ? agent
    : { ...agent, permissions: { ...agent.permissions, denyRead: [...agent.permissions.denyRead, ...exceptions] } };
}

/**
 * The folders the agent may read besides its own permissions: each skill it lists (using a skill is reading
 * it) and each `--add-dir` (the person who runs it gives it that folder to read).
 */
function extraReads(skills: readonly SkillSummary[], parsed: RunRequest, deps: PrepareRunDeps): readonly string[] {
  return [
    ...skills.map((skill) => `${dirname(skill.path)}/`),
    ...parsed.addDirs.map((dir) => `${toAbsolute(dir, deps.repoRoot).replace(/\/+$/, '')}/`),
  ];
}

/** The folders a run loads definitions from: agents (the dir this run uses), skills and MCPs. */
export function definitionDirectories(context: RunContext): readonly string[] {
  const { deps } = context;
  return [context.agentsDir, resolveSkillsDir(deps.config, deps.repoRoot), resolveMcpsDir(deps.config, deps.repoRoot)];
}

/** Everything one run needs before its provider starts; `Stopped` when a check or a step stops it (reason on `stderr`). */
export async function prepareRun(
  context: RunContext,
  declaredCommand: AgentInvocation,
  declaredAgent: AgentDefinition,
): Promise<(PreparedRun & { command: AgentInvocation }) | Stopped> {
  const { parsed, deps } = context;
  const expanded = expandAgent(declaredAgent, context.vars, deps);
  if (expanded === undefined || !checkModelSupported(parsed, expanded, deps)) {
    return STOPPED;
  }
  const directories = definitionDirectories(context);
  const agent = withDefinitionDenies(withProjectDenies(expanded, context.project), directories);
  const command = commandFor(context, declaredCommand, agent);
  const agentSkills = resolveAgentSkills(agent, deps);
  const mcpServers = agentSkills === undefined ? undefined : resolveAgentMcps(agent, deps);
  if (
    agentSkills === undefined ||
    mcpServers === undefined ||
    !checkedDenyExceptions(agent, deps) ||
    !checkedDefinitionExceptions(agent, directories, deps)
  ) {
    return STOPPED;
  }
  const withSkills = withReads(
    withSkillExceptions(agent, agentSkills.skills),
    extraReads(agentSkills.skills, parsed, deps),
  );
  const executeDirs = checkedExecuteDirs(withSkills, deps);
  if (executeDirs === undefined) {
    return STOPPED;
  }
  const addDirs = resolveAddDirs(command, parsed, deps, executeDirs);
  const chosen = agentRunChoice(
    agent,
    { provider: parsed.provider, model: parsed.model, preference: deps.config[CHOL_AGENTS_PROVIDER] },
    deps.providers,
    deps.which,
  );
  if ('error' in chosen) {
    deps.stderr.write(`${chosen.error}\n`);
    return STOPPED;
  }
  const built = await buildProviderRequest(
    command,
    withSkills,
    context.mode,
    context.task,
    context.planContent,
    addDirs,
    formatSkillsInstruction(agentSkills.skills, deps.repoRoot),
    mcpServers.map((server) => reachableMcp(server, context.sandbox)),
    parsed,
    deps,
  );
  if ('exitCode' in built) {
    return built;
  }
  const { project } = context;
  const withModel = { ...built.providerRequest, model: chosen.model };
  const providerRequest = project === undefined ? withModel : { ...withModel, project };
  return { ...built, providerRequest, resolved: chosen.resolved, command };
}
