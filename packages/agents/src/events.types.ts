/**
 * The shape every provider adapter's `StreamParser` normalizes its own JSON events into. This
 * is the seam that makes adding a third provider mean writing one adapter, not touching
 * `render.ts` or `run-agent.ts`.
 */
export type AgentEvent =
  | { readonly type: 'init'; readonly model: string | undefined; readonly sessionId: string | undefined }
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly summary: string }
  | {
      readonly type: 'tool-result';
      readonly id: string;
      readonly name: string | undefined;
      readonly isError: boolean;
      /** True when the failure was a permission denial rather than the tool itself failing. */
      readonly denied: boolean;
      readonly text: string;
    }
  /** Plan markdown from claude `ExitPlanMode` or cursor `createPlanToolCall`. */
  | { readonly type: 'plan'; readonly markdown: string }
  | { readonly type: 'done'; readonly isError: boolean; readonly text: string };
