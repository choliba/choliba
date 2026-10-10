import { Socket } from 'node:net';

// When stdin is a pipe or a terminal that opens a handle Jest reports as left open; no spec reads stdin, so it
// is unref'd. (From a file, as with `< /dev/null`, it is not a socket and holds nothing open.)
const stdin: unknown = process.stdin;
if (stdin instanceof Socket) {
  stdin.unref();
}
