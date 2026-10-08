---
name: nestjs
description: How choliba is built on NestJS and nest-commander (no HTTP) — where a module, service, command or provider goes, the pure `@choliba/<pkg>` vs `@choliba/<pkg>/nest` split, explicit injection without decorator metadata, the platform and runtime as injectable values, raw command arguments, how to add a command or an agent provider, and how to test them with Jest. Use when creating or changing any module, service, command, agent provider or Nest spec here, when asked where Nest code goes, or when someone mentions `@Module`, `@Injectable`, `@Command`, nest-commander, `nest g` or docs.nestjs.com.
argument-hint: 'What you are building (command, module, provider...) and in which package.'
user-invocable: true
disable-model-invocation: false
---

# NestJS in choliba

Every package is a Nest library and `packages/choliba` is the one app (`AppModule` + `main.ts`). Nest gives
modules and dependency injection; **nest-commander** turns them into the `choliba` command line. There is no
HTTP. The workspace (`packages/*`) stays: the Nest CLI "monorepo mode" (`nest-cli.json`, `libs/`) is not used
(`references/workspace-mapping.md`).

## Where code goes

- **One feature per folder** (as `cats/` in docs.nestjs.com/modules), the command in place of the controller:
  `<feature>.module.ts`, `<feature>.service.ts`, one `<action>.command.ts` per command (its pt-BR `CommandSpec`
  inside it), `dto/<action>.dto.ts` (a class with a constructor, never `field!`), `interfaces/*.interface.ts`,
  `<feature>.constants.ts` (injection tokens). The domain logic stays in plain functions; the service is thin and
  calls them. Names, layers and which folder is a module: the `code-standard` skill.
- **Two entry points per package.** `@choliba/<pkg>` (and its subpaths) export plain functions and types only;
  `@choliba/<pkg>/nest` exports the modules, services and commands. The Playwright runner loads the first with
  its own Babel, which rejects parameter decorators; a spec walks its imports and fails on any decorator
  (`references/typescript-and-di.md`).
- **`exports` explicit, no `@Global`**, except `PlatformModule.forRoot(platform)` and the app's
  `RuntimeModule.forRoot(runtime)`: their values only exist at `forRoot`, so importing the module itself would
  give an empty one. A module imports another module and injects its exported service, never its inner files.

## The pieces every command uses (`@choliba/core`)

- **`PlatformModule.forRoot(platform)`**: the process and Bun as tokens (`ARGV`, `CWD`, `ENV`, `STDOUT`,
  `STDERR`, `CLOCK`, `SIGNALS`, `SPAWN`, `WHICH`, `GIT`, `NO_COLOR_FLAG`) and `ExitStatus`. Only `main.ts` reads
  Bun and `process`; Jest runs on Node, so nothing else may.
- **`CliCommand`**: the base of every command; it turns the parser's own help off, so `-h`, `--help` and `help`
  reach `run()` and the command prints its pt-BR help from its `CommandSpec`.
- **`CommandIo`**: the arguments as typed (`io.args('projects', 'create-project')`), stdout, help, usage errors
  and the exit code, in one injection. Commands read their arguments raw: the parser reorders unknown options
  and drops `--`, so it only dispatches (`allowUnknownOptions`, `allowExcessArgs`).
- **`ConfigService`** (workspace root, `.env`), **`ThemeService`** (colors, decided once), **`CliHelpService`**.

## Steps for a new command

1. Read `cli-guidelines` (flags, stdout/stderr, exit codes, pt-BR) and write the failing spec first.
2. The logic as plain functions in the feature folder; the service calls them with what it injects.
3. The command: `@Command({ name, allowUnknownOptions: true, allowExcessArgs: true })`, `extends CliCommand`,
   every constructor parameter with `@Inject(...)` (`references/typescript-and-di.md`): help first, then the
   service, then `io.exit(code)` or `io.fail(messageOf(error))`.
4. Its help: the command is `@RegisterHelp()` and returns its `CommandEntry` from `helpEntries()` (name, the line
   `--help` lists it with, group, spec); its own `--help` prints `entryHelp(entry)`. The root's help and completion
   list it with no other change (`code-standard`). Its module goes in `AppModule`; check it does not shadow an agent
   name (`cli-guidelines`).
5. `bun run check`; after a tool config change, `bash .agents/skills/quality-gates/scripts/verify.sh`.

## Adding an agent provider

1. `packages/agents/src/providers/<id>/<id>-agent.provider.ts`: a class `extends AgentProvider` with `id`,
   `binaries`, `autoPriority`, `buildArgs`, `createParser` (and the optional hooks), decorated
   `@RegisterAgentProvider()` and `@Injectable()`.
2. `<id>-provider.module.ts` with it in `providers`, imported by `AgentsModule`. The registry finds it:
   `--provider <id>`, `--<id>`, `auto`'s order and completion follow with no other change.
3. Specs: its args and parser, and the registry spec, which the new provider must not break.

## Tests

`references/testing.md`: `runCommand([Module], fakePlatform({ argv, cwd }))` for a command line,
`Test.createTestingModule` for a service, `@choliba/core/testing` for the fakes. Never `bun test`.

## Versions

NestJS `~11.2`: Nest 12 is ESM-only and nest-commander still `require()`s it, which Bun refuses. Move when
nest-commander ships ESM. API questions: docs.nestjs.com and nest-commander.jaymcdoniel.dev, via
`references/docs-map.md`, not memory.
