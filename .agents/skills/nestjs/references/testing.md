# Testing Nest code in choliba

One Jest config at the root, specs only in `src/__tests__/**/*.spec.ts`. Never `bun test`.

## A command line: `runCommand`

```ts
import { fakePlatform, runCommand } from '@choliba/core/testing';

const platform = fakePlatform({ argv: ['projects', 'list'], cwd: workspace });
const exitCode = await runCommand([ProjectsModule], platform);
expect(platform.stdout.text()).toContain('demo');
```

`runCommand` builds the modules with `PlatformModule.forRoot(platform)`, runs `platform.argv` the way `main.ts`
does and resolves with the exit code the command set (`ExitStatus`). Its third argument replaces providers
(`[{ provide: TOKEN, useValue }]`). `fakePlatform` gives buffers for stdout/stderr (`BufferWritable`, a TTY with
`new BufferWritable(true)`), `FakeSignals`, a fixed clock, no environment, and spawn/git that fail unless the spec
passes its own. Use real temp workspaces (a `package.json` depending on choliba and a `.env`) rather than mocks.

## A service: `Test.createTestingModule`

```ts
const moduleRef = await Test.createTestingModule({
  imports: [PlatformModule.forRoot(fakePlatform({ cwd })), ProjectsModule],
}).compile();
const spec = moduleRef.get(ProjectsService).helpSpec();
```

Call `moduleRef.init()` when the module discovers providers (`ProviderRegistryService`).

## Coverage

Modules, commands and services are covered by these specs; nothing new is excluded (only `main.ts`). A barrel
spec (`Object.entries(barrel)`, every value defined) covers `index.ts` and `nest.ts`.
