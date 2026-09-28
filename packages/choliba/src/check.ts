import { existsSync, readdirSync } from 'node:fs';

import {
  definedConfig,
  isValidAgentName,
  loadAgent,
  resolveAgentsDir,
  resolveMcps,
  resolveMcpsDir,
  resolveSkills,
  resolveSkillsDir,
} from '@choliba/agents';
import { listProjectNames, loadProjectSettings, resolveLocations } from '@choliba/projects';

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
 * Every agent of the workspace, loaded as a run would load it: agent.yaml against its standard,
 * system.md against agent.xsd, the skills it lists and the
 * MCP servers it lists, with their `${NAME}` variables from the config.
 */
export async function checkAgents(root: string, config: Config): Promise<CheckSection> {
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
      const agent = await loadAgent(dir, name);
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
export function checkProjects(root: string, config: Config): CheckSection {
  let projectsDir: string;
  try {
    projectsDir = resolveLocations(root, config, () => undefined).PROJECTS_DIR;
  } catch (error) {
    return { title: 'Projetos', items: [{ name: '.env', problem: problemOf(error) }] };
  }
  const title = `Projetos (${projectsDir})`;
  if (!existsSync(projectsDir)) {
    return { title, items: [{ name: projectsDir, problem: 'a pasta não existe' }] };
  }
  const items = listProjectNames(projectsDir).map((name): CheckItem => {
    try {
      loadProjectSettings(projectsDir, name);
      return { name };
    } catch (error) {
      return { name, problem: problemOf(error) };
    }
  });
  return { title, items };
}

/** `choliba check`: agents, then projects. */
export async function checkWorkspace(root: string, config: Config): Promise<readonly CheckSection[]> {
  return [await checkAgents(root, config), checkProjects(root, config)];
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
