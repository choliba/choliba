import { describeStep, runPlaceOf, wrapInstructions, type DryRunInput } from '@choliba/engine';

export type { DryRunInput } from '@choliba/engine';

/** One numbered entry: who does it (the CLI or the agent) and what, one line each. */
interface Entry {
  readonly who: 'CLI' | 'agente';
  readonly lines: readonly [string, ...string[]];
}

type AgentRequest = DryRunInput['request'];
type AgentMcps = AgentRequest['agent']['mcps'];
type ModeSteps = AgentRequest['agent']['steps'][AgentRequest['mode']];
type Mounts = NonNullable<DryRunInput['container']>['mounts'];
type PathAccess = Mounts[number]['access'];

/** An argument longer than this is shown by its size instead (the prompts, a JSON config). */
const LONG_ARG_BYTES = 200;

const INDENT = ' '.repeat(13);

/** The model of a run as the dry run and the run's log say it: its name, or the provider's default when it has none. */
export function modelText(model: string | undefined): string {
  return model ?? 'padrão do provider';
}

function bytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function beforeEntries(steps: ModeSteps['before'], prefix: string): readonly Entry[] {
  if (steps.length === 0) {
    return [{ who: 'CLI', lines: [`${prefix}: nada`] }];
  }
  return steps.map((step, index) => ({
    who: 'CLI',
    lines: [
      `${prefix} ${String(index + 1)}/${String(steps.length)} — ${describeStep(step)}`,
      'se falhar: para aqui, o agente não roda',
    ],
  }));
}

/** One block of `after`: its title, then each step on a line of its own, or `nada`. */
function afterLines(title: string, steps: ModeSteps['after']['success']): readonly [string, ...string[]] {
  if (steps.length === 0) {
    return [`${title}: nada`];
  }
  return [
    `${title}:`,
    ...steps.map((step, index) => `  ${String(index + 1)}/${String(steps.length)} ${describeStep(step)}`),
  ];
}

function mcpSummary(mcp: AgentMcps[number]): string {
  return mcp.tools === undefined ? `${mcp.name} (todas as tools)` : `${mcp.name} (${String(mcp.tools.length)} tools)`;
}

function listOr(items: readonly string[], none: string): string {
  return items.length === 0 ? none : items.join(', ');
}

