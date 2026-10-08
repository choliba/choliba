export { printBox, type BoxOptions } from './terminal/box';
export { CircularBuffer } from './terminal/circular-buffer';
export type { SignalSource } from '@choliba/core';
export { exitCodeFor } from './terminal/exit-code';
export { formatDuration } from './terminal/format-duration';
export { DEFAULT_SPINNER_FRAMES, LiveRegion, type LiveRow } from './terminal/live-region';
export {
  defaultStderr,
  defaultStdout,
  isStdoutTty,
  writeStderr,
  writeStdout,
  type Writable,
  type WritableWithColumns,
} from './terminal/writable';
export type { Listener } from './terminal/event-emitter';
export { TypedEventEmitter } from './terminal/event-emitter';
export type { AnsiColor, FormatterOptions } from './terminal/formatter';
export { colorForLabel, formatLine } from './terminal/formatter';
export { ProcessRunnerService } from './terminal/process-runner.service';
export type { ProcessRunnerOptions } from './terminal/process-runner.service';
export { Session } from './terminal/session';
export type { SessionParams } from './terminal/session';
export type { ProcessSpawner, SpawnCommandOptions, SpawnedProcess, BunSpawnFn } from './terminal/spawn';
export { createBunProcessSpawner } from './terminal/spawn';
export { readLines } from './terminal/stream-lines';
export { RunDto, parseRunArgs } from './terminal/dto/run.dto';
export type {
  ProcessRunnerEvents,
  RunOptions,
  SessionEvents,
  SessionExitEvent,
  SessionInfo,
  SessionLineEvent,
  SessionStatus,
  StreamName,
} from './terminal/types';
