/** Who asks: the agent, a step, or a script, each with its own id. */
export type PermissionSubjectKind = 'agent' | 'step' | 'script';

export interface PermissionSubject {
  readonly kind: PermissionSubjectKind;
  readonly id: string;
}

/** What a path rule can allow, deny or carve out. */
export const PATH_ACTIONS = ['read', 'list', 'create', 'edit', 'delete'] as const;

export type PathAction = (typeof PATH_ACTIONS)[number];

/** Creating, editing and deleting are the writes a `plan` or `ask` run never keeps. */
export const WRITE_ACTIONS = ['create', 'edit', 'delete'] as const;

export type WriteAction = (typeof WRITE_ACTIONS)[number];

/** An action that is not a path. `execute` is a command; `invoke` is a tool. */
export type OtherAction = 'execute' | 'invoke' | 'connect' | 'bind';

export type PermissionAction = PathAction | OtherAction;

/**
 * What must be true before the action counts. This is the floor, not what a runtime has imposed: that comparison
 * belongs to the runtime.
 */
export type PermissionFloor = 'enforced' | 'delegated' | 'guarded';

/** The floor of each action. Path rules and turning the network off require `enforced`; a command and a tool do not. */
export const PERMISSION_FLOOR: Readonly<Record<PermissionAction, PermissionFloor>> = {
  read: 'enforced',
  list: 'enforced',
  create: 'enforced',
  edit: 'enforced',
  delete: 'enforced',
  execute: 'delegated',
  invoke: 'delegated',
  connect: 'enforced',
  bind: 'enforced',
};

/** One rule: `exception` only takes an entry out of a `deny` of this same rule. It never grants. */
export interface PermissionRule<Entry> {
  readonly allow: readonly Entry[];
  readonly deny: readonly Entry[];
  readonly exception: readonly Entry[];
}

/** One path action. */
export type PathRule = PermissionRule<string>;

/** The path policy `decide` reads. `--add-dir` is already part of `read.allow`. */
export type PathPolicy = Readonly<Record<PathAction, PathRule>>;

/**
 * A tool of a server, or the whole server when there is no `name`. A built-in tool has no server, so it is not an MCP
 * tool that only shares its name.
 */
export type ToolEntry =
  { readonly server: string; readonly name?: string } | { readonly server?: string; readonly name: string };

/** The tool policy `decide` reads: one rule, because `invoke` is one action. */
export type ToolPolicy = PermissionRule<ToolEntry>;

/** Everything `decide` reads. */
export interface PermissionPolicy {
  readonly path: PathPolicy;
  readonly tool: ToolPolicy;
}

export type PermissionMode = 'execute' | 'plan' | 'ask';

export interface PermissionContext {
  readonly mode: PermissionMode;
  readonly project?: string;
  readonly ticket?: string;
}

export type PermissionObject =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'command'; readonly dir: string; readonly argv: readonly string[] }
  | { readonly kind: 'tool'; readonly server?: string; readonly name: string }
  | { readonly kind: 'network'; readonly host: string }
  | { readonly kind: 'env'; readonly name: string };

export type PermissionEffect = 'allow' | 'deny';

export interface PermissionRequest {
  readonly subject: PermissionSubject;
  readonly action: PermissionAction;
  readonly object: PermissionObject;
  readonly context: PermissionContext;
}
