import type { Platform } from '../../platform';
import type { BufferWritable } from '../buffer-writable';

/** The platform a spec gets from `fakePlatform`: buffered stdout and stderr. */
export interface FakePlatform extends Platform {
  readonly stdout: BufferWritable;
  readonly stderr: BufferWritable;
}