/** An argument as it reads on a command line: the prompts by name, long ones by size, quoted when needed. */
function argLabel(arg: string, prompts: Readonly<Record<string, string>>): string {
  const named = prompts[arg];
  if (named !== undefined) {
    return named;
  }
  if (bytes(arg) > LONG_ARG_BYTES) {
    return `<${String(bytes(arg))} bytes>`;
  }
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

function agentEntry(input: DryRunInput, systemPrompt: string): Entry {
  const { request } = input;
  const user = request.userPrompt;
  const prompts = {
    [user]: '<prompt do usuário>',
    [systemPrompt]: '<prompt de sistema>',
    [`${systemPrompt}\n\n${user}`]: '<prompt de sistema + prompt do usuário>',
  };
  const commandLine = [...input.command, ...input.args].map((arg) => argLabel(arg, prompts)).join(' ');
  const hint = input.showPrompt ? '' : ' (--show-prompt mostra os dois)';
  return {
    who: 'agente',
    lines: [
      `${input.providerId} · modelo ${modelText(request.model)} · modo ${request.mode} · na pasta ${request.runDir}`,
      `skills: ${listOr(
        request.agent.skills.map((skill) => skill.name),
        'nenhuma',
      )} · MCPs: ${listOr(request.agent.mcps.map(mcpSummary), 'nenhum')}`,
      `prompt de sistema: ${String(bytes(systemPrompt))} bytes · prompt do usuário: ${String(bytes(user))} bytes${hint}`,
      `comando: ${commandLine}`,
      ...containerLines(input.container),
      ...localLines(input.local),
    ],
  };
}

/** How `--dry-run` and the panel's sandbox card name what a path is to the agent. */
export const ACCESS_LABEL: Readonly<Record<PathAccess, string>> = {
  read: 'leitura',
  write: 'escrita',
  hidden: 'oculto ',
};

/** The container the provider runs in and, one per line, what it sees; nothing on this machine. */
function containerLines(container: DryRunInput['container']): readonly string[] {
  if (container === undefined) return [];
  return [
    `num container (docker, imagem ${container.image}), que só vê:`,
    ...mountLines(container.mounts),
    ...container.skipped.map((path) => `  ignorado ${path} (da imagem)`),
  ];
}

/** What `bwrap` mounts on this machine; nothing when the run is in a container. */
function localLines(local: DryRunInput['local']): readonly string[] {
  if (local === undefined) return [];
  return [
    'no bwrap, que só vê:',
    ...mountLines(local.mounts),
    ...local.skipped.map((path) => `  ignorado ${path} (do sistema)`),
  ];
}

function mountLines(mounts: Mounts): readonly string[] {
  return mounts.map((mount) => `  ${ACCESS_LABEL[mount.access]} ${mount.path}`);
}

function formatEntry(entry: Entry, index: number): string {
  const number = `${String(index + 1)}.`.padStart(3);
  const who = `[${entry.who}]`.padEnd(9);
  const [first, ...rest] = entry.lines;
  return [`${number} ${who}${first}`, ...rest.map((line) => `${INDENT}${line}`)].join('\n');
}

/** The title of the command line in full, one JSON string per argument, under `--show-prompt`. */
export const COMMAND_LINE_TITLE = 'linha de comando completa (JSON)';

function section(title: string, body: string): string {
  return `── ${title} ──\n${body.trimEnd()}`;
}

/** What the CLI does with the project's application before the run: its setup, then making sure it is up. */
function appEntries(app: DryRunInput['app'], agentBaseURL: string | undefined): readonly Entry[] {
  if (app === undefined) return [];
  const up =
    app.start === undefined
      ? `confere ${app.baseURL}: sem resposta, para aqui (o ambiente não tem envs[].start)`
      : `sobe a aplicação com "${app.start}" se ${app.baseURL} não responder, e a derruba no fim`;
  const reach =
    agentBaseURL === undefined || agentBaseURL === app.baseURL
      ? []
      : [`o agente, no container, a acessa em ${agentBaseURL}`];
  const setup = app.setup ?? [];
  const lines: Entry['lines'] =
    setup.length === 0 ? [up, ...reach] : [`roda o setup: ${setup.join(', ')}`, up, ...reach];
  return [{ who: 'CLI', lines }];
}

/**
 * `--dry-run`: what the command line would do without it, in order — the `before` steps, the
 * ticket it would create, the agent (provider, model, mode, skills, MCPs, prompt sizes, command
 * line), the `after` steps and the ticket check. Nothing is run or written. With `--show-prompt`,
 * the prompts and the command line in full, and the files the provider would write, follow.
 */
export function formatDryRun(input: DryRunInput): string {
  const { request } = input;
  const { mode } = request;
  const steps = request.agent.steps[mode];
  const systemPrompt = wrapInstructions(request.agent, request.skillsInstruction, runPlaceOf(request));
  const ticketCreated: readonly Entry[] =
    input.newTicket === undefined ? [] : [{ who: 'CLI', lines: [`cria o ticket ${input.newTicket}`] }];
  const ticketClosed: readonly Entry[] = input.hasTicket
    ? [
        {
          who: 'CLI',
          lines: [
            'fecha o ticket: apaga um ticket novo que o agente não preencheu; em execute, falha com CHANGE_ME ou fora do modelo',
          ],
        },
      ]
    : [];
  const after: Entry = {
    who: 'CLI',
    lines: [
      ...afterLines(`${mode}.after.success (se o agente sair com 0)`, steps.after.success),
      ...afterLines(`${mode}.after.failure (se o agente falhar)`, steps.after.failure),
      ...afterLines(`${mode}.after.always`, steps.after.always),
    ],
  };
  const entries: readonly Entry[] = [
    ...appEntries(input.app, request.project?.agentBaseURL),
    ...beforeEntries(steps.before, `${mode}.before`),
    ...ticketCreated,
    agentEntry(input, systemPrompt),
    after,
    ...ticketClosed,
  ];
  const plan = ['Sem --dry-run, faria nesta ordem:', '', ...entries.map(formatEntry)].join('\n');
  if (!input.showPrompt) {
    return plan;
  }
  return [
    plan,
    section('prompt de sistema', systemPrompt),
    section('prompt do usuário', request.userPrompt),
    section(COMMAND_LINE_TITLE, JSON.stringify([...input.command, ...input.args])),
    ...input.workspaceFiles.map((file) => section(file.path, file.content)),
  ].join('\n\n');
}
