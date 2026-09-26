import { spawnSync } from 'node:child_process';

export interface GitSpawnSyncResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

export type GitSpawnSync = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; encoding: 'utf8'; maxBuffer: number },
) => GitSpawnSyncResult;

export interface GitRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
}

export interface GitRunner {
  run(args: readonly string[], root: string, env?: NodeJS.ProcessEnv): GitRunResult;
}

export function createSpawnGitRunner(spawnFn: GitSpawnSync = spawnSync): GitRunner {
  return {
    run(args, root, env = process.env) {
      const result = spawnFn('git', [...args], {
        cwd: root,
        env,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 64,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        status: result.status ?? 1,
      };
    },
  };
}
