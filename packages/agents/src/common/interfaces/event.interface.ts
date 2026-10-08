/**
 * How a tool call uses MCP: a `call` to one tool of a server, or a `discovery` that lists a server's tools or
 * resources (`GetMcpTools`, `ListMcpResources`…), naming the server when the call does.
 */
export type McpUse =
  | { readonly kind: 'call'; readonly server: string; readonly tool: string }
  | { readonly kind: 'discovery'; readonly server?: string };

/**
 * The shape every provider adapter's `StreamParser` normalizes its own JSON events into. This
 * is the seam that makes adding a third provider mean writing one adapter, not touching
 * `render.ts` or `run-agent.ts`.
 */
export type AgentEvent =
  | { readonly type: 'init'; readonly model: string | undefined; readonly sessionId: string | undefined }
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'tool-call';
      readonly id: string;
      readonly name: string;
      readonly summary: string;
      /** The MCP the call uses, when the provider's stream says so (checked by `mcp-guard.ts`). */
      readonly mcp?: McpUse;
    }
  | {
      readonly type: 'tool-result';
      readonly id: string;
      readonly name: string | undefined;
      readonly isError: boolean;
      /** True when the failure was a permission denial rather than the tool itself failing. */
      readonly denied: boolean;
      readonly text: string;
      /** What the call worked on (its `tool-call` summary: a path, a command), when the call was seen. */
      readonly target?: string;
      /** The MCP the call used, when the call was seen and used one. */
      readonly mcp?: McpUse;
    }
  /** Plan markdown from claude `ExitPlanMode` or cursor `createPlanToolCall`. */
  | { readonly type: 'plan'; readonly markdown: string }
  | { readonly type: 'done'; readonly isError: boolean; readonly text: string };
