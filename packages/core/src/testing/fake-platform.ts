import type { GitRunner, ProcessSpawner } from '../platform';
import { BufferWritable } from './buffer-writable';
import { FakeSignals } from './fake-signals';
import type { FakePlatform } from './interfaces/fake-platform.interface';

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

/**
 * A `Platform` for specs: buffers for stdout/stderr, a fixed clock, no environment, no executables, and spawn/git
 * that fail unless the spec passes its own.
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
