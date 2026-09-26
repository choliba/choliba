// Fixture run by the real `bun` binary from the integration spec (never imported by
// Jest): prints one line with ANSI color to stdout, one plain line to stderr, then
// exits with a known non-zero code so the integration test can assert on all three.
console.log('\u001b[32mPASS\u001b[0m build finished');
console.error('a warning on stderr');
process.exit(7);
