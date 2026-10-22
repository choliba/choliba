// The plain side of @choliba/projects: functions and types, free of decorators and of Bun (see @choliba/core),
// as the Playwright runner imports it.
export { ProjectsError, UsageError, readJsonFile, PLACEHOLDER_VALUE, NONE, programOf, runSubcommand } from './common';
export * from './paths';
export * from './locations';
export * from './tickets';
export * from './projects';
