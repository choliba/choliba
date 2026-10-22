import { join } from 'node:path';

import type { ProjectSettings } from '@choliba/domain';
import { PROJECT_CONFIG_FILE } from '@choliba/workspace';

import { answers, launchApp, type LaunchedApp } from './project-app-launch';
import { logTail } from './project-app-log';
import { AppError, prepareApp, type SetupSpawn } from './project-app-prepare';

function configJsonPath(projectsDir: string, project: string): string {
  return join(projectsDir, project, PROJECT_CONFIG_FILE);
}

/** The application of a run: `stop` stops it when choliba started it, and does nothing otherwise. */
export interface RunningApp {
  /** Whether choliba started it (it was not up); the person's own application is left alone. */
  readonly started: boolean;
  readonly stop: () => void;
}

export interface EnsureAppDeps {
  readonly projectsDir: string;
  /** Where the application's logs go: its server's in `<logDir>/<project>.log`, its setup's in `<project>.setup.log`. */
  readonly logDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly stderr: { write(chunk: string): unknown };
  readonly spawn: SetupSpawn;
  readonly launch?: typeof launchApp;
  readonly isUp?: (url: string) => Promise<boolean>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  /** How long `start` has to make `baseURL` answer (180 s, as Playwright's `webServer`). */
  readonly timeoutMs?: number;
}

const TIMEOUT_MS = 180_000;
const POLL_MS = 500;

const sleepFor = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Waits for `baseURL` to answer; throws when the server ends first or the time runs out. */
async function waitUntilUp(settings: ProjectSettings, app: LaunchedApp, logFile: string, deps: EnsureAppDeps) {
  const { isUp = answers, sleep = sleepFor, now = Date.now, timeoutMs = TIMEOUT_MS } = deps;
  const { baseURL } = settings.environment;
  const deadline = now() + timeoutMs;
  for (;;) {
    if (await isUp(baseURL)) return;
    const code = app.exitCode();
    const reason =
      code !== undefined
        ? `o comando terminou com código ${String(code)}`
        : now() >= deadline
          ? `${baseURL} não respondeu em ${String(Math.round(timeoutMs / 1000))} s`
          : undefined;
    if (reason !== undefined) {
      app.stop();
      throw new AppError(`a aplicação não subiu (envs[].start): ${reason}. Log em ${logFile}:${logTail(logFile)}`);
    }
    await sleep(POLL_MS);
  }
}

/**
 * Makes sure the project's application is up for a run: runs its `setup` (`prepareApp`), then, when `baseURL`
 * does not answer, starts it with `envs[].start` in `appDir` and waits for it. An application already up (the
 * person's own) is used as it is. Throws `AppError` when the setup fails, the start fails, or the application is
 * down and the environment has no `start`.
 */
export async function ensureApp(settings: ProjectSettings, deps: EnsureAppDeps): Promise<RunningApp> {
  await prepareApp(settings, { ...deps, logFile: join(deps.logDir, `${settings.project}.setup.log`) });
  const { baseURL, start, nome } = settings.environment;
  if (await (deps.isUp ?? answers)(baseURL)) {
    return { started: false, stop: () => undefined };
  }
  if (start === undefined) {
    throw new AppError(
      `a aplicação não responde em ${baseURL} e o ambiente ${nome} não tem envs[].start: ` +
        `suba-a ou configure o start em ${configJsonPath(deps.projectsDir, settings.project)}.`,
    );
  }
  const logFile = join(deps.logDir, `${settings.project}.log`);
  deps.stderr.write(`subindo a aplicação: ${start} (em ${settings.appDir}; log em ${logFile})\n`);
  const app = (deps.launch ?? launchApp)(start, settings.appDir, logFile, deps.env);
  await waitUntilUp(settings, app, logFile, deps);
  return { started: true, stop: app.stop };
}
