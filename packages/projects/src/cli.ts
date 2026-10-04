import path from 'node:path';

import type { CommandSpec } from '@choliba/core/cli';
import { complete, describe, formatHelp, formatRows, formatSuggestions } from '@choliba/core/cli';
import type { Writable } from '@choliba/terminal/output';

import { PROGRAM_NAME, projectsCliSpec } from './cli-spec';
import type { ProjectLocations } from './locations';
import { REPORT_FOLDER } from './results';
import { loadProjectSettings } from './settings';
import type { CreatedProject } from './project';
import {
  createProject,
  listProjectNames,
  projectDir,
  projectEnvExampleFile,
  projectEnvFile,
  readProjectConfig,
} from './project';
import { createTicket, ticketTemplatesDir } from './ticket-template';
import {
  listTicketKeys,
  resolveReportFolder,
  resolveTicketRunsRoot,
  resolveTicketSpecFiles,
  resolveTicketsFolder,
} from './ticket';

export interface ProjectsCliDeps {
  loadConfig: () => ProjectLocations;
  templatesDir: string;
  /** Where a relative `--app-dir` is resolved from; the process's own directory by default. */
  cwd?: string;
  stdout: Writable;
  stderr: Writable;
}

const USAGE = `Run '${PROGRAM_NAME} --help' for usage.`;

function failUsage(deps: ProjectsCliDeps, message: string): number {
  deps.stderr.write(`${message}\n\n${USAGE}\n`);
  return 1;
}

/** `--help`, `-h` and `help` print the full help; `<command> --help` prints that command's. */
function runHelp(spec: CommandSpec, args: readonly string[], deps: ProjectsCliDeps): number | undefined {
  const [command] = args;
  const entry = spec.commands?.().find((candidate) => candidate.name === command);
  if (entry !== undefined && args.some((arg) => arg === '--help' || arg === '-h')) {
    deps.stdout.write(`${formatHelp({ ...entry.spec, description: entry.description })}\n`);
    return 0;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    deps.stdout.write(`${formatHelp(spec)}\n`);
    return 0;
  }
  return undefined;
}

/** `--flag value`: the value, or `missing` when the flag is the last word or is followed by nothing. */
function flagValue(args: readonly string[], name: string): { name: string; value?: string; missing: boolean } {
  const index = args.indexOf(name);
  if (index === -1) return { name, missing: false };
  const value = args[index + 1];
  return value && !value.startsWith('--') ? { name, value, missing: false } : { name, missing: true };
}

/** The first word after the command that is neither a flag nor the value of one of `valueFlags`. */
function positional(args: readonly string[], valueFlags: readonly string[]): string | undefined {
  const rest = args.slice(1);
  return rest.find((arg, index) => !arg.startsWith('--') && !valueFlags.includes(rest[index - 1] ?? ''));
}

/** A project's `config.json#description`; empty when it has none or the file cannot be read. */
function projectDescription(projectsDir: string, project: string): string {
  try {
    const description = readProjectConfig(projectsDir, project)['description'];
    return typeof description === 'string' ? description : '';
  } catch {
    return '';
  }
}

/** Where the new project's `description` came from, or why it stayed empty. */
function describeCreated(created: CreatedProject, appDir: string): string {
  if (created.description !== undefined) {
    return `description preenchido a partir de ${String(created.readme)}: "${created.description}"\n`;
  }
  return created.readme === undefined
    ? `Nenhum README na raiz de ${appDir}; description ficou vazio.\n`
    : `${created.readme} não tem título nem parágrafo aproveitáveis; description ficou vazio.\n`;
}

