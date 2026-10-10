import type { WritableWithColumns } from '../platform';

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
