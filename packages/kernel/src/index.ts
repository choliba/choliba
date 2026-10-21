// What every package builds on and that has no screen: the container, the platform (the process and Bun as values),
// the errors a person is meant to read, path patterns, the runtime token and where the shipped resources are.
// Functions, types and tokens, free of decorators: the Playwright runner loads code that imports them with its own
// Babel, which does not accept parameter decorators.
export * from './common';
export * from './config';
export * from './container';
export * from './paths';
export * from './platform';
export * from './runtime';
