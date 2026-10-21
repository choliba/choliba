import type { CommandEntry, CommandSpec, FlagSpec, Suggestions, TypedFlags, GitRunner } from '@choliba/core';
import { listTicketTypes, readTicketTemplate, ticketTemplatesDir } from '@choliba/projects';

import type { AgentDefinition } from '../../common';
import { SINCE_PENDING } from '../steps/step-constants';
import { diffBaseOf } from '../steps/step-registry';
import type { ProviderRegistry } from '../../common';
import {
  CLI_PROGRAM_NAME,
  LIST_PROGRAM_NAME,
  MODE_CHOICES,
  PREPARE_FLAGS,
  PROJECT_FLAGS,
  runFlagDefinitions,
  TICKET_FLAGS,
  TYPE_SHORTCUT_PREFIX,
  modeDescription,
  sinceDescription,
} from './agents-flags';
import { AUTO, EXECUTION_MODES } from '../../common';
import { declaredModels } from './run-choice';

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
      return values([AUTO, ...agent.providers.map(({ id }) => id)]);
    case '--model': {
      // The models of the provider already typed; with none, every model the agent declares.
      const provider = typed.get('--provider');
      return values(
        provider === undefined ? agent.providers.flatMap(({ models }) => models) : declaredModels(agent, provider),
      );
    }
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

const HELP_FLAG: FlagSpec = { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true };

/** `--agents-dir`, completing folders. */
function agentsDirFlag(context: Pick<AgentsCliSpecContext, 'providers'>): readonly FlagSpec[] {
  return runFlagDefinitions(context.providers)
    .filter((flag) => flag.name === '--agents-dir')
    .map(({ valueName: _valueName, ...rest }): FlagSpec => ({ ...rest, value: { name: 'dir', suggest: () => FILES } }));
}

/**
 * The whole `run agent` CLI as one spec, rebuilt on every run from the agents found on disk — so
 * `--help` and shell completion always list the agents, models and refs that exist right now.
 */
export function agentsCliSpec(context: AgentsCliSpecContext): CommandSpec {
  const helpFlag = HELP_FLAG;

  const commands = (): readonly CommandEntry[] => [
    ...context.agents.map((agent) => ({
      name: agent.name,
      description: summary(agent.description),
      group: 'Agents',
      spec: agentCommandSpec(agent, context),
      asFlag: true,
    })),
  ];

  return {
    usage: `${CLI_PROGRAM_NAME} AGENT [OPTIONS] [TASK...]`,
    description: runAgentDescription(context),
    examples: RUN_AGENT_EXAMPLES,
    details: RUN_AGENT_DETAILS,
    commands,
    flags: [helpFlag],
    footer: `Run '${CLI_PROGRAM_NAME} AGENT --help' for more information on an agent.`,
  };
}

/** What `run agent` does, naming the providers choliba knows. */
function runAgentDescription(context: Pick<AgentsCliSpecContext, 'providers'>): string {
  return `Executa um agente da pasta de trabalho (.choliba/agents/<nome>/) por um provider (${context.providers.choices().join(', ')}).`;
}

const RUN_AGENT_EXAMPLES = [
  {
    description: 'Escreve o ticket de uma story nova a partir de um pedido',
    command: 'choliba run agent product-owner --project loja --type story "a busca aceita filtro por data"',
  },
  {
    description: 'Escreve os testes do ticket loja-1',
    command: 'choliba run agent test-writer --project loja --ticket loja-1',
  },
  {
    description: 'Mostra o que a implementação faria, sem executar nada',
    command: 'choliba run agent implementer --project loja --ticket loja-1 --dry-run',
  },
] as const;

