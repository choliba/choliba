// What @choliba/core gave before the restructure, gathered again: the kernel, the shell and the panel (OpenTUI). The
// panel moves to @choliba/tui next; this entry keeps exporting the same names until the bridges go.
// Functions, types and tokens, free of decorators: the Playwright runner loads code that imports them with its own
// Babel, which does not accept parameter decorators.
export * from '@choliba/kernel';
export * from '@choliba/shell';
export * from './shell';
export * from './terminal';
