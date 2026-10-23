import path from 'node:path';

import { projectOfArgument } from '@choliba/workspace';

const PROJECTS_DIR = path.join(path.sep, 'work', 'projects');
const PROJECTS = ['site', 'site-choliba'];

function projectOf(argument: string, cwd = path.join(path.sep, 'runner')): string | undefined {
  return projectOfArgument(PROJECTS_DIR, PROJECTS, argument, cwd);
}

describe('projectOfArgument', () => {
  it('names a project by its whole folder, never by a part of its name', () => {
    expect(projectOf(path.join(PROJECTS_DIR, 'site-choliba', 'tests', 'site-choliba-1.spec.ts'))).toBe('site-choliba');
    expect(projectOf(path.join(PROJECTS_DIR, 'site', 'tests', 'a.spec.ts'))).toBe('site');
    expect(projectOf(path.join(PROJECTS_DIR, 'site-choliba'))).toBe('site-choliba');
  });

  it('resolves a relative path from cwd, then falls back to its segments', () => {
    expect(projectOf(path.join('site-choliba', 'tests', 'a.spec.ts'), PROJECTS_DIR)).toBe('site-choliba');
    expect(projectOf('site-choliba/tests/a.spec.ts')).toBe('site-choliba');
    expect(projectOf('site-choliba')).toBe('site-choliba');
    expect(projectOf('site')).toBe('site');
  });

  it('names none for a path outside the projects, the projects folder itself or an unknown folder', () => {
    expect(projectOf(path.join(path.sep, 'elsewhere', 'site', 'a.spec.ts'))).toBeUndefined();
    expect(projectOf(PROJECTS_DIR)).toBeUndefined();
    expect(projectOf(path.join(PROJECTS_DIR, 'other', 'a.spec.ts'))).toBeUndefined();
    expect(projectOf('choliba/tests/a.spec.ts')).toBeUndefined();
  });
});
