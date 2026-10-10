---
name: cli-shell
description: How choliba's command line is built — the composition root in main.ts, the shell's container and command table, one ShellModule per package, ShellIo for arguments and exit codes, and how to add a command or an agent provider and test it with runShell. Use when creating or changing a command, a service, a shell module or an agent provider, or when asked where that code goes.
argument-hint: 'What you are building (command, service, provider...) and in which package.'
user-invocable: true
disable-model-invocation: false
---

# The shell

`packages/choliba/src/main.ts` is the composition root. It reads the process and Bun into a `Platform` and a
`Runtime`, strips the global flags, and runs `createCholibaShell(platform, runtime).run()`. There is no HTTP and
no decorator. The workspace stays `packages/*`: each package exports one `ShellModule`, and the app lists them.

Names, layers and which folder is a module: the `code-standard` skill. What the user sees (flags, stdout, exit
codes, pt-BR): `cli-guidelines`.

## Where code goes

- **One feature per folder.** `<feature>.service.ts` (a plain class), one `<action>.command.ts` per command (its
  pt-BR `CommandEntry` inside it), `dto/<action>.dto.ts` (a class with a constructor, never `field!`),
  `interfaces/*.interface.ts`, `<feature>.constants.ts` (tokens from `token<T>()`). The domain logic stays in
  plain functions; the service calls them. The package's `<feature>-shell.ts` registers the factories and lists
  the commands.
- **One entry per package.** `@choliba/<pkg>` (`src/index.ts`) exports the functions, the types, the tokens and
  the `ShellModule`. The Playwright runner loads that entry with its own Babel, which rejects a parameter
  decorator, so the barrel has none. The runner's typecheck also has no Bun types: a function that wraps
  `Bun.spawn` takes a structural type, and the real `Bun.spawn` is read only in `main.ts`.
- **Another package is reached only through `.`.** Never through a folder, and a package never imports its own
  entry from inside. A folder is reached only through its `index.ts`.

## What every command uses (`@choliba/core`)

- **`PLATFORM`**: the process, registered by `createShell` from what `main.ts` built (argv already without
  `--no-color`, cwd, env, stdout, stderr, clock, signals, spawn, which, git). Only `main.ts` reads Bun and
  `process`. Jest runs on Node, so nothing else may.
- **`CONFIG`** and **`THEME`**: a `ConfigService` and a `ThemeService`, registered by `coreShell` from
  `PLATFORM`. Another package's factory asks for them with `container.get(CONFIG)`.
- **`RUNTIME`**: the app's own token (`packages/choliba`), registered by `cholibaShell`. It is how `check`,
  `lint`, `format` and `setup` run ESLint, Prettier and the deferred setup step.
- **`ShellIo`**: the arguments as typed (`io.args('projects', 'list')`), stdout (`write`, `printHelp`), stderr
  (`fail`, `usageError`) and the exit code (`exit`). A command reads its own words; it does not reparse the
  global flags, which `main.ts` already removed.
- **`ShellCommand`**: `name` (the first word), optional `aliases`, `help(container)` (the root entries, omitted
  when the command stays out of `--help`) and `run(container, io)`.

## Steps for a new command

1. Read `cli-guidelines` and write the failing spec first (`references/testing.md`).
2. The logic as plain functions in the feature folder. The service calls them with what its factory reads from
   the container.
3. The command object: `help` returns a `CommandEntry` (name, the line `--help` lists, group, spec). `run` reads
   `io.args('<name>')`, calls the service, then `io.exit(code)`, `io.fail(message)` or `io.usageError(message, program)`.
   Its own `--help` prints `entryHelp(entry)`.
4. Register the service with `container.provide(TOKEN, (container) => new Service(...))` in the package's
   `ShellModule`, and add the command to that module's `commands`. The root lists it from `help` with no change
   to the app, in the order of `CHOLIBA_ORDER` when the name is there. Check the first word does not shadow an
   agent name (`cli-guidelines`). A command with no `help` does not appear in `--help` (`terminal`).
5. `bun run check`. After a tool config change, `bash .agents/skills/quality-gates/scripts/verify.sh`.

## Adding an agent provider

1. `packages/agents/src/providers/<id>/<id>-agent.provider.ts`: a plain class `extends AgentProvider` with `id`,
   `binaries`, `autoPriority`, `buildArgs`, `createParser` (and the optional hooks), exported from
   `providers/index.ts`.
2. Add an instance to the list `agentsShell` builds `AGENT_PROVIDERS` from (`agents/agents-shell.ts`):
   `--provider <id>`, `--<id>`, `auto`'s order and completion follow with no other change.
3. Specs: its args and parser, and the registry spec, which the new provider must not break.

## The root and the fallback

At most one module has `root` (the app's `cholibaShell`): empty line and `help` print the sorted help,
`version` prints `version()`, and `__complete`, `__describe` and `__entries` answer before any command lookup.
`shell.has('__complete')` stays false: those words are not `ShellCommand`s.

At most one module has `fallback` (`agentsShell`). A first word that is no command runs it, with the whole
command line. Without a fallback, that word is a usage error. Two roots, two fallbacks, or two commands claiming
one word throw when the shell is built.

## Tests

`references/testing.md`: `runShell([module], fakePlatform({ argv }))` for a command line, `new Service(...)` for
a service, `@choliba/core/testing` for the fakes. Never `bun test`.
