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

/** A provider, as a script sees it: never the values of its credentials. */
export interface CholibaProvider {
  /** What `--provider` calls it: `claude`, `claude-ollama`, `cursor`. */
  readonly id: string;
  /** Whether one of its commands is on the `PATH`. */
  readonly installed: boolean;
  /** Whether `auto` may pick it. */
  readonly inAuto: boolean;
  /** Each variable that authenticates it, and whether the environment or the `.env` sets it. */
  readonly credentials: readonly { readonly name: string; readonly set: boolean }[];
  /** The prefix of the models only it runs (`ollama:`), when it has one. */
  readonly modelPrefix?: string;
  /** What `--help` says it is. */
  readonly summary: string;
}

/** The providers choliba knows. */
export interface CholibaProviders {
  /** Every provider, by id. */
  list(): readonly CholibaProvider[];
  /** One provider; an unknown id fails naming the ones there are. */
  get(id: string): CholibaProvider;
  /** `CHOL_AGENTS_PROVIDER` in effect: `auto` or a provider's id. */
  readonly preferred: string;
}

/** An MCP server an agent declares, where its JSON is: never what the JSON holds, which may carry credentials. */
export interface CholibaMcp {
  readonly name: string;
  /** Its `<name>.json` in `CHOL_MCPS_DIR`, absolute. */
  readonly path: string;
  /** Whether that file is there. */
  readonly exists: boolean;
  /** The only tools of it the agent may call; absent allows them all. */
  readonly tools?: readonly string[];
  /** How the agent uses it (`agent.yaml#mcps.<name>.instructions`). */
  readonly instructions?: string;
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
  /** The MCP servers the agent declares, each with its file in `CHOL_MCPS_DIR`. */
  mcps(id: string): readonly CholibaMcp[];
  /**
   * The provider that runs the agent, as `choliba run agent` picks it with no `--provider`: the one its models belong
   * to (`ollama:` ones run in `claude-ollama`), else `providers.preferred`, and under `auto` the first installed;
   * `undefined` when `auto` finds none.
   */
  provider(id: string): CholibaProvider | undefined;
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

/** The workspace a script reads, and the choliba it runs with. */
export interface CholibaWorkspace {
  /** The nearest folder, from `cwd` up, whose `package.json` depends on choliba. */
  readonly root: string;
  /** The version of the choliba running, as `choliba --version` shows it: `choliba 0.0.1-dev.66+ce2dc61`. */
  readonly version: string;
}

/**
 * choliba read from a script, one module per subject: the workspace, its configuration, agents, skills and projects.
 * Nothing is read until asked.
 */
export interface Choliba {
  /** `workspace.root`, kept at the top as before. */
  readonly root: string;
  /** `workspace.version`, kept at the top as before. */
  readonly version: string;
  readonly workspace: CholibaWorkspace;
  readonly config: CholibaConfig;
  readonly providers: CholibaProviders;
  readonly agents: CholibaAgents;
  readonly skills: CholibaSkills;
  readonly projects: CholibaProjects;
}
