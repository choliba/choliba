import { configJsonPath } from '../projects/project';
import type { ProjectSettings } from '../projects/settings';
import { ProjectsError } from '../shared/errors';

/** Set for the runs of a batch once their project's application was prepared, so it is prepared only once. */
export const APP_PREPARED_ENV = 'CHOL_APP_PREPARED';

/** The project's application could not be prepared or started; the message says why and where to fix it. */
export class AppError extends ProjectsError {}

export type SetupSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit'; shell: true },
) => { status: number | null };

export interface PrepareAppContext {
  readonly projectsDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly stderr: { write(chunk: string): unknown };
  readonly spawn: SetupSpawn;
}

/**
 * Runs the active environment's `setup` commands (`config.json#envs[].setup`) in its `appDir`, in order; the
 * first that fails throws `AppError`, naming the command and where it is declared. Nothing to do without `setup`,
 * or in a batch whose application is already prepared.
 */
export function prepareApp(settings: ProjectSettings, context: PrepareAppContext): void {
  const { setup = [], nome } = settings.environment;
  if (context.env[APP_PREPARED_ENV] !== undefined) return;
  for (const command of setup) {
    context.stderr.write(`preparando a aplicação: ${command} (em ${settings.appDir})\n`);
    const { status } = context.spawn(command, [], {
      cwd: settings.appDir,
      env: context.env,
      stdio: 'inherit',
      shell: true,
    });
    if (status === 0) continue;
    throw new AppError(
      `a aplicação não ficou pronta: "${command}" saiu com código ${String(status)} ` +
        `(envs[${nome}].setup em ${configJsonPath(context.projectsDir, settings.project)}).`,
    );
  }
}
