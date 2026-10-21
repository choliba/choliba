import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_CONFIG_FILE, PROJECT_ENV_EXAMPLE_FILE, PROJECT_ENV_FILE, TESTS_SUBDIR } from './project-layout';

import { ProjectsError } from '../common';

/** Where a project and its files are, from the projects folder: the paths, and whether the project is there. */
export function projectDir(projectsDir: string, project: string): string {
  return path.join(projectsDir, project);
}

/** `config.json` of the project at `projectPath` — what makes a folder a project. */
export function projectConfigFile(projectPath: string): string {
  return path.join(projectPath, PROJECT_CONFIG_FILE);
}

/** `.env.json` (credentials per environment) of the project at `projectPath`. */
export function projectEnvFile(projectPath: string): string {
  return path.join(projectPath, PROJECT_ENV_FILE);
}

/** `.env.example.json`, the model for `.env.json`, of the project at `projectPath`. */
export function projectEnvExampleFile(projectPath: string): string {
  return path.join(projectPath, PROJECT_ENV_EXAMPLE_FILE);
}

/** A hook a project may ship at its root, run once before or after all tests. */
export type ProjectHook = 'global-setup' | 'global-teardown';

/** `<hook>.ts` at the root of the project. */
export function projectHookFile(projectsDir: string, project: string, hook: ProjectHook): string {
  return path.join(projectDir(projectsDir, project), `${hook}.ts`);
}

/** `tests/`, where the project's specs live. */
export function projectTestsFolder(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), TESTS_SUBDIR);
}

/** A file Playwright runs by default: `*.spec.ts`, `*.test.js` and their `c`/`m`/`x` variants. */
const SPEC_FILE = /\.(spec|test)\.[cm]?[jt]sx?$/;

/** The spec files of the project's `tests/`, in subfolders too, relative to it and sorted; none without the folder. */
export function listProjectSpecs(projectsDir: string, project: string): string[] {
  const testsFolder = projectTestsFolder(projectsDir, project);
  if (!fs.existsSync(testsFolder)) return [];
  return fs
    .readdirSync(testsFolder, { recursive: true, encoding: 'utf8' })
    .filter((file) => SPEC_FILE.test(file) && fs.statSync(path.join(testsFolder, file)).isFile())
    .map((file) => file.split(path.sep).join('/'))
    .sort();
}

export function configJsonPath(projectsDir: string, project: string): string {
  return projectConfigFile(projectDir(projectsDir, project));
}

export function envJsonPath(projectsDir: string, project: string): string {
  return projectEnvFile(projectDir(projectsDir, project));
}

/** A project is a folder with a `config.json`; whether it is ready to run is `loadProjectSettings`'s call. */
export function projectExists(projectsDir: string, project: string): boolean {
  return fs.existsSync(configJsonPath(projectsDir, project));
}

/** Fails unless `project` is a project in `projectsDir` (a folder with a `config.json`). */
export function assertProjectExists(projectsDir: string, project: string): void {
  if (!projectExists(projectsDir, project)) {
    throw new ProjectsError(
      `Projeto "${project}" não encontrado (${configJsonPath(projectsDir, project)} não existe).`,
    );
  }
}

/** The projects in `projectsDir`, by name: its folders that have a `config.json`. */
export function listProjectNames(projectsDir: string): string[] {
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && projectExists(projectsDir, d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * The project a command-line argument names, never by a part of a name (`site` is not in `site-choliba/…`): the first
 * folder under `projectsDir` of the path the argument resolves to from `cwd`; else, for a relative argument, a segment
 * of it that is one of `projects`. An absolute path outside `projectsDir` names none.
 */
export function projectOfArgument(
  projectsDir: string,
  projects: readonly string[],
  argument: string,
  cwd: string,
): string | undefined {
  const inside = path.relative(projectsDir, path.resolve(cwd, argument));
  if (inside !== '' && !inside.startsWith('..') && !path.isAbsolute(inside)) {
    const first = inside.split(path.sep)[0];
    return projects.find((name) => name === first);
  }
  if (path.isAbsolute(argument)) return undefined;
  const segments = argument.split(/[\\/]/);
  return projects.find((name) => segments.includes(name));
}
