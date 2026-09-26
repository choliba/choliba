import { listProjectNames } from '@choliba/projects';

function pathArgs(): string[] {
  const argv = process.argv.slice(2);
  const testIndex = argv.indexOf('test');
  const rest = testIndex === -1 ? argv : argv.slice(testIndex + 1);
  return rest.filter((arg) => !arg.startsWith('-'));
}

export function isProjectInScope(project: string): boolean {
  const args = pathArgs();
  return args.length === 0 || args.some((arg) => arg.includes(project));
}

export function getTargetProject(projectsDir: string): string | undefined {
  const args = pathArgs();
  if (args.length === 0) return undefined;

  const projects = listProjectNames(projectsDir);
  const targets = new Set(projects.filter((name) => args.some((arg) => arg.includes(name))));

  return targets.size === 1 ? [...targets][0] : undefined;
}
