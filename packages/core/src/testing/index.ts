import type { ModuleMetadata } from '@nestjs/common';
import { CommandTestFactory } from 'nest-commander-testing';

import { ExitStatus } from '../platform/exit-status';
import type { GitRunner } from '../platform/git-run';
import type {
  Platform,
  ProcessSpawner,
  SignalSource,
  WritableWithColumns,
} from '../platform/interfaces/platform.interface';
import { PlatformModule } from '../platform/platform.module';

/** A stdout/stderr that keeps what was written, for specs. */
export class BufferWritable implements WritableWithColumns {
  readonly chunks: string[] = [];

  constructor(readonly isTTY = false) {}

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  text(): string {
    return this.chunks.join('');
  }
}

/** Signals a spec can send (`emit`) to whatever subscribed. */
export class FakeSignals implements SignalSource {
  private readonly listeners = new Map<NodeJS.Signals, Set<() => void>>();

  on(event: NodeJS.Signals, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: NodeJS.Signals, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: NodeJS.Signals): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener();
    }
  }

  count(event: NodeJS.Signals): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

const NO_SPAWN: ProcessSpawner = {
  spawn(options) {
    throw new Error(`este spec não esperava rodar ${options.command.join(' ')}`);
  },
};

const NO_GIT: GitRunner = {
  run(args) {
    return { stdout: '', stderr: `este spec não esperava rodar git ${args.join(' ')}`, status: 1 };
  },
};

/** The fixed time of `fakePlatform().clock`. */
export const FAKE_NOW = new Date('2026-01-02T03:04:05.000Z');

export interface FakePlatform extends Platform {
  readonly stdout: BufferWritable;
  readonly stderr: BufferWritable;
}

/**
 * A `Platform` for `PlatformModule.forRoot` in specs: buffers for stdout/stderr, a fixed clock, no
 * environment, no executables, and spawn/git that fail unless the spec passes its own.
 */
export function fakePlatform(overrides: Partial<FakePlatform> = {}): FakePlatform {
  return {
    argv: [],
    cwd: '/nowhere',
    env: {},
    stdout: new BufferWritable(),
    stderr: new BufferWritable(),
    clock: () => FAKE_NOW,
    signals: new FakeSignals(),
    spawn: NO_SPAWN,
    which: () => null,
    git: NO_GIT,
    noColorFlag: false,
    ...overrides,
  };
}

/** A provider a spec replaces (`overrideProvider(provide).useValue(useValue)`). */
export interface ProviderOverride {
  readonly provide: string | symbol | (abstract new (...args: never[]) => unknown);
  readonly useValue: unknown;
}

/**
 * Runs `platform.argv` as a command line against `imports` (the modules under test, with
 * `PlatformModule.forRoot(platform)`), the way `main.ts` does, and resolves with the exit code the command set.
 */
export async function runCommand(
  imports: NonNullable<ModuleMetadata['imports']>,
  platform: Platform,
  overrides: readonly ProviderOverride[] = [],
): Promise<number> {
  const builder = CommandTestFactory.createTestingCommand({
    imports: [PlatformModule.forRoot(platform), ...imports],
  });
  for (const { provide, useValue } of overrides) {
    builder.overrideProvider(provide).useValue(useValue);
  }
  const app = await builder.compile();
  await CommandTestFactory.runWithoutClosing(app, [...platform.argv]);
  const code = app.get(ExitStatus).code();
  await app.close();
  return code;
}
