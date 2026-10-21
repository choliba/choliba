// The command line of choliba as a library: the shell (its commands, verbs and root), the help and completion, the
// theme, what is written to a terminal, and the panel as the rest sees it (its contract; the panel itself is OpenTUI's).
// Functions, types and tokens, free of decorators: the Playwright runner loads code that imports them with its own
// Babel, which does not accept parameter decorators.
export * from './cli';
export * from './help';
export * from './panel';
export * from './shell';
export * from './terminal';
export * from './theme';
