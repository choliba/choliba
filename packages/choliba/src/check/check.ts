import { existsSync, readdirSync } from 'node:fs';

import { definedConfig, resolveMcps, resolveSkills } from '@choliba/engine';
import { isValidAgentName } from '@choliba/domain';
import {
  resolveAgentsDir,
  resolveMcpsDir,
  resolveSkillsDir,
  projectLocations,
  listProjectNames,
  loadProjectSettings,
  retiredCriteria,
  ENV_FILE,
} from '@choliba/workspace';
import { loadAgent } from '../agents';

type Config = Readonly<Record<string, string | undefined>>;

/** One checked item: fine, or what is wrong with it (naming the file). */
export interface CheckItem {
  readonly name: string;
  readonly problem?: string;
}

export interface CheckSection {
  readonly title: string;
  readonly items: readonly CheckItem[];
}

/** The loaders and resolvers used here only throw `Error`s; their message names the file. */
function problemOf(error: unknown): string {
  return (error as Error).message;
}

/**
 * Every agent of the workspace, loaded as a run would load it: its agent.yaml against its standard,
 * the skills it lists and the MCP servers it lists, with their `${NAME}` variables from the config.
 */
export function checkAgents(root: string, config: Config): CheckSection {
  const dir = resolveAgentsDir(undefined, config, root);
  const title = `Agentes (${dir})`;
  if (!existsSync(dir)) {
    return { title, items: [{ name: dir, problem: 'a pasta não existe' }] };
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidAgentName(entry.name))
    .map((entry) => entry.name)
    .sort();
  const items: CheckItem[] = [];
  for (const name of names) {
    try {
      const agent = loadAgent(dir, name);
      resolveSkills(resolveSkillsDir(config, root), agent.skills);
      resolveMcps(resolveMcpsDir(config, root), agent.mcps, definedConfig(config));
      items.push({ name });
    } catch (error) {
      items.push({ name, problem: problemOf(error) });
    }
  }
  return { title, items };
}

/** Every project, checked as a run checks it: its files, the active environment, no `CHANGE_ME` left. */
export function checkProjects(_root: string, config: Config): CheckSection {
  let projectsDir: string;
  try {
    projectsDir = projectLocations({
      globalDir: config['CHOL_GLOBAL_DIR'],
      projectsDir: config['CHOL_PROJECTS_DIR'] ?? '',
      ticketRuns: config['CHOL_TICKET_RUNS'],
    }).CHOL_PROJECTS_DIR;
  } catch (error) {
    return { title: 'Projetos', items: [{ name: ENV_FILE, problem: problemOf(error) }] };
  }
  const title = `Projetos (${projectsDir})`;
  if (!existsSync(projectsDir)) {
    return { title, items: [{ name: projectsDir, problem: 'a pasta não existe' }] };
  }
  const items = listProjectNames(projectsDir).map((name): CheckItem => {
    try {
      loadProjectSettings(projectsDir, name);
      // A ticket that replaces a ticket or criterion that does not exist would stop every test run of the project.
      retiredCriteria(projectsDir, name);
      return { name };
    } catch (error) {
      return { name, problem: problemOf(error) };
    }
  });
  return { title, items };
}

/** `choliba check`: agents, then projects. */
export function checkWorkspace(root: string, config: Config): readonly CheckSection[] {
  return [checkAgents(root, config), checkProjects(root, config)];
}

/** Whether nothing in the sections has a problem. */
export function allFine(sections: readonly CheckSection[]): boolean {
  return sections.every((section) => section.items.every((item) => item.problem === undefined));
}

/** The report: `✓ name` or `✗ name: problem` under each section, problems indented under their item. */
export function formatCheck(sections: readonly CheckSection[]): string {
  const block = (section: CheckSection): string[] => [
    section.title,
    ...(section.items.length === 0 ? ['  (nenhum)'] : []),
    ...section.items.map((item) =>
      item.problem === undefined
        ? `  ✓ ${item.name}`
        : `  ✗ ${item.name}: ${item.problem.replaceAll('\n', '\n      ')}`,
    ),
  ];
  return sections.flatMap((section, index) => [...(index === 0 ? [] : ['']), ...block(section)]).join('\n');
}
