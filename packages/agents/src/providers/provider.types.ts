import type { AgentDefinition } from '../agent.types';
import type { ExecutionMode, PermissionPolicy } from '../command.types';
import type { AgentEvent } from '../events.types';
import type { McpServer } from '../mcps';

export type ProviderId = 'claude' | 'cursor';

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

export interface ProviderAdapter {
  readonly id: ProviderId;
  /**
   * Candidate binaries to try, in order, most specific first — e.g. cursor's own CLI is
   * reachable as `agent`, `cursor-agent` or `cursor agent` depending on install. `which` in
   * `providers/registry.ts` picks the first one that resolves.
   */
  readonly binaries: readonly (readonly string[])[];
  /** The args *after* the binary. Calls `assertArgvFits` before returning. */
  buildArgs(request: ProviderRequest): readonly string[];
  createParser(): StreamParser;
  /**
   * How to pick plan file content in `--mode plan`. Default: `plan` event, then `done.text`,
   * then streamed `text` chunks. Cursor overrides this — its `result` field is narration only.
   */
  resolvePlanContent?(context: PlanContentContext): string | undefined;
  /**
   * Prepares the workspace right before the provider starts (cursor writes the agent's permissions
   * into `.cursor/cli.json`, since it has no flag for them) and returns the function that undoes
   * it, which `runAgent` always calls once the session ends.
   */
  prepareWorkspace?(request: ProviderRequest): () => void;
}
