import type { AgentDefinition, SkillSummary } from '@choliba/agents';
import type { ConfigGroup, ConfigSetting } from '@choliba/config';
import type { ProjectSettings, ProjectSummary, TicketInfo } from '@choliba/projects';

/** Where `choliba` looks, when not the process's own folder and environment. */
export interface CholibaOptions {
  /** The folder the workspace is searched from; `process.cwd()` when absent. */
  readonly cwd?: string;
  /** The environment read before the workspace's `.env`; `process.env` when absent. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** The workspace's configuration: a group read from the same sources as the CLI, or every key in effect. */
export interface CholibaConfig {
  <T>(group: ConfigGroup<T>): T;
  /** Every key of choliba's groups with the value in effect and where it comes from, as `list config` shows it. */
  list(): readonly ConfigSetting[];
}

/** The workspace's agents. */
export interface CholibaAgents {
  /** The agents folder, absolute: `CHOL_AGENTS_DIR`, else `.choliba/agents`. */
  readonly dir: string;
  /** Every agent that loads, sorted by id. */
  list(): readonly AgentDefinition[];
  /** One agent, checked; an unknown one fails naming the file it looked for. */
  get(id: string): AgentDefinition;
  /** The skills the agent declares, resolved as a run gives them. */
  skills(id: string): readonly SkillSummary[];
}

/** The workspace's skills. */
export interface CholibaSkills {
  /** The skills folder, absolute: `CHOL_SKILLS_DIR`, else `.choliba/skills`. */
  readonly dir: string;
  /** Every skill in the folder, sorted by name. */
  list(): readonly SkillSummary[];
  /** One skill; an unknown one fails naming the file it looked for. */
  get(name: string): SkillSummary;
}

/** A project's tickets. */
export interface CholibaTickets {
  /** Every ticket, typed, sorted by key. */
  list(): readonly TicketInfo[];
  /** One ticket, by key (`app-1`) or suffix (`1`); an unknown one fails naming the file it looked for. */
  get(id: string): TicketInfo;
}

/** A project's specs. */
export interface CholibaTests {
  /** The project's `tests/`. */
  readonly dir: string;
  /** The spec files of `tests/`, relative to it, sorted. */
  list(): readonly string[];
}

/** One project of the workspace, checked to exist when it was got. */
export interface CholibaProject {
  readonly name: string;
  readonly dir: string;
  /** `config.json` and `.env.json` read and checked as a run reads them: it holds the credentials too. */
  readonly settings: ProjectSettings;
  readonly tickets: CholibaTickets;
  readonly tests: CholibaTests;
}

/** The workspace's projects under test. */
export interface CholibaProjects {
  /** The projects folder: `CHOL_PROJECTS_DIR`, else `CHOL_GLOBAL_DIR/projects`. */
  readonly dir: string;
  /** Each project with its `config.json#description`, sorted by name. */
  list(): readonly ProjectSummary[];
  /** One project; an unknown one fails naming the `config.json` it looked for. */
  get(name: string): CholibaProject;
}

/** choliba read from a script: the workspace, its configuration, agents, skills and projects. Nothing is read until asked. */
export interface Choliba {
  /** The nearest folder, from `cwd` up, whose `package.json` depends on choliba. */
  readonly root: string;
  /** The version of the choliba running, as `choliba --version` shows it: `choliba 0.0.1-dev.66+ce2dc61`. */
  readonly version: string;
  readonly config: CholibaConfig;
  readonly agents: CholibaAgents;
  readonly skills: CholibaSkills;
  readonly projects: CholibaProjects;
}
