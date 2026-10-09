import type { PlanContentContext, PlannedFile, ProviderRequest, StreamParser } from './interfaces/provider.interface';

/**
 * The contract every agent provider (claude, cursor…) meets, and its injection token: a provider module
 * registers one subclass with `@RegisterAgentProvider()`, and the registry finds it. Adding a provider is
 * adding a module.
 */
export abstract class AgentProvider {
  /** What `--provider`, `--<id>` and `CHOL_AGENTS_PROVIDER` call it. */
  abstract readonly id: string;
  /**
   * Candidate binaries to try, in order, most specific first — e.g. cursor's own CLI is reachable as
   * `agent`, `cursor-agent` or `cursor agent` depending on install. The first one that resolves is used.
   */
  abstract readonly binaries: readonly (readonly string[])[];
  /** Where it comes in `auto`'s search: the lowest installed one wins. */
  abstract readonly autoPriority: number;

  /** The args *after* the binary. Calls `assertArgvFits` before returning. */
  abstract buildArgs(request: ProviderRequest): readonly string[];

  /** A fresh parser for one spawned process (it tracks tool-call ids across lines). */
  abstract createParser(): StreamParser;

  /**
   * How to pick plan file content in `--mode plan`. Default: `plan` event, then `done.text`, then streamed
   * `text` chunks. Cursor overrides this — its `result` field is narration only.
   */
  resolvePlanContent?(context: PlanContentContext): string | undefined;

  /**
   * Prepares the workspace right before the provider starts (cursor writes the agent's permissions into
   * the run dir's `.cursor/cli.json`, since it has no flag for them and only reads that file from the
   * directory it starts in) and returns the function that undoes it, which
   * `runAgent` always calls once the session ends. The undo also removes what the provider itself kept for
   * the run dir outside the workspace (cursor's folders in `~/.cursor`).
   */
  prepareWorkspace?(request: ProviderRequest): () => void;

  /** `--dry-run --show-prompt`: the files `prepareWorkspace` would write, with their content, writing nothing. */
  previewWorkspace?(request: ProviderRequest): readonly PlannedFile[];
}
