import {
  CONFIG,
  messageOf,
  PLATFORM,
  type Ask,
  type CommandEntry,
  type ShellCommand,
  type ShellIo,
} from '@choliba/core';

import { programOf, UsageError } from '../common';
import { parseNewProjectArgs, resolveNewProject, type NewProject } from './new-project';
import type { CreatedProject } from './project';
import { PROJECTS } from './projects.constants';
import type { ProjectsService } from './projects.service';
import { newProjectSpec } from './projects-spec';

const PATH: readonly string[] = ['new', 'project'];

/** The fields of `config.json` the project still has to fill in, as the report names them. */
function stillMissing(project: NewProject): readonly string[] {
  return [...(project.appDir === undefined ? ['appDir'] : []), ...(project.baseUrl === undefined ? ['baseURL'] : [])];
}

/** Where the description came from, or why it stayed empty; nothing without an application folder. */
function describeCreated(created: CreatedProject, appDir: string | undefined): readonly string[] {
  if (appDir === undefined) return [];
  if (created.description !== undefined) {
    return [`description preenchido a partir de ${String(created.readme)}: "${created.description}"`];
  }
  return created.readme === undefined
    ? [`Nenhum README na raiz de ${appDir}; description ficou vazio.`]
    : [`${created.readme} não tem título nem parágrafo aproveitáveis; description ficou vazio.`];
}

function report(project: NewProject, dir: string, created: CreatedProject): string {
  const missing = stillMissing(project);
  return [
    `Projeto "${project.name}" criado em ${dir}.`,
    ...describeCreated(created, project.appDir),
    ...(missing.length === 0 ? [] : [`Falta preencher no config.json: ${missing.join(' e ')}.`]),
    'Antes de rodar: copie .env.example.json para .env.json e troque os CHANGE_ME.',
    `Confira com: bunx choliba check ${project.name}`,
  ].join('\n');
}

/**
 * `choliba new project [NOME] [--app-dir DIR] [--base-url URL] [--no-input]`: a test project from the template.
 * Everything is optional; on a terminal, `ask` asks for what is missing.
 */
export async function runProjectsNew(
  io: ShellIo,
  projects: ProjectsService,
  cwd: string,
  ask: Ask | undefined,
): Promise<void> {
  const args = io.args(...PATH);
  if (io.wantsHelp(args)) {
    io.printHelp(newProjectSpec());
    return;
  }
  try {
    const project = await resolveNewProject(parseNewProjectArgs(args), cwd, ask);
    const { dir, created } = projects.create(project);
    io.write(`${report(project, dir, created)}\n`);
  } catch (error) {
    if (error instanceof UsageError) io.usageError(error.message, programOf(PATH));
    else io.fail(messageOf(error));
  }
}

/** How `choliba new --help` lists `project`. */
const NEW_ENTRY: CommandEntry = {
  name: 'project',
  description: 'Cria um projeto a partir do modelo; o que faltar é perguntado no terminal',
  group: 'Commands',
  spec: newProjectSpec(),
};

/** `choliba new project [NOME] [--app-dir DIR] [--base-url URL] [--no-input]`. */
export const newProjectCommand: ShellCommand = {
  verb: 'new',
  name: 'project',
  help: () => [NEW_ENTRY],
  run: (container, io) =>
    runProjectsNew(io, container.get(PROJECTS), container.get(CONFIG).startDir(), container.get(PLATFORM).ask),
};
