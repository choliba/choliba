export type {
  Clock,
  Environment,
  Platform,
  ProcessSpawner,
  SignalSource,
  SpawnCommandOptions,
  SpawnedProcess,
  Which,
  Writable,
  WritableWithColumns,
} from './interfaces/platform.interface';
export type { GitRunResult, GitRunner, GitSpawnSync, GitSpawnSyncResult } from './git-run';
export { createSpawnGitRunner } from './git-run';
export { takeGlobalFlags, type GlobalFlags } from './global-flags';
export { rawArgsAfter } from './raw-args';
export { ARGV, CLOCK, CWD, ENV, GIT, NO_COLOR_FLAG, SIGNALS, SPAWN, STDERR, STDOUT, WHICH } from './platform.constants';
