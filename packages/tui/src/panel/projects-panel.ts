import {
  listTicketKeys,
  loadProjectSettings,
  PROJECTS,
  readTickets,
  type ProjectsService,
  type TicketInfo,
} from '@choliba/projects';
import { CARD_RULE, type PanelCommand, type PanelCommandContext } from '@choliba/shell';

/** The context keys these commands set, as the panel's header shows them. */
const PROJECT = 'projeto';
const TICKET = 'ticket';
const DESCRIPTION = 'descrição';

/** The card's title in the panel's header. */
const CARD = 'projeto';

/**
 * The project's card: its name, what it is, where its active environment runs (or that its settings are not done
 * yet), and its tickets, with the active one; collapsed, its name and the active ticket, its tickets and environment,
 * and its address.
 */
function projectCard(
  projects: ProjectsService,
  project: string,
  description: string,
  ticket?: string,
): { readonly lines: readonly string[]; readonly summary: readonly string[] } {
  const projectsDir = projects.projectsDir();
  let place: string;
  // Collapsed, the environment beside the tickets, and the address on its own line without its scheme nor its last slash.
  let environmentName = '';
  let address: string;
  try {
    const { environment } = loadProjectSettings(projectsDir, project);
    place = `\u001b[90m${environment.nome} · ${environment.baseURL}\u001b[39m`;
    environmentName = environment.nome;
    address = `\u001b[90m${environment.baseURL.replace(/^https?:\/\//, '').replace(/\/$/, '')}\u001b[39m`;
  } catch {
    place = '\u001b[33mconfiguração incompleta: choliba check ' + project + '\u001b[39m';
    address = place;
  }
  const count = listTicketKeys(projectsDir, project).length;
  const tickets = `${String(count)} ${count === 1 ? 'ticket' : 'tickets'}`;
  const name = `\u001b[1m\u001b[36m${project}\u001b[39m\u001b[22m`;
  const status = ticket === undefined ? tickets : `${tickets} · ativo \u001b[1m${ticket}\u001b[22m`;
  const about = description === '' ? '\u001b[90msem descrição\u001b[39m' : description;
  const active = ticket === undefined ? name : `${name} · ativo \u001b[1m${ticket}\u001b[22m`;
  // A rule under its name and another before its tickets, so each part reads on its own.
  return {
    lines: [name, CARD_RULE, about, place, CARD_RULE, status],
    summary: [
      active,
      environmentName === '' ? tickets : `${tickets} \u001b[90m· ${environmentName}\u001b[39m`,
      address,
    ],
  };
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

/** The active ticket, chosen among the active project's, and its summary; Esc leaves the ticket as it was. */
async function chooseTicket({ container, panel, context }: PanelCommandContext): Promise<void> {
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
    description: 'O ticket em que os testes e os agentes vão agir. Esc deixa como está.',
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
  panel.write([`Ticket \u001b[1m${ticket.id}\u001b[22m selecionado.`, ...ticketSummary(ticket)].join('\n'));
}

/**
 * `/projects`: the active project, chosen among the workspace's; another one clears the active ticket and, when it has
 * tickets, asks for one at once.
 */
const projectsPanelCommand: PanelCommand = {
  name: 'projects',
  description: 'Escolhe o projeto em que o painel age',
  run: async (command: PanelCommandContext) => {
    const { container, panel, context } = command;
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
    panel.write(`Projeto \u001b[1m${project.name}\u001b[22m selecionado.`);
    if (listTicketKeys(container.get(PROJECTS).projectsDir(), project.name).length > 0) await chooseTicket(command);
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
  run: chooseTicket,
};

/** The project and ticket commands the TUI brings to `choliba panel`. */
export const projectsPanel: readonly PanelCommand[] = [projectsPanelCommand, ticketsPanelCommand];
