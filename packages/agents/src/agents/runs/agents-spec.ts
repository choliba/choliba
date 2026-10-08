import type { CommandEntry, CommandSpec, FlagSpec, Suggestions, TypedFlags, GitRunner } from '@choliba/core';
import { readTicketTemplate, ticketTemplatesDir } from '@choliba/projects';

import type { AgentDefinition } from '../../common';
import { SINCE_PENDING } from '../steps/step-constants';
import { diffBaseOf } from '../steps/step-registry';
import type { ProviderRegistry } from '../../common';
import {
  CLI_PROGRAM_NAME,
  MODE_CHOICES,
  PREPARE_FLAGS,
  PROJECT_FLAGS,
  runFlagDefinitions,
  TICKET_FLAGS,
  TYPE_SHORTCUT_PREFIX,
  modeDescription,
  sinceDescription,
} from './agents-flags';
import { EXECUTION_MODES } from '../../common';

export interface AgentsCliSpecContext {
  /** The providers choliba found: `--provider`, `--<id>` and their completion. */
  readonly providers: ProviderRegistry;
  readonly agents: readonly AgentDefinition[];
  readonly repoRoot: string;
  readonly git: GitRunner;
  /** The project names `--project` completes to, read when asked (none when the locations are not set). */
  readonly projects: () => readonly string[];
  /** The ticket keys `--ticket` completes to: of `project` when given, else of every project; read when asked. */
  readonly tickets: (project?: string) => readonly string[];
}

const FILES: Suggestions = { kind: 'files' };

function values(list: readonly string[]): Suggestions {
  return { kind: 'values', values: list };
}

/** `pending`, then local branches and tags read at completion time (none when git fails). */
function gitRefs(context: AgentsCliSpecContext): Suggestions {
  const result = context.git.run(
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/tags'],
    context.repoRoot,
  );
  const refs = result.status === 0 ? result.stdout.split('\n').filter((line) => line !== '') : [];
  return values([SINCE_PENDING, ...refs]);
}

/** `--help` shows only the first sentence of an agent's description, on one line. */
function summary(description: string): string {
  const oneLine = description.replaceAll(/\s+/g, ' ').trim();
  const end = oneLine.indexOf('. ');
  return end === -1 ? oneLine : oneLine.slice(0, end + 1);
}

/** How to complete the value of a `runFlagDefinitions` entry for `agent`; nothing for a free-form value. */
export function flagValueSuggestions(
  flagName: string,
  agent: AgentDefinition,
  context: AgentsCliSpecContext,
  typed: TypedFlags = new Map(),
): Suggestions {
  switch (flagName) {
    case '--mode':
      return values(agent.modes);
    case '--provider':
      return values(context.providers.choices());
    case '--model':
      return values(agent.supportedModels);
    case '--since':
      return gitRefs(context);
    case '--project':
      return values(context.projects());
    case '--type':
      return values(agent.ticketTypes ?? []);
    case '--ticket':
      return values(context.tickets(typed.get('--project')));
    case '--plan-from':
    case '--agents-dir':
    case '--add-dir':
      return FILES;
    default:
      return values([]);
  }
}

/** What a ticket type is for: its template's `description`. */
function ticketTypeDescription(type: string): string {
  try {
    return readTicketTemplate(ticketTemplatesDir(), type).description;
  } catch {
    return 'Tipo sem template em packages/projects/templates/ticket/.';
  }
}

/**
 * `--type` with each ticket type the agent works on as a value, saying what it is for, then one
 * `--type-<type>` shortcut per type, described like the other shortcuts (`--mode-<mode>`).
 */
function withTicketTypes(flags: readonly FlagSpec[], agent: AgentDefinition): readonly FlagSpec[] {
  const types = agent.ticketTypes ?? [];
  const choices = types.map((type) => ({ name: type, description: ticketTypeDescription(type) }));
  const shortcuts = types.map((type): FlagSpec => ({
    name: `${TYPE_SHORTCUT_PREFIX}${type}`,
    description: `Atalho para --type ${type}`,
  }));
  return flags.flatMap((flag) => (flag.name === '--type' ? [{ ...flag, choices }, ...shortcuts] : [flag]));
}

