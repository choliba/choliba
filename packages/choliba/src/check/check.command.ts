import {
  CONFIG,
  messageOf,
  type CommandEntry,
  type CommandSpec,
  type Container,
  type ShellCommand,
  type ShellIo,
} from '@choliba/core';
import { PROJECTS, projectCompletions } from '@choliba/projects';

import { allFine, checkWorkspace, formatCheck } from './check';

const DESCRIPTION =
  'Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos; com PROJETO, só esse projeto';

/** `check`'s spec: PROJETO completes to the projects on disk, read on every call. */
function checkSpec(container: Container): CommandSpec {
  const { projectOnly } = projectCompletions(() => container.get(PROJECTS).projectsDir());
  return {
    usage: 'choliba check [PROJETO]',
    description: DESCRIPTION,
    positionals: projectOnly,
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
  };
}

/** How `choliba --help` lists `check`. */
function entry(container: Container): CommandEntry {
  return { name: 'check', description: DESCRIPTION, group: 'Commands', spec: checkSpec(container) };
}

/** `choliba check PROJETO`: the project is ready to run (files, active environment, no CHANGE_ME), or why not. */
function checkProject(container: Container, io: ShellIo, project: string): void {
  try {
    const { config, environment } = container.get(PROJECTS).check(project);
    io.write(`Projeto "${project}" (${config.name}) pronto: ambiente ${environment.nome}, ${environment.baseURL}\n`);
  } catch (error) {
    io.fail(messageOf(error));
  }
}

/**
 * `choliba check [PROJETO]`: the agents (schemas, skills, MCPs) and the projects of the workspace, or one project;
 * exit 1 when any is wrong.
 */
export const checkCommand: ShellCommand = {
  name: 'check',
  help: (container) => [entry(container)],
  run: (container, io) => {
    const args = io.args('check');
    if (io.wantsHelp(args)) {
      io.printHelp(checkSpec(container));
      return Promise.resolve();
    }
    const [project, ...extra] = args;
    if (extra.length > 0) {
      io.usageError(`argumento a mais: ${extra.join(' ')}.`, 'choliba check');
      return Promise.resolve();
    }
    if (project !== undefined) {
      checkProject(container, io, project);
      return Promise.resolve();
    }
    const config = container.get(CONFIG);
    const root = config.workspaceRoot();
    const sections = checkWorkspace(root, config.load(root));
    io.write(`${formatCheck(sections)}\n`);
    io.exit(allFine(sections) ? 0 : 1);
    return Promise.resolve();
  },
};
