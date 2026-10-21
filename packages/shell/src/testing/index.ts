// The shell built in a spec: a command line run against fakes, with a root that has the app's verbs.
export type { ShellOverride } from './interfaces/shell-override.interface';
export { replace, runShell, VERBS_ROOT } from './run-shell';
