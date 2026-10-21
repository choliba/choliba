export type ExecutionMode = 'execute' | 'plan' | 'ask';

export const EXECUTION_MODES: readonly ExecutionMode[] = ['execute', 'plan', 'ask'];

export type PermissionPolicy = 'read-only' | 'edits';
