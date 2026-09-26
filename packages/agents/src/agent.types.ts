import type { ExecutionMode, PermissionPolicy } from './command.types';

/**
 * One line of `before_execute`/`after_execute`: `<action>: [args]`. `run` runs an external command
 * (no shell); any other action is a method of the CLI, registered in `prepare/actions.ts`.
 */
export interface AgentStep {
  readonly action: string;
  readonly args: readonly string[];
}

/**
 * One entry of `agent.yaml#mcps`: a server, and the only tools of it the agent may call. Without
 * `tools` (the plain list form, or a server with no `tools` key) every tool of the server is allowed.
 */
export interface McpDeclaration {
  readonly name: string;
  readonly tools?: readonly string[];
}

/**
 * One agent, loaded from `<agentsDir>/<name>/agent.yaml` + `system.md` — the same on-disk
 * shape as `<agentsDir>/<name>/`. `supportedModels` and `skills` are read but not acted on in
 * this version: they exist so an agent directory authored elsewhere loads here unchanged.
 */
export interface AgentDefinition {
  /** The directory name; also the lookup key (`agents <name> ...`). */
  readonly name: string;
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly description: string;
  readonly supportedModels: readonly string[];
  readonly skills: readonly string[];
  /** MCP servers the agent may use (`<mcpsDir>/<name>.json`); it gets no other. */
  readonly mcps: readonly McpDeclaration[];
  readonly policy: PermissionPolicy;
  readonly taskRequired: boolean;
  /** The run acts on one project, given by `--project` and checked by `@choliba/projects` first. */
  readonly projectRequired: boolean;
  /**
   * The ticket types the agent works on (`agent.yaml#ticket_types`). When set, a run needs `--type`
   * (the CLI creates the ticket from that type's template) or `--ticket` (an existing one).
   */
  readonly ticketTypes?: readonly string[];
  readonly defaultMode: ExecutionMode;
  /** Task used when the user gives none (only meaningful with `taskRequired: false`). */
  readonly defaultTask?: string;
  /** Steps run in order before the provider is called; they may add sections to the prompt. */
  readonly beforeExecute?: readonly AgentStep[];
  /** Steps run in order after a successful `execute`. */
  readonly afterExecute?: readonly AgentStep[];
  /** Absolute path to the agent's directory. */
  readonly dir: string;
  /** Absolute path to `system.md`. */
  readonly systemPromptPath: string;
  /** The verbatim contents of `system.md` — the instructions sent to the provider. */
  readonly instructions: string;
}
