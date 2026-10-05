import type { AgentStep, McpDeclaration } from '../agents/interfaces/agent.interface';
import { describeStep } from '../steps/actions';
import { wrapInstructions } from './prompt';
import type { PlannedFile, ProviderRequest } from '../providers/provider.types';

/** What `--dry-run` shows: everything a real run of this command line would do, in order. */
export interface DryRunInput {
  readonly providerId: string;
  /** The provider's binary (`claude`, `cursor agent`...), and the arguments after it. */
  readonly command: readonly string[];
  readonly args: readonly string[];
  readonly request: ProviderRequest;
  /** Where `--type` would create the ticket; `undefined` without `--type`. */
  readonly newTicket: string | undefined;
  /** Whether the run has a ticket, which the CLI checks once the agent is done. */
  readonly hasTicket: boolean;
  /** `--show-prompt`: the prompts and the command line in full, and the files the provider would write. */
  readonly showPrompt: boolean;
  readonly workspaceFiles: readonly PlannedFile[];
}

/** One numbered entry: who does it (the CLI or the agent) and what, one line each. */
interface Entry {
  readonly who: 'CLI' | 'agente';
  readonly lines: readonly [string, ...string[]];
}

/** An argument longer than this is shown by its size instead (the prompts, a JSON config). */
const LONG_ARG_BYTES = 200;

const INDENT = ' '.repeat(13);

function bytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function beforeEntries(steps: readonly AgentStep[], prefix: string): readonly Entry[] {
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
function afterLines(title: string, steps: readonly AgentStep[]): readonly [string, ...string[]] {
  if (steps.length === 0) {
    return [`${title}: nada`];
  }
  return [
    `${title}:`,
    ...steps.map((step, index) => `  ${String(index + 1)}/${String(steps.length)} ${describeStep(step)}`),
  ];
}

function mcpSummary(mcp: McpDeclaration): string {
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
      `${input.providerId} · modelo ${request.model ?? 'padrão do provider'} · modo ${request.mode} · na pasta ${request.runDir}`,
      `skills: ${listOr(
        request.agent.skills.map((skill) => skill.name),
        'nenhuma',
      )} · MCPs: ${listOr(request.agent.mcps.map(mcpSummary), 'nenhum')}`,
      `prompt de sistema: ${String(bytes(systemPrompt))} bytes · prompt do usuário: ${String(bytes(user))} bytes${hint}`,
      `comando: ${commandLine}`,
    ],
  };
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
  const systemPrompt = wrapInstructions(request.agent, request.skillsInstruction, {
    runDir: request.runDir,
    root: request.workspaceRoot,
  });
  const ticketCreated: readonly Entry[] =
    input.newTicket === undefined ? [] : [{ who: 'CLI', lines: [`cria o ticket ${input.newTicket}`] }];
  const ticketClosed: readonly Entry[] = input.hasTicket
    ? [
        {
          who: 'CLI',
          lines: [
            'fecha o ticket: apaga um ticket novo que o agente não preencheu; em execute, falha se sobrar CHANGE_ME',
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
