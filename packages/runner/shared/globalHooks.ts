import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { listProjectNames, projectHookFile, readAppliedLocations, type ProjectHook } from '@choliba/projects';

type HookFunction = () => Promise<void> | void;

/**
 * The hook's default export. Playwright compiles the `.ts` to CommonJS, so `import()` hands back
 * `{ default: { default: fn } }` there, while a native ESM loader gives `{ default: fn }`: both are accepted.
 */
function hookFunction(mod: unknown): HookFunction | undefined {
  const exported = (mod as { default?: unknown } | undefined)?.default;
  const candidate =
    typeof exported === 'function' ? exported : (exported as { default?: unknown } | undefined)?.default;
  return typeof candidate === 'function' ? (candidate as HookFunction) : undefined;
}

export async function runProjectHooks(hook: ProjectHook): Promise<void> {
  const projectsDir = readAppliedLocations().PROJECTS_DIR;

  for (const name of listProjectNames(projectsDir)) {
    const hookPath = projectHookFile(projectsDir, name, hook);
    if (!fs.existsSync(hookPath)) continue;

    const run = hookFunction((await import(pathToFileURL(hookPath).href)) as unknown);
    if (run !== undefined) await run();
  }
}
