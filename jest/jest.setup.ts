import 'reflect-metadata';

import { Socket } from 'node:net';

// nest-commander reads `process.stdin` as soon as it is imported (for prompts, which choliba does not use).
// When stdin is a pipe or a terminal that opens a handle Jest reports as left open; no spec reads stdin, so it
// is unref'd. (From a file, as with `< /dev/null`, it is not a socket and holds nothing open.)
const stdin: unknown = process.stdin;
if (stdin instanceof Socket) {
  stdin.unref();
}
