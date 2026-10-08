import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

/** The application's server, started by choliba. */
export interface LaunchedApp {
  /** Its exit code once it ended (`null` when a signal ended it); `undefined` while it runs. */
  readonly exitCode: () => number | null | undefined;
  /** Stops it and everything it started (the whole process group): SIGTERM, then SIGKILL if it lingers. */
  readonly stop: () => void;
}

const KILL_AFTER_MS = 5_000;

/** The exit code a shell gives a command it could not run, used when the server could not even be started. */
const NOT_STARTED = 127;

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

/**
 * Starts `command` in a shell, in `cwd`, as the leader of a process group of its own (so stopping it stops the
 * dev server it spawns too), its output written to `logFile` (from scratch). If choliba exits without stopping it, the group is
 * stopped on the way out, so the application never outlives the run. One that cannot even start (a missing `cwd`)
 * ends at once with code 127.
 */
export function launchApp(
  command: string,
  cwd: string,
  logFile: string,
  env: NodeJS.ProcessEnv,
  killAfterMs = KILL_AFTER_MS,
): LaunchedApp {
  mkdirSync(dirname(logFile), { recursive: true });
  // A new log each time it starts: the end of it is what explains a failure, not an earlier run's.
  const log = openSync(logFile, 'w');
  const child = spawn(command, { cwd, env, shell: true, detached: true, stdio: ['ignore', log, log] });
  closeSync(log);
  let exit: number | null | undefined;
  child.on('exit', (code) => {
    exit = code;
  });
  child.on('error', () => {
    exit = NOT_STARTED;
  });
  const { pid } = child;
  const onExit = (): void => {
    signalGroup(pid, 'SIGKILL');
  };
  process.once('exit', onExit);
  return {
    exitCode: () => exit,
    stop: () => {
      process.off('exit', onExit);
      if (exit !== undefined) return;
      signalGroup(pid, 'SIGTERM');
      setTimeout(() => {
        signalGroup(pid, 'SIGKILL');
      }, killAfterMs).unref();
    },
  };
}

/** Whether something answers at `url`: any HTTP response counts; a refused or timed-out connection does not. */
export async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
}
