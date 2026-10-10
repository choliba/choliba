import { messageOf, type Ask, type ShellIo } from '@choliba/core';

import { commandHelp, PROGRAM_NAME, UsageError } from '../common';
import { parseNewProjectArgs, resolveNewProject, type NewProject } from './new-project';
import type { CreatedProject } from './project';
import type { ProjectsService } from './projects.service';

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
    `Confira com: bunx choliba projects check ${project.name}`,
  ].join('\n');
}

/**
 * `choliba projects new [NOME] [--app-dir DIR] [--base-url URL] [--no-input]`: a test project from the template.
 * Everything is optional; on a terminal, `ask` asks for what is missing.
 */
export async function runProjectsNew(
  io: ShellIo,
  projects: ProjectsService,
  cwd: string,
  ask: Ask | undefined,
): Promise<void> {
  const args = io.args('projects', 'new');
  if (io.wantsHelp(args)) {
    io.printHelp(commandHelp(projects.helpSpec(), 'new'));
    return;
  }
  try {
    const project = await resolveNewProject(parseNewProjectArgs(args), cwd, ask);
    const { dir, created } = projects.create(project);
    io.write(`${report(project, dir, created)}\n`);
  } catch (error) {
    if (error instanceof UsageError) io.usageError(error.message, PROGRAM_NAME);
    else io.fail(messageOf(error));
  }
}
