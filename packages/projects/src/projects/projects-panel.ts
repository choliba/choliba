import { CARD_RULE, type PanelCommand, type PanelCommandContext } from '@choliba/core';

import { listTicketKeys, readTickets, type TicketInfo } from '../tickets';
import { loadProjectSettings } from './project-settings';
import { PROJECTS } from './projects.constants';
import type { ProjectsService } from './projects.service';

/** The context keys these commands set, as the panel's header shows them. */
const PROJECT = 'projeto';
const TICKET = 'ticket';
const DESCRIPTION = 'descrição';

/** The card's title in the panel's header. */
const CARD = 'projeto';

/**
 * The project's card: its name, what it is, where its active environment runs (or that its settings are not done
 * yet), and its tickets, with the active one; collapsed, its name and its tickets.
 */
function projectCard(
  projects: ProjectsService,
  project: string,
  description: string,
  ticket?: string,
): { readonly lines: readonly string[]; readonly summary: string } {
  const projectsDir = projects.projectsDir();
  let place: string;
  try {
    const { environment } = loadProjectSettings(projectsDir, project);
    place = `\u001b[90m${environment.nome} · ${environment.baseURL}\u001b[39m`;
  } catch {
    place = '\u001b[33mconfiguração incompleta: choliba check ' + project + '\u001b[39m';
  }
  const count = listTicketKeys(projectsDir, project).length;
  const tickets = `${String(count)} ${count === 1 ? 'ticket' : 'tickets'}`;
  const name = `\u001b[1m\u001b[36m${project}\u001b[39m\u001b[22m`;
  const status = ticket === undefined ? tickets : `${tickets} · ativo \u001b[1m${ticket}\u001b[22m`;
  const about = description === '' ? '\u001b[90msem descrição\u001b[39m' : description;
  // A rule under its name and another before its tickets, so each part reads on its own.
  return { lines: [name, CARD_RULE, about, place, CARD_RULE, status], summary: `${name} · ${status}` };
}

/** A ticket's summary in the panel: its title, then each criterion and whether a test covers it. */
function ticketSummary(ticket: TicketInfo): readonly string[] {
  const covered = ticket.criteria.filter((criterion) => criterion.tests.length > 0).length;
  return [
    `\u001b[1m${ticket.id}\u001b[22m ${ticket.title ?? ''}`.trimEnd(),
    ...ticket.criteria.map(
      (criterion) =>
        `  ${criterion.tests.length > 0 ? '\u001b[32m✔\u001b[39m' : '\u001b[90m·\u001b[39m'} ${criterion.id} ` +
        (criterion.description[0] ?? ''),
    ),
    `\u001b[90m${String(covered)} de ${String(ticket.criteria.length)} critérios com teste.\u001b[39m`,
  ];
}

/** `/projects`: the active project, chosen among the workspace's; another one clears the active ticket. */
const projectsPanelCommand: PanelCommand = {
  name: 'projects',
  description: 'Escolhe o projeto em que o painel age',
  run: async ({ container, panel, context }: PanelCommandContext) => {
    const projects = container.get(PROJECTS).list();
    if (projects.length === 0) {
      panel.write('Nenhum projeto na pasta de projetos. Crie um com `choliba new project`.');
      return;
    }
    const active = context.get(PROJECT);
    const chosen = await panel.choose({
      title: 'Escolha o projeto',
      description: 'O projeto em que os tickets, os testes e os agentes vão agir.',
      options: projects.map((project) => ({
        label: project.name,
        detail: project.description,
        current: project.name === active,
      })),
    });
    const project = chosen === undefined ? undefined : projects[chosen];
    if (project === undefined || project.name === active) return;
    context.set(PROJECT, project.name);
    context.set(TICKET, undefined);
    context.set(DESCRIPTION, project.description);
    const card = projectCard(container.get(PROJECTS), project.name, project.description);
    context.show(CARD, { ...card, key: 'p', order: 2 });
    panel.write(`Projeto ativo: \u001b[1m${project.name}\u001b[22m.`);
  },
};

/** `/tickets`: the active ticket, chosen among the active project's, and its summary. */
const ticketsPanelCommand: PanelCommand = {
  name: 'tickets',
  description: 'Escolhe o ticket do projeto ativo',
  unavailable: (context, container) => {
    const project = context.get(PROJECT);
    if (project === undefined) return 'Escolha um projeto antes, com /projects';
    return listTicketKeys(container.get(PROJECTS).projectsDir(), project).length === 0
      ? `O projeto ${project} ainda não tem tickets`
      : undefined;
  },
  run: async ({ container, panel, context }: PanelCommandContext) => {
    const project = context.get(PROJECT);
    if (project === undefined) return;
    const tickets = readTickets(container.get(PROJECTS).projectsDir(), project);
    if (tickets.length === 0) {
      panel.write(`O projeto ${project} ainda não tem tickets.`);
      return;
    }
    const active = context.get(TICKET);
    const chosen = await panel.choose({
      title: `Escolha o ticket de ${project}`,
      description: 'O ticket em que os testes e os agentes vão agir.',
      options: tickets.map((ticket) => ({
        label: ticket.id,
        ...(ticket.title === undefined ? {} : { detail: ticket.title }),
        current: ticket.id === active,
      })),
    });
    const ticket = chosen === undefined ? undefined : tickets[chosen];
    if (ticket === undefined) return;
    context.set(TICKET, ticket.id);
    const card = projectCard(container.get(PROJECTS), project, context.get(DESCRIPTION) ?? '', ticket.id);
    context.show(CARD, { ...card, key: 'p', order: 2 });
    panel.write(ticketSummary(ticket).join('\n'));
  },
};

/** What @choliba/projects brings to `choliba panel`. */
export const projectsPanel: readonly PanelCommand[] = [projectsPanelCommand, ticketsPanelCommand];