export function runProjectsCli(argv: readonly string[], deps: ProjectsCliDeps): number {
  const args = argv.slice(2);
  const command = args[0];
  const spec = projectsCliSpec(() => deps.loadConfig().CHOL_PROJECTS_DIR);

  if (command === '__complete') {
    const output = formatSuggestions(complete(spec, args.slice(1)));
    if (output !== '') {
      deps.stdout.write(`${output}\n`);
    }
    return 0;
  }
  if (command === '__describe') {
    deps.stdout.write(`${describe(spec, args.slice(1))}\n`);
    return 0;
  }
  const helpExit = runHelp(spec, args, deps);
  if (helpExit !== undefined) {
    return helpExit;
  }

  if (!command) {
    return failUsage(deps, 'Missing command.');
  }

  try {
    switch (command) {
      case 'tickets-folder': {
        const project = args[1];
        if (!project) return failUsage(deps, 'Missing project for tickets-folder.');
        const { CHOL_PROJECTS_DIR: projectsDir } = deps.loadConfig();
        deps.stdout.write(`${resolveTicketsFolder(projectsDir, project)}\n`);
        return 0;
      }
      case 'check-project': {
        const project = args[1];
        if (!project) return failUsage(deps, 'Missing project for check-project.');
        const { config, environment } = loadProjectSettings(deps.loadConfig().CHOL_PROJECTS_DIR, project);
        deps.stdout.write(
          `Projeto "${project}" (${config.name}) pronto: ambiente ${environment.nome}, ${environment.baseURL}\n`,
        );
        return 0;
      }
      case 'report-folder': {
        const project = args[1];
        const ticket = args[2];
        if (!project) {
          deps.stdout.write(`${REPORT_FOLDER}\n`);
          return 0;
        }
        const ticketRunsRoot = resolveTicketRunsRoot(deps.loadConfig());
        deps.stdout.write(`${resolveReportFolder(ticketRunsRoot, project, ticket ?? undefined)}\n`);
        return 0;
      }
      case 'ticket-specs': {
        const project = args[1];
        const ticket = args[2];
        if (!project || !ticket) return failUsage(deps, 'Missing project or ticket for ticket-specs.');
        const { CHOL_PROJECTS_DIR: projectsDir } = deps.loadConfig();
        for (const spec of resolveTicketSpecFiles(projectsDir, project, ticket)) {
          deps.stdout.write(`${spec}\n`);
        }
        return 0;
      }
      case 'list-projects': {
        const withTickets = args.includes('--tickets');
        const { CHOL_PROJECTS_DIR: projectsDir } = deps.loadConfig();
        const projects = listProjectNames(projectsDir);
        if (projects.length === 0) {
          deps.stdout.write(`No project found in ${projectsDir}.\n`);
          return 0;
        }
        if (withTickets) {
          // One `project ["key", …]` line per project: the product-owner agent reads this format.
          for (const project of projects) {
            deps.stdout.write(`${project} ${JSON.stringify(listTicketKeys(projectsDir, project))}\n`);
          }
          return 0;
        }
        deps.stdout.write(
          `${formatRows(projects.map((project) => [project, projectDescription(projectsDir, project)]))}\n`,
        );
        return 0;
      }
      case 'create-ticket': {
        const project = args[1];
        const type = args[2];
        if (!project || !type) return failUsage(deps, 'Missing project or type for create-ticket.');
        const { CHOL_PROJECTS_DIR: projectsDir } = deps.loadConfig();
        const settings = loadProjectSettings(projectsDir, project);
        const created = createTicket(projectsDir, project, type, ticketTemplatesDir(), {
          environment: settings.environment.nome,
        });
        deps.stdout.write(`Ticket "${created.ticket}" criado em ${created.path}. Troque os valores CHANGE_ME.\n`);
        return 0;
      }
      case 'create-project': {
        const flags = { baseUrl: flagValue(args, '--base-url'), appDir: flagValue(args, '--app-dir') };
        const missingValue = Object.values(flags).find((flag) => flag.missing);
        if (missingValue !== undefined) return failUsage(deps, `Missing value for ${missingValue.name}.`);
        if (flags.appDir.value === undefined) {
          return failUsage(deps, 'Missing --app-dir for create-project: the folder with the application code.');
        }
        // A relative --app-dir means "from here", as anywhere on a command line; it is saved absolute,
        // so config.json does not depend on where the project lives. Without a name, the project is
        // named after that folder.
        const appDir = path.resolve(deps.cwd ?? process.cwd(), flags.appDir.value);
        const project = positional(args, ['--base-url', '--app-dir']) ?? path.basename(appDir);
        const { CHOL_PROJECTS_DIR: projectsDir } = deps.loadConfig();
        const created = createProject(projectsDir, project, deps.templatesDir, {
          appDir,
          ...(flags.baseUrl.value === undefined ? {} : { baseUrl: flags.baseUrl.value }),
        });
        const dir = projectDir(projectsDir, project);
        deps.stdout.write(`Projeto "${project}" criado em ${dir}.\n${describeCreated(created, appDir)}`);
        deps.stdout.write(
          `Antes de usar: crie ${projectEnvFile(dir)} a partir de ${projectEnvExampleFile(dir)} ` +
            `e troque os valores CHANGE_ME (config.json e .env.json).\n`,
        );
        return 0;
      }
      default:
        return failUsage(deps, `Unknown command "${command}".`);
    }
  } catch (err) {
    deps.stderr.write(`${(err as Error).message}\n`);
    return 1;
  }
}
