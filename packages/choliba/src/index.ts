// The package root: the shell, with no effect on import. `main.ts` is the bin and the only file that
// reads the process and runs it.
export { CHOLIBA_SHELL, cholibaShell, createCholibaShell } from './app-shell';
export type { Runtime } from './runtime';
