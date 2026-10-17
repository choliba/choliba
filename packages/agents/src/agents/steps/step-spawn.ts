import { spawn, type SpawnOptions } from 'node:child_process';

/**
 * Runs `command` with `args` and resolves to its exit status once it ends, leaving the process free meanwhile (a
 * spinner turns, Ctrl+C is heard). `null` when a signal ended it, `signal` aborted it, or it did not start.
 */
export function spawnToEnd(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
): Promise<{ readonly status: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], options);
    // A command that does not start emits `error` and then `close`: the first to come decides.
    child.on('error', () => {
      resolve({ status: null });
    });
    child.on('close', (code) => {
      resolve({ status: code });
    });
  });
}
