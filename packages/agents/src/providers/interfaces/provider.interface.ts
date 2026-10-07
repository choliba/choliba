import type { AgentDefinition } from '../../agents/interfaces/agent.interface';
import type { ExecutionMode, PermissionPolicy } from '../../agents/interfaces/command.interface';
import type { AgentEvent } from '../../runs/interfaces/event.interface';
import type { McpServer } from '../../mcps/mcps';
import type { RunProject } from '../../runs/run-project';

export interface ProviderRequest {
  readonly agent: AgentDefinition;
  readonly mode: ExecutionMode;
  /** Already the *effective* policy (see `effectivePolicy`): read-only whenever `mode !== 'execute'`. */
  readonly policy: PermissionPolicy;
  /** The full prompt body (mode notice + saved plan + task), already assembled by `buildUserPrompt`. */
  readonly userPrompt: string;
  readonly workspaceRoot: string;
  /**
   * Where the provider runs: an empty folder inside the workspace (`.cache/runs/<id>/`), created before
   * the session and removed after it. Both providers let the agent read and write freely in the folder
   * they run in, so running in an empty one leaves `permissions` as the only thing that grants access;
   * being inside the workspace, `bunx choliba ...` still finds it from there.
   */
  readonly runDir: string;
  readonly addDirs: readonly string[];
  readonly model: string | undefined;
  /** The order to use the agent's skills (`formatSkillsInstruction`), put atop its instructions; absent when it lists none. */
  readonly skillsInstruction?: string;
  /** The MCP servers the agent lists (`agent.yaml#mcps`), already resolved; the session gets these and no other. */
  readonly mcpServers?: readonly McpServer[];
  /** The project the run works on (`--project`), named in the prompt (`formatProject`); absent without one. */
  readonly project?: RunProject;
}

/**
 * Stateful by design: a provider's tool-result events reference a tool-call by id
 * (`tool_use_id`), so a parser instance tracks id → name across the lines of one run.
 * `createParser()` returns a fresh one per spawned process.
 */
export interface StreamParser {
  parseLine(line: string): readonly AgentEvent[];
  /** True once a stream `init` event carried a non-empty model (see `stream-json.ts`). */
  readonly sawInitWithModel: boolean;
}

export interface PlanContentContext {
  readonly planMarkdown: string | undefined;
  readonly doneEvent: Extract<AgentEvent, { type: 'done' }> | undefined;
  readonly textParts: readonly string[];
}

/** A file a provider would write for a run, and what it would hold. */
export interface PlannedFile {
  readonly path: string;
  readonly content: string;
}
