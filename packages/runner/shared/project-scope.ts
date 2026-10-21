import { listProjectNames, projectOfArgument } from '@choliba/projects';

function pathArgs(): string[] {
  const argv = process.argv.slice(2);
  const testIndex = argv.indexOf('test');
  const rest = testIndex === -1 ? argv : argv.slice(testIndex + 1);
  return rest.filter((arg) => !arg.startsWith('-'));
}

/** The one project the paths given to `playwright test` name (`projectOfArgument`); none, or several, is undefined. */
export function getTargetProject(projectsDir: string): string | undefined {
  const args = pathArgs();
  if (args.length === 0) return undefined;

  const projects = listProjectNames(projectsDir);
  const targets = new Set(args.map((arg) => projectOfArgument(projectsDir, projects, arg, process.cwd())));
  targets.delete(undefined);

  return targets.size === 1 ? [...targets][0] : undefined;
}
