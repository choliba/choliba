import { resolve } from 'node:path';

import { agentsConfig, listAgents, listSkills, loadAgent, resolveSkill, resolveSkills } from '@choliba/agents';
import { configCatalog, configSettings, type ConfigGroup } from '@choliba/config';
import { versionLine } from '@choliba/core';
import { LocationsService, ProjectsService, projectsConfig } from '@choliba/projects';

import { configSourcesAt, findWorkspaceRoot } from '../config';
import { cholibaManifest, PACKAGE_NAME } from '../help';
import { cholibaProjects } from './choliba-projects';
import type {
  Choliba,
  CholibaAgents,
  CholibaConfig,
  CholibaOptions,
  CholibaSkills,
} from './interfaces/choliba.interface';

/** `make`'s value, computed on the first call only. */
function once<T>(make: () => T): () => T {
  let made: { readonly value: T } | undefined;
  return () => {
    made ??= { value: make() };
    return made.value;
  };
}

/**
 * choliba for a script, over the app's configuration `groups`: the same rules as the CLI (`findWorkspaceRoot`, the
 * environment then the `.env`, the agents' loader, the projects' service), nothing new. Nothing is read until a member is used, and `root`
 * is found once.
 */
export function cholibaLibrary(groups: readonly ConfigGroup[], options: CholibaOptions): Choliba {
  const root = once(() => findWorkspaceRoot(options.cwd ?? process.cwd()));
  const sources = () => configSourcesAt(options.env ?? process.env, root());
  const read = <T>(group: ConfigGroup<T>): T => group.read(sources());
  const config: CholibaConfig = Object.assign(read, {
    list: () => configSettings(configCatalog(groups), sources()),
  });
  const skills: CholibaSkills = {
    get dir() {
      return resolve(root(), read(agentsConfig).skillsDir);
    },
    list: () => listSkills(skills.dir),
    get: (name) => resolveSkill(skills.dir, { name }),
  };
  const agents: CholibaAgents = {
    get dir() {
      return resolve(root(), read(agentsConfig).agentsDir);
    },
    list: () => listAgents(agents.dir),
    get: (id) => loadAgent(agents.dir, id),
    skills: (id) => resolveSkills(skills.dir, agents.get(id).skills),
  };
  return {
    get root() {
      return root();
    },
    get version() {
      return versionLine(PACKAGE_NAME, cholibaManifest());
    },
    config,
    agents,
    skills,
    projects: cholibaProjects(() => new ProjectsService(new LocationsService(read(projectsConfig)))),
  };
}
