import type { FlagSpec, Suggestions, TypedFlags } from '@choliba/core';
import { diffBaseOf } from '@choliba/engine';
import { readTicketTemplate, ticketTemplatesDir } from '@choliba/projects';

import type { AgentDefinition, ProviderRegistry } from '../../common';
import { EXECUTION_MODES } from '../../common';
import {
  MODE_CHOICES,
  PREPARE_FLAGS,
  PROJECT_FLAGS,
  runFlagDefinitions,
  TICKET_FLAGS,
  TYPE_SHORTCUT_PREFIX,
  modeDescription,
  sinceDescription,
} from './run-flag-definitions';

type ValueSuggestions = (flagName: string, agent: AgentDefinition, typed: TypedFlags) => Suggestions;

/** The run flags available to this agent, including agent-specific choices and value suggestions. */
export function agentRunFlags(
  agent: AgentDefinition,
  providers: ProviderRegistry,
  suggestValue?: ValueSuggestions,
): readonly FlagSpec[] {
  const diffBase = diffBaseOf(agent);
  const hidden = [
    ...(diffBase === undefined ? PREPARE_FLAGS : []),
    ...(agent.projectRequired ? [] : PROJECT_FLAGS),
    ...(agent.ticketTypes === undefined ? TICKET_FLAGS : []),
  ];
  const flags = runFlagDefinitions(providers)
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
              ...(suggestValue === undefined
                ? {}
                : { suggest: (typed: TypedFlags) => suggestValue(flag.name, agent, typed) }),
            },
          };
    });
  return withModes(withTicketTypes(flags, agent), agent);
}

/** Every flag this agent takes, in each of its forms (`--help`, `-h`). */
export function agentFlagNames(agent: AgentDefinition, providers: ProviderRegistry): readonly string[] {
  return agentRunFlags(agent, providers).flatMap((flag) => [flag.name, ...(flag.aliases ?? [])]);
}

/** What a ticket type is for: its template's `description`. */
function ticketTypeDescription(type: string): string {
  try {
    return readTicketTemplate(ticketTemplatesDir(), type).description;
  } catch {
    return 'Tipo sem template em packages/projects/templates/ticket/.';
  }
}

/** `--type` with each ticket type and one `--type-<type>` shortcut per type. */
function withTicketTypes(flags: readonly FlagSpec[], agent: AgentDefinition): readonly FlagSpec[] {
  const types = agent.ticketTypes ?? [];
  const choices = types.map((type) => ({ name: type, description: ticketTypeDescription(type) }));
  const shortcuts = types.map((type): FlagSpec => ({
    name: `${TYPE_SHORTCUT_PREFIX}${type}`,
    description: `Atalho para --type ${type}`,
  }));
  return flags.flatMap((flag) => (flag.name === '--type' ? [{ ...flag, choices }, ...shortcuts] : [flag]));
}

/** `--mode` with only the modes the agent allows as values and shortcuts. */
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
