import fs from 'node:fs';
import path from 'node:path';
import { ProjectsError, readJsonFile } from '../common';
import {
  assertProjectExists,
  configJsonPath,
  envJsonPath,
  listProjectNames,
  projectConfigFile,
  projectDir,
  projectEnvExampleFile,
} from '../paths';
import { findReadme, readmeSummary, readText } from './project-readme';

export interface ProjectInfo {
  project: string;
  config: unknown;
  /** `.env.json`, or `undefined` while it has not been created from `.env.example.json`. */
  env: unknown;
}

export interface ProjectConfig {
  devices?: unknown;
  [key: string]: unknown;
}

export function readProjectConfig(projectsDir: string, project: string): ProjectConfig {
  assertProjectExists(projectsDir, project);
  return readJsonFile(configJsonPath(projectsDir, project)) as ProjectConfig;
}

export interface CreateProjectOptions {
  baseUrl?: string;
  /**
   * The application's code, written to every environment's `appDir`. It must be an existing folder
   * (a relative path counts from the new project's folder, as `loadProjectSettings` reads it); its
   * README, when there is one, gives the project's `description`.
   */
  appDir?: string;
}

export interface CreatedProject {
  /** The README found at the root of `appDir`; absent without `appDir` or without a README. */
  readonly readme?: string;
  readonly description?: string;
}

interface CreatedConfig {
  name?: string;
  description?: string;
  envs?: { baseURL?: string; appDir?: string }[];
}

/** `appDir` resolved as `loadProjectSettings` will; fails, before anything is created, when it is not a folder. */
function checkAppDir(targetDir: string, appDir: string): string {
  const resolved = path.resolve(targetDir, appDir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new ProjectsError(`appDir "${appDir}" não é uma pasta existente (${resolved}); o projeto não foi criado.`);
  }
  return resolved;
}

export function createProject(
  projectsDir: string,
  project: string,
  templatesDir: string,
  options: CreateProjectOptions = {},
): CreatedProject {
  const targetDir = projectDir(projectsDir, project);
  if (fs.existsSync(targetDir)) {
    throw new ProjectsError(`Projeto "${project}" já existe (${targetDir}).`);
  }
  if (!fs.existsSync(templatesDir)) {
    throw new ProjectsError(
      `Template de projeto não encontrado em ${templatesDir}. Crie esse diretório antes de rodar create-project.`,
    );
  }
  const missing = [projectConfigFile(templatesDir), projectEnvExampleFile(templatesDir)].filter(
    (file) => !fs.existsSync(file),
  );
  if (missing.length > 0) {
    throw new ProjectsError(`Template de projeto incompleto: falta ${missing.join(' e ')}.`);
  }
  const appDirPath = options.appDir === undefined ? undefined : checkAppDir(targetDir, options.appDir);
  const readme = appDirPath === undefined ? undefined : findReadme(appDirPath);
  const description = readme === undefined ? undefined : readmeSummary(readText(readme));

  // .env.json (credentials) is never generated: whoever sets the project up creates it from
  // .env.example.json, and until then loadProjectSettings refuses to run the project.
  fs.cpSync(templatesDir, targetDir, { recursive: true });

  const configPath = configJsonPath(projectsDir, project);
  const config = readJsonFile(configPath) as CreatedConfig;
  config.name = project;
  for (const env of config.envs ?? []) {
    if (options.baseUrl) env.baseURL = options.baseUrl;
    if (options.appDir !== undefined) env.appDir = options.appDir;
  }
  if (description !== undefined) {
    config.description = description;
  }
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return {
    ...(readme === undefined ? {} : { readme }),
    ...(description === undefined ? {} : { description }),
  };
}

export function listProjects(projectsDir: string): ProjectInfo[] {
  return listProjectNames(projectsDir).map((project): ProjectInfo => ({
    project,
    config: readJsonFile(configJsonPath(projectsDir, project)),
    env: fs.existsSync(envJsonPath(projectsDir, project)) ? readJsonFile(envJsonPath(projectsDir, project)) : undefined,
  }));
}
