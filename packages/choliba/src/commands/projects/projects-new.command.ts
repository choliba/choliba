import { messageOf, PLATFORM, type CommandEntry, type ShellCommand, type ShellIo } from '@choliba/shell';
import { type Ask } from '@choliba/kernel';
import { PROJECTS } from '@choliba/tui';
import type { ProjectsService } from '@choliba/tui';
import { UsageError, type CreatedProject } from '@choliba/workspace';
import { parseNewProjectArgs, resolveNewProject, type NewProject } from '../../projects';

import { newProjectSpec } from './projects-spec';

const PATH: readonly string[] = ['new', 'project'];

function stillMissing(project: NewProject): readonly string[] {
  return [...(project.appDir === undefined ? ['appDir'] : []), ...(project.baseUrl === undefined ? ['baseURL'] : [])];
}

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
    `Confira com: bun choliba check ${project.name}`,
  ].join('\n');
}

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
    if (error instanceof UsageError) io.usageError(error.message, 'choliba new project');
    else io.fail(messageOf(error));
  }
}

const NEW_ENTRY: CommandEntry = {
  name: 'project',
  description: 'Cria um projeto a partir do modelo; o que faltar é perguntado no terminal',
  group: 'Commands',
  spec: newProjectSpec(),
};

export const newProjectCommand: ShellCommand = {
  verb: 'new',
  name: 'project',
  help: () => [NEW_ENTRY],
  run: (container, io) =>
    runProjectsNew(io, container.get(PROJECTS), container.get(PLATFORM).cwd, container.get(PLATFORM).ask),
};