const RUN_AGENT_DETAILS = `As flags que um agente aceita dependem do \`agent.yaml\` dele: \`--project\` só para quem age num projeto,
\`--type\` e \`--ticket\` só para quem tem \`ticket_types\`, \`--mode\` só com os modos que ele permite, \`--since\` só para quem tem um
\`git_diff\`. \`choliba run agent <agente> --help\` mostra as do agente; a tabela abaixo tem todas. Uma execução passa
pelo [ciclo de execução](../referencia/ciclo-de-execucao-agente.md): o choliba antes, o modelo, o choliba depois. Num
terminal, a saída do agente vai num quadro, com o provider, o modelo, o sandbox e o tempo decorrido numa tabela no
rodapé.

### \`--dry-run\`

\`--dry-run\` mostra, na ordem, o que o comando faria sem ele, e **não executa nada**: nenhum step, nenhum ticket,
nenhuma pasta de execução, nenhum provider. Vale em qualquer modo. Ele só lê o que precisa para montar a lista (o
\`agent.yaml\`, as skills, os MCPs, o projeto e o ticket), então um problema que faria a execução falhar antes do
agente aparece do mesmo jeito.

\`\`\`
$ bun choliba run agent implementer --mode plan --dry-run --project app --ticket app-1
Sem --dry-run, faria nesta ordem:

 1. [CLI]    confere http://localhost:5173/: sem resposta, para aqui (o ambiente não tem envs[].start)
 2. [CLI]    plan.before 1/2 — run: bun choliba run tests app:app-1 --expect red --failures .cache/test-writer/app-1/red.md
             se falhar: para aqui, o agente não roda
 3. [CLI]    plan.before 2/2 — read_files: tag=falhas_red files=.cache/test-writer/app-1/red.md
             se falhar: para aqui, o agente não roda
 4. [agente] cursor · modelo Composer 2.5 Fast · modo plan · na pasta .cache/runs/<id>
             skills: playwright-trace · MCPs: nenhum
             prompt de sistema: 8053 bytes · prompt do usuário: 218 bytes (--show-prompt mostra os dois)
             comando: agent -p <prompt> --trust --disable-auto-update --output-format stream-json …
 5. [CLI]    plan.after.success (se o agente sair com 0): nada
             plan.after.failure (se o agente falhar): nada
             plan.after.always: nada
 6. [CLI]    fecha o ticket: apaga um ticket novo que o agente não preencheu; em execute, falha se sobrar CHANGE_ME
\`\`\`

Com \`--show-prompt\` (só junto de \`--dry-run\`), a saída segue com os dois prompts completos, a linha de comando
completa (em JSON, um argumento por item) e, no Cursor, o \`.cursor/cli.json\` da pasta da execução e o
\`.cursor/mcp.json\` da raiz, como seriam gravados.

Antes do agente, com \`--project\`, o choliba deixa a aplicação pronta: veja
[A aplicação do projeto](../referencia/aplicacao-do-projeto.md).`;

/**
 * \`run agent\` without a workspace to read the agents from: every flag a run takes, with every mode and every ticket
 * type of the templates. What the command reference page and \`--help\` outside a workspace show.
 */
export function runAgentReferenceSpec(context: Pick<AgentsCliSpecContext, 'providers'>): CommandSpec {
  const types = listTicketTypes(ticketTemplatesDir());
  const flags = runFlagDefinitions(context.providers).map(({ valueName, ...rest }): FlagSpec =>
    valueName === undefined ? rest : { ...rest, value: { name: valueName } },
  );
  const withChoices = flags.flatMap((flag): readonly FlagSpec[] => {
    if (flag.name === '--mode') {
      return [{ ...flag, choices: EXECUTION_MODES.map((mode) => ({ name: mode, description: MODE_CHOICES[mode] })) }];
    }
    if (flag.name !== '--type') return [flag];
    const choices = types.map((type) => ({ name: type, description: ticketTypeDescription(type) }));
    const shortcuts = types.map((type) => ({
      name: `${TYPE_SHORTCUT_PREFIX}${type}`,
      description: `Atalho para --type ${type}`,
    }));
    return [{ ...flag, choices }, ...shortcuts];
  });
  return {
    usage: `${CLI_PROGRAM_NAME} AGENT [OPTIONS] [TASK...]`,
    description: runAgentDescription(context),
    examples: RUN_AGENT_EXAMPLES,
    details: RUN_AGENT_DETAILS,
    flags: withChoices,
  };
}

/** `choliba list agents`: the agents with their details. */
export function listAgentsSpec(context: Pick<AgentsCliSpecContext, 'providers'>): CommandSpec {
  return {
    usage: `${LIST_PROGRAM_NAME} [OPTIONS]`,
    description:
      'Lista os agentes da pasta de trabalho, cada um com o id, a versão, os modelos, as skills, os modos e a política.',
    examples: [
      { description: 'Lista os agentes da pasta de trabalho', command: 'choliba list agents' },
      { description: 'Lista os agentes de outra pasta', command: 'choliba list agents --agents-dir ./agentes' },
    ],
    details:
      'Cada agente sai com o bloco que o `--help` dele mostra: id, nome, versão, descrição, modelos, skills, modos e a ' +
      'política. Os agentes ficam em `.choliba/agents/` (ou em `CHOL_AGENTS_DIR`); veja ' +
      '[Instalar agentes, skills e MCPs](../guias/instalar-agentes.md).',
    flags: [...agentsDirFlag(context), HELP_FLAG],
  };
}
