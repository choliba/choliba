import { existsSync, readFileSync, rmSync } from 'node:fs';

import {
  canonicalTicket,
  createTicket,
  loadProjectSettings,
  planTicket,
  ticketJsonPath,
  ticketPlaceholders,
  ticketTemplatesDir,
} from '@choliba/projects';

import type { AgentDefinition } from '../agent.types';
import type { ExecutionMode } from '../command.types';

export class TicketRunError extends Error {}

/** The ticket a run works on, and — for `--type` — the arguments to create it right before the provider starts. */
export interface TicketTarget {
  readonly ticket: string;
  readonly file: string;
  readonly create?: { readonly projectsDir: string; readonly project: string; readonly type: string; readonly environment: string };
}

export interface TicketArgs {
  readonly project: string | undefined;
  readonly ticketType: string | undefined;
  readonly ticket: string | undefined;
}

/** `${TICKET}` and `${TICKET_FILE}` for the agent's system.md; none without a ticket. */
export function ticketVars(target: TicketTarget | undefined): Readonly<Record<string, string>> {
  return target === undefined ? {} : { TICKET: target.ticket, TICKET_FILE: target.file };
}

function newTicket(agent: AgentDefinition, types: readonly string[], project: string, type: string, projectsDir: string) {
  if (!types.includes(type)) {
    throw new TicketRunError(`"${agent.name}" não trabalha com tickets "${type}" (aceitos: ${types.join(', ')}).`);
  }
  const environment = loadProjectSettings(projectsDir, project).environment.nome;
  const planned = planTicket(projectsDir, project, type, ticketTemplatesDir(), { environment });
  return { ticket: planned.ticket, file: planned.path, create: { projectsDir, project, type, environment } };
}

function existingTicket(projectsDir: string, project: string, ticket: string): TicketTarget {
  const file = ticketJsonPath(projectsDir, project, ticket);
  if (!existsSync(file)) {
    throw new TicketRunError(`Ticket "${ticket}" não encontrado (${file} não existe).`);
  }
  return { ticket: canonicalTicket(projectsDir, project, ticket), file };
}

/**
 * The ticket of this run, checked before anything else happens. An agent with `ticket_types` needs
 * `--type` (a type it accepts, with a template) or `--ticket` (an existing ticket); any other agent
 * takes neither. For `--type` nothing is written yet: `createPlannedTicket` does it just before the
 * provider starts, so a run stopped by a later check leaves no file behind.
 */
export function resolveTicketTarget(
  agent: AgentDefinition,
  args: TicketArgs,
  projectsDir: () => string,
): TicketTarget | undefined {
  const types = agent.ticketTypes;
  if (types === undefined) {
    if (args.ticketType !== undefined || args.ticket !== undefined) {
      throw new TicketRunError(`"${agent.name}" não trabalha com tickets: --type e --ticket não se aplicam.`);
    }
    return undefined;
  }
  if (args.project === undefined) {
    throw new TicketRunError(`"${agent.name}" precisa de --project para achar o ticket.`);
  }
  if (args.ticketType !== undefined) {
    return newTicket(agent, types, args.project, args.ticketType, projectsDir());
  }
  if (args.ticket !== undefined) {
    return existingTicket(projectsDir(), args.project, args.ticket);
  }
  throw new TicketRunError(
    `"${agent.name}" precisa de --type <tipo> (ticket novo: ${types.join(', ')}) ou --ticket <chave> (ticket existente).`,
  );
}

/** Writes the ticket `--type` asked for and returns what was written; nothing for `--ticket`. */
export function createPlannedTicket(target: TicketTarget | undefined): string | undefined {
  if (target?.create === undefined) {
    return undefined;
  }
  const { projectsDir, project, type, environment } = target.create;
  const created = createTicket(projectsDir, project, type, ticketTemplatesDir(), { environment });
  if (created.path !== target.file) {
    rmSync(created.path, { force: true });
    throw new TicketRunError(`Outro ticket foi criado em ${target.file} durante esta execução; rode de novo.`);
  }
  return created.content;
}

/**
 * After the provider: a ticket created by this run and left exactly as written (the run failed, or
 * it only planned or answered) is removed; a ticket an `execute` run finished but left with `CHANGE_ME`
 * is reported, and the run fails. Returns the exit code the run ends with.
 */
export function finishTicket(
  target: TicketTarget | undefined,
  createdContent: string | undefined,
  mode: ExecutionMode,
  exitCode: number,
  stderr: { write: (chunk: string) => void },
): number {
  if (target === undefined || !existsSync(target.file)) {
    return exitCode;
  }
  if (createdContent !== undefined && readFileSync(target.file, 'utf8') === createdContent) {
    rmSync(target.file, { force: true });
    stderr.write(`Ticket "${target.ticket}" não foi preenchido; ${target.file} foi removido.\n`);
    return exitCode;
  }
  if (exitCode !== 0 || mode !== 'execute') {
    return exitCode;
  }
  const pending = ticketPlaceholders(target.file);
  if (pending.length === 0) {
    return exitCode;
  }
  stderr.write(`Ticket "${target.ticket}" ainda tem CHANGE_ME em: ${pending.join(', ')} (${target.file}).\n`);
  return 1;
}
