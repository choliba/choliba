/**
 * What the sandbox reads of an agent's permissions, already absolute: the paths it reads and writes, the folders its
 * commands run in, and what it may not read or write. An agent's own permissions have this shape.
 */
export interface SandboxPermissions {
  readonly allowRead: readonly string[];
  readonly allowWrite: readonly string[];
  readonly allowExecute: readonly { readonly dir: string }[];
  readonly denyRead: readonly string[];
  readonly denyWrite: readonly string[];
}

/** Whether the session may write (`edits`) or only read (`read-only`): under `read-only`, nothing of `allowWrite`. */
export type SandboxPolicy = 'read-only' | 'edits';
