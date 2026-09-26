/**
 * Splits a byte stream into lines, decoding UTF-8 incrementally so a multi-byte
 * character split across two chunks is not corrupted, and flushing any trailing
 * partial line (one with no `\n`) once the stream closes.
 *
 * Splits only on `\n`; a bare `\r` (used by progress-bar-style tools to overwrite
 * a line) is preserved as ordinary content rather than interpreted as a cursor
 * command — solving terminal cursor semantics is out of scope for this step.
 */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      yield buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) {
    yield buffer;
  }
}