/** `--mode` with only the modes the agent allows as values, and a `--mode-<mode>` shortcut only for those. */
function withModes(flags: readonly FlagSpec[], agent: AgentDefinition): readonly FlagSpec[] {
  const refused = EXECUTION_MODES.filter((mode) => !agent.modes.includes(mode)).map((mode) => `--mode-${mode}`);
  return flags
    .filter((flag) => !refused.includes(flag.name))
    .map((flag) =>
      flag.name === '--mode'
        ? { ...flag, choices: agent.modes.map((mode) => ({ name: mode, description: MODE_CHOICES[mode] })) }
        : flag,
    );
}

/**
 * `runFlagDefinitions` with value completion for this agent. The diff-base flags only appear for agents
 * with a `git_diff` in `steps.before`, `--project` only for agents that act on a project,
 * `--type`/`--ticket` (and a `--type-<type>` per type) only for agents with `ticket_types`,
 * `--mode` and its shortcuts only with the modes the agent allows, and `--mode`/`--since` show that
 * agent's own defaults.
 */
function runFlags(agent: AgentDefinition, context: AgentsCliSpecContext): readonly FlagSpec[] {
  const diffBase = diffBaseOf(agent);
  const hidden = [
    ...(diffBase === undefined ? PREPARE_FLAGS : []),
    ...(agent.projectRequired ? [] : PROJECT_FLAGS),
    ...(agent.ticketTypes === undefined ? TICKET_FLAGS : []),
  ];
  const flags = runFlagDefinitions(context.providers)
    .filter((flag) => !hidden.includes(flag.name))
    .map(({ valueName, ...rest }) => {
      const flag =
        rest.name === '--mode'
          ? { ...rest, description: modeDescription(agent.defaultMode) }
          : rest.name === '--since' && diffBase !== undefined
            ? { ...rest, description: sinceDescription(diffBase) }
            : rest;
      return valueName === undefined
        ? flag
        : {
            ...flag,
            value: {
              name: valueName,
              suggest: (typed: TypedFlags) => flagValueSuggestions(flag.name, agent, context, typed),
            },
          };
    });
  return withModes(withTicketTypes(flags, agent), agent);
}

/** Every flag this agent takes, in each of its forms (`--help`, `-h`): exactly what its `--help` lists. */
export function agentFlagNames(agent: AgentDefinition, context: AgentsCliSpecContext): readonly string[] {
  return runFlags(agent, context).flatMap((flag) => [flag.name, ...(flag.aliases ?? [])]);
}

/** The spec of one agent as a command: `agents <agent> [OPTIONS] [TASK...]`. */
export function agentCommandSpec(
  agent: AgentDefinition,
  context: AgentsCliSpecContext,
  description?: string,
): CommandSpec {
  return {
    usage: `${CLI_PROGRAM_NAME} ${agent.name} [OPTIONS] [TASK...]`,
    ...(description === undefined ? {} : { description }),
    flags: runFlags(agent, context),
  };
}

/**
 * The whole `agents` CLI as one spec, rebuilt on every run from the agents found on disk — so
 * `--help` and shell completion always list the agents, models and refs that exist right now.
 */
export function agentsCliSpec(context: AgentsCliSpecContext): CommandSpec {
  const agentsDirFlag = runFlagDefinitions(context.providers)
    .filter((flag) => flag.name === '--agents-dir')
    .map(({ valueName: _valueName, ...rest }): FlagSpec => ({ ...rest, value: { name: 'dir', suggest: () => FILES } }));
  const helpFlag: FlagSpec = { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true };

  const commands = (): readonly CommandEntry[] => [
    ...context.agents.map((agent) => ({
      name: agent.name,
      description: summary(agent.description),
      group: 'Agents',
      spec: agentCommandSpec(agent, context),
      asFlag: true,
    })),
    {
      name: 'list',
      description: 'Lista os agentes com os detalhes de cada um',
      group: 'Commands',
      spec: { usage: `${CLI_PROGRAM_NAME} list [OPTIONS]`, flags: agentsDirFlag },
    },
    { name: 'help', description: 'Mostra esta ajuda', group: 'Commands', spec: { usage: `${CLI_PROGRAM_NAME} help` } },
  ];

  return {
    usage: `${CLI_PROGRAM_NAME} [OPTIONS] COMMAND [TASK...]`,
    description: `Executa os agentes da pasta de trabalho (.choliba/agents/<nome>/) por um provider (${context.providers.choices().join(', ')}).`,
    commands,
    flags: [helpFlag],
    footer: `Run '${CLI_PROGRAM_NAME} COMMAND --help' for more information on a command.`,
  };
}
