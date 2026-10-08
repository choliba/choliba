import { messageOf } from '@choliba/core';
import type { CommandIo } from '@choliba/core/nest';

/** Every option goes on to the tool, `--help` included: these commands are the tool, run in the workspace. */
export const PASS_THROUGH = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** Runs `tool` and passes its exit code on; an error (no workspace, a missing tool) is a message and exit 1. */
export function passOn(io: CommandIo, tool: () => number): void {
  try {
    io.exit(tool());
  } catch (error) {
    io.fail(messageOf(error));
  }
}
