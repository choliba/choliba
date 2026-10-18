import type {
  PlanContentContext,
  PlannedFile,
  ProviderRequest,
  ProviderVariablesInput,
  StreamParser,
} from './interfaces/provider.interface';

/**
 * The contract every agent provider (claude, cursor…) meets. Adding a provider is adding its subclass to the list
 * `agentsShell` builds the registry from.
 */
export abstract class AgentProvider {
  /** What `--provider`, `--<id>` and `CHOL_AGENTS_PROVIDER` call it. */
  abstract readonly id: string;
  /**
   * Candidate binaries to try, in order, most specific first — e.g. cursor's own CLI is reachable as
   * `agent`, `cursor-agent` or `cursor agent` depending on install. The first one that resolves is used.
   */
  abstract readonly binaries: readonly (readonly [string, ...string[]])[];
  /** Where it comes in `auto`'s search: the lowest installed one wins. */
  abstract readonly autoPriority: number;
  /** Environment variables that can authenticate this provider; a local run needs at least one. */
  abstract readonly credentials: readonly string[];
  /** Actionable error shown when a local run has none of `credentials`. */
  abstract readonly credentialHelp: string;

  /**
   * Built-in tools of the provider that its permissions cannot limit (Cursor's `Grep` and `Glob` read files that a
   * `Read` deny covers). A call to one stops the run (`unenforced-tool-guard.ts`); none by default.
   */
  readonly unenforcedTools: readonly string[] = [];

  /** Whether `auto` may pick it. A provider that runs only a model of its own (`claude-ollama`) runs only when named. */
  readonly inAuto: boolean = true;

  /** Whether it has no model of its own: a run asks it for the first model the agent declares for it (Ollama's). */
  readonly needsModel: boolean = false;

  /** What `--help` says it is, when the command it runs does not say enough. */
  readonly summary?: string;

  /** The declared id of the model its stream reports, to check against `agent.yaml#providers.<id>.models`. */
  declaredModel(reported: string): string {
    return reported;
  }

  /**
   * The line its stdin takes for a message of the person (the task included), for a provider that reads messages while
   * it runs; absent for one that does not (its session gets no stdin, and the task goes in its arguments).
   */
  inputMessage?(text: string): string;

  /** Whether a line of its stderr says nothing to whoever runs it, and is left out of the screen. */
  quietStderr?(line: string): boolean;

  /** Variables it sets for itself, over what the session inherits: where its API is, which token it sends. */
  variables?(input: ProviderVariablesInput): Readonly<Record<string, string>>;

  /** The resolved executable's runtime closure that a local sandbox mounts read-only. */
  localReadOnly(executable: string): readonly string[] {
    return [executable];
  }

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
