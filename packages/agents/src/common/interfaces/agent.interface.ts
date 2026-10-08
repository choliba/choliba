import type { AnsiColor } from '@choliba/core';
import type { ExecutionMode, PermissionPolicy } from './execution.interface';
import type { AgentPermissions } from '../agent-permissions';

/**
 * One line of `steps.<mode>.before`/`.after`: `<action>: [args]`. `run` runs an external command
 * (no shell); any other action is a method of the CLI, registered in `prepare/actions.ts`.
 */
export interface AgentStep {
  readonly action: string;
  readonly args: readonly string[];
}

/** `steps.<mode>.after`: after the agent, `success` (it exited with 0) or `failure`, then `always`. */
export interface AgentAfterSteps {
  readonly success: readonly AgentStep[];
  readonly failure: readonly AgentStep[];
  readonly always: readonly AgentStep[];
}

/** `steps.<mode>`: what the CLI runs around the agent in that mode; a mode with no steps runs nothing. */
export interface AgentModeSteps {
  /** Run in order before the agent; the first failure stops the run. They may add sections to the prompt. */
  readonly before: readonly AgentStep[];
  readonly after: AgentAfterSteps;
}

/**
 * The text of the agent, from `agent.yaml`: each field becomes one section of the prompt
 * (`role` → `<system_role>`, `context` → `<context>`, `input` → `<input_contract>`, `flow` →
 * `<execution_flow>`, `output` → `<output_contract>`, `notes` → `<notes>`).
 */
export interface AgentSections {
  readonly role: string;
  readonly context: readonly string[];
  readonly input: string;
  readonly flow: string;
  readonly output: string;
  readonly notes: readonly string[];
}

/**
 * One entry of `agent.yaml#skills`: a skill, and how this agent uses it (`instructions`, which goes
 * into the prompt only with the skill).
 */
export interface SkillDeclaration {
  readonly name: string;
  readonly instructions?: string;
}

/**
 * One entry of `agent.yaml#mcps`: a server, the only tools of it the agent may call, and how this
 * agent uses it (`instructions`, which goes into the prompt only with the server). Without `tools`
 * (the plain list form, or a server with no `tools` key) every tool of the server is allowed.
 */
export interface McpDeclaration {
  readonly name: string;
  readonly tools?: readonly string[];
  readonly instructions?: string;
}

/**
 * One agent, loaded from `<agentsDir>/<name>/agent.yaml` (standard 1, see
 * `schemes/v1/agent.schema.json`), its whole declaration. `name` is the folder, which is also `agent.id`.
 */
export interface AgentDefinition {
  /** The directory name, equal to `agent.id`; also the lookup key (`agents <name> ...`). */
  readonly name: string;
  readonly id: string;
  readonly displayName: string;
  /** The agent's own version (`agent.version`), not the standard's. */
  readonly version: string;
  readonly description: string;
  /** `agent.color`: the color its author chose for its `[label]`; `CHOL_COLORS` overrides it. */
  readonly color?: AnsiColor;
  /** `models`: the models the agent may run with. */
  readonly supportedModels: readonly string[];
  readonly skills: readonly SkillDeclaration[];
  /** MCP servers the agent may use (`<mcpsDir>/<name>.json`); it gets no other. */
  readonly mcps: readonly McpDeclaration[];
  /** What the agent may read, write and execute, and where (`permissions`). */
  readonly permissions: AgentPermissions;
  /** Derived from `permissions`: `edits` when something may be written, `read-only` otherwise. */
  readonly policy: PermissionPolicy;
  readonly taskRequired: boolean;
  /**
   * The run acts on one project, given by `--project` and checked by `@choliba/projects` first.
   * Derived: the agent uses a project variable (`${PROJECT_DIR}`...) or declares `ticket_types`.
   */
  readonly projectRequired: boolean;
  /**
   * The ticket types the agent works on (`agent.yaml#ticket_types`). When set, a run needs `--type`
   * (the CLI creates the ticket from that type's template) or `--ticket` (an existing one), unless
   * `allowWithoutTicket` is true.
   */
  readonly ticketTypes?: readonly string[];
  /**
   * `agent.yaml#allow_without_ticket`: the run may omit `--type`/`--ticket`. With `ticketTypes`,
   * the ticket is optional; without them, the agent never uses a ticket.
   */
  readonly allowWithoutTicket: boolean;
  /** `modes.allow`: the modes a run may use; any other is refused. */
  readonly modes: readonly ExecutionMode[];
  /** `modes.default`: the mode of a run that names none. */
  readonly defaultMode: ExecutionMode;
  /** Task used when the user gives none (only meaningful with `taskRequired: false`). */
  readonly defaultTask?: string;
  /** `steps`, one entry per mode (empty lists for a mode that declares none). */
  readonly steps: Readonly<Record<ExecutionMode, AgentModeSteps>>;
  /** The text of the agent, which the CLI turns into the prompt's sections. */
  readonly sections: AgentSections;
  /** Absolute path to the agent's directory. */
  readonly dir: string;
  /** Absolute path to `agent.yaml`. */
  readonly sourcePath: string;
}
