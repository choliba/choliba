# Testing a command

`@choliba/core/testing` is the fakes. Jest runs on Node, so a spec never calls `Bun`.

```ts
import { coreShell } from '@choliba/core';
import { fakePlatform, replace, runShell } from '@choliba/core/testing';

const platform = fakePlatform({ argv: ['terminal', 'run'] });
const code = await runShell([coreShell], platform, [replace(SOME_TOKEN, fake)]);

expect(code).toBe(1);
expect(platform.stderr.text()).toContain('Usage:');
```

- **`fakePlatform`** buffers stdout and stderr (`platform.stdout.text()`), fixes the clock at `FAKE_NOW`, starts
  from an empty env, and uses a spawn and a git that throw until the spec passes its own.
- **`runShell(modules, platform, overrides)`** builds the shell of those modules the way `main.ts` does, applies
  each `replace(token, value)` (`container.override`, so the factory is not called), runs `platform.argv` and
  resolves with the exit code.
- **A service** is `new Service(...)` with the fakes it needs. There is no testing module.
- **`FakeSignals`** records who subscribed and lets the spec `emit` a signal.

A command that reads the workspace needs a real temp directory on `platform.cwd` and the env keys it looks up.
Pass only the modules under test: the app's list is what `createCholibaShell` uses, and a spec does not need it
to prove one command.
