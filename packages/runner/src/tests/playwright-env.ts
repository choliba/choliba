import path from 'node:path';

/** Where the Playwright config reads the workspace root from, since it runs in a process of its own. */
export const WORKSPACE_ENV = 'CHOLIBA_WORKSPACE';

/**
 * `NODE_PATH` with the `node_modules` that `@playwright/test` resolves from, seen from the runner, in
 * front of `current`. A spec imports `@playwright/test`, but a project's folder (CHOL_PROJECTS_DIR may be
 * anywhere) has no `node_modules` of its own: this is where it finds the one the runner uses. When the
 * runner cannot resolve it either, `current` is kept as is.
 */
export function playwrightNodePath(packageRoot: string, current: string | undefined): string | undefined {
  let manifest: string;
  try {
    manifest = require.resolve('@playwright/test/package.json', { paths: [packageRoot] });
  } catch {
    return current;
  }
  // .../node_modules/@playwright/test/package.json → .../node_modules
  const modules = path.dirname(path.dirname(path.dirname(manifest)));
  if (current === undefined || current === '') return modules;
  // A run of several tickets calls this again with the env it built: the folder is there already.
  return current.split(path.delimiter).includes(modules) ? current : `${modules}${path.delimiter}${current}`;
}
