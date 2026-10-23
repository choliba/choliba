import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { ExpectedError } from '@choliba/kernel';
import type { ProjectSettings } from '@choliba/domain';
import { PROJECT_CONFIG_FILE } from '@choliba/workspace';

import { freshLog, logTail, withAppendLog } from './project-app-log';

/** Set for the runs of a batch once their project's application was prepared, so it is prepared only once. */
export const APP_PREPARED_ENV = 'CHOL_APP_PREPARED';

/** The project's application could not be prepared or started; the message says why and where to fix it. */
export class AppError extends ExpectedError {}

function configJsonPath(projectsDir: string, project: string): string {
  return join(projectsDir, project, PROJECT_CONFIG_FILE);
}

/** Where a setup command writes: to the log, its input closed (`['ignore', log, log]`). */
export type SetupStdio = ['ignore', number, number];

export type SetupSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: SetupStdio; shell: true },
) => { status: number | null } | Promise<{ readonly status: number | null }>;

export interface PrepareAppContext {
  readonly projectsDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly stderr: { write(chunk: string): unknown };
  readonly spawn: SetupSpawn;
  /** Where the setup's output goes, from scratch; the screen only says which command runs, and the end on a failure. */
  readonly logFile: string;
}

/**
 * Runs the active environment's `setup` commands (`config.json#envs[].setup`) in its `appDir`, in order, their output
 * in `logFile`; the first that fails throws `AppError`, naming the command, where it is declared and the end of the
 * log. Nothing to do without `setup`, or in a batch whose application is already prepared. A `spawn` that resolves
 * later leaves the process free meanwhile.
 */
export async function prepareApp(settings: ProjectSettings, context: PrepareAppContext): Promise<void> {
  const { setup = [], nome } = settings.environment;
  if (context.env[APP_PREPARED_ENV] !== undefined || setup.length === 0) return;
  const { logFile } = context;
  freshLog(logFile);
  for (const command of setup) {
    context.stderr.write(`preparando a aplicação: ${command} (em ${settings.appDir}; log em ${logFile})\n`);
    appendFileSync(logFile, `$ ${command}\n`);
    const { status } = await withAppendLog(logFile, (log) =>
      context.spawn(command, [], { cwd: settings.appDir, env: context.env, stdio: ['ignore', log, log], shell: true }),
    );
    if (status === 0) continue;
    throw new AppError(
      `a aplicação não ficou pronta: "${command}" saiu com código ${String(status)} ` +
        `(envs[${nome}].setup em ${configJsonPath(context.projectsDir, settings.project)}). ` +
        `Log em ${logFile}:${logTail(logFile)}`,
    );
  }
}
