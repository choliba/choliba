import { readLines } from '../../terminal/stream-lines';

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readLines(stream)) {
    lines.push(line);
  }
  return lines;
}

const encoder = new TextEncoder();

describe('readLines', () => {
  it('yields nothing for an empty stream', async () => {
    await expect(collect(streamOf([]))).resolves.toEqual([]);
  });

  it('splits a single chunk into lines on \\n', async () => {
    const lines = await collect(streamOf([encoder.encode('one\ntwo\nthree\n')]));

    expect(lines).toEqual(['one', 'two', 'three']);
  });

  it('joins a line split across two chunks', async () => {
    const lines = await collect(streamOf([encoder.encode('hel'), encoder.encode('lo\nworld\n')]));

    expect(lines).toEqual(['hello', 'world']);
  });

  it('flushes a trailing line with no terminating \\n once the stream closes', async () => {
    const lines = await collect(streamOf([encoder.encode('complete\nincomplete')]));

    expect(lines).toEqual(['complete', 'incomplete']);
  });

  it('decodes a multi-byte UTF-8 character split across two chunk boundaries', async () => {
    // "café\n" — the "é" (U+00E9) encodes to 2 bytes; split the encoded buffer
    // between those two bytes to simulate a chunk boundary landing mid-character.
    const encoded = encoder.encode('café\n');
    const splitIndex = encoded.length - 2;
    const first = encoded.subarray(0, splitIndex + 1);
    const second = encoded.subarray(splitIndex + 1);

    const lines = await collect(streamOf([first, second]));

    expect(lines).toEqual(['café']);
  });

  it('preserves a bare \\r as ordinary content instead of interpreting it', async () => {
    const lines = await collect(streamOf([encoder.encode('progress: 50%\rprogress: 100%\n')]));

    expect(lines).toEqual(['progress: 50%\rprogress: 100%']);
  });

  it('preserves ANSI escape codes inside a line', async () => {
    const lines = await collect(streamOf([encoder.encode('\u001b[32mPASS\u001b[0m\n')]));

    expect(lines).toEqual(['\u001b[32mPASS\u001b[0m']);
  });
});
