---
name: code-standard
description: The one code standard of choliba's packages — library vs app and their entries (`.` and `./nest`), the layers of a package's `src/` (common, domain, orchestration, module, entries) with an `index.ts` per folder and imports only downward, kebab-case names with Nest's `<name>.<type>.ts` types, one CLI command per file, help owned by `@choliba/core`, English code — and how ESLint enforces it package by package (`eslint.structure.ts`). Use before creating or moving any file or folder under `packages/`, naming one, adding a command, deciding whether a folder is a Nest module, or when someone asks where something goes or why lint says a dependency or file name is not allowed.
argument-hint: 'What you are adding or moving, and in which package.'
user-invocable: true
disable-model-invocation: false
---

# Code standard

choliba is a framework: developers write inside its conventions (`.choliba/agents/<id>/agent.yaml`, a project's
`tickets/` and `tests/`, specs that import the runner's pages). A convention only works when it is one and
predictable, for our code and for that public surface. These rules have no implicit exceptions; an exception is
written here, with its reason.

## 1. Packages and entries

- **Library** (no `bin`): exactly two entries, `.` (`src/index.ts`: functions and types) and `./nest`
  (`src/nest.ts`: the app's side: modules, services, commands, and what touches Bun). `.` must load anywhere,
  under Node too, as the Playwright runner does: no Nest decorators (its Babel rejects them) and nothing of Bun,
  not even its types (the runner's typecheck has none). `@choliba/terminal`'s `createBunProcessSpawner`, used only
  by the apps' `main.ts`, is in `./nest` for that reason. Playwright reaches only `core`, `projects` and `terminal`
  (`playwright-loaded.spec.ts` checks it); every other library keeps the same two entries anyway, so the convention is
  one.
- **Extra entries**, only these: `@choliba/core/testing` (fakes for specs) and the runner's entries that projects'
  specs import (public surface).
- **App** (`bin`): `src/main.ts` and `app.module.ts`; nothing imports an app. What both apps need lives in
  `@choliba/core`: `RuntimeModule.forRoot(runtime)` with the `RUNTIME` token (each app keeps the interface of its
  runtime) and `findManifest`/`versionLine` for `--version`.

## 2. Layers of a package's `src/`

Every folder of `src/` belongs to one layer and imports only its own layer and the layers below it, from its own
package, through the folder's public face (folders of one layer may build on each other; a cycle between them is
rejected):

| Layer | What it holds |
| --- | --- |
| `common/` | what two or more folders **of this package** share and no domain owns (what several packages share is `@choliba/core`) |
| domain | folders of pure functions about one subject (`skills/`, `steps/`) |
| orchestration | folders of pure functions that combine domains (`runs/`) |
| module | folders that expose a service, a command or an injectable value: a `*.module.ts`, the Nest shell. A module may also import other modules |
| entries | the files right in `src/`: `index.ts`, `nest.ts`, `main.ts`, `app.module.ts` |

- **A folder is a module** when it exposes a service, a command or an injectable value; with only logic, it is a
  folder of functions. A module keeps its domain's files, in subfolders when they are many (`agents/` has
  `agent-loader.ts`, `invocation.ts`, `steps/`, `runs/`; `tickets/` has `ticket.ts`, `ticket-template.ts`…).
- **What two modules share goes down to `common/`** (or to a domain folder, as `projects`' `paths/`), so that they
  never import each other in a cycle: `agents/` and `providers/` both use the agent's types, permissions,
  variables and MCPs, the provider's contract, events and parser, the prompt and the run tools, so all of that is
  in `agents`' `common/`. A subfolder belongs to its folder: inside it, files import each other directly.
- **Every folder has a public face**: `index.ts` (functions and types); a module folder also `nest.ts` (its module,
  services, commands), as the package has `.` and `./nest`, so that `src/index.ts` never loads a decorator. Nothing
  outside the folder imports any other file inside it. `src/index.ts` and `src/nest.ts` only gather the folders'
  faces.
- **Another package** is reached only through its entries (`@choliba/<pkg>`, `@choliba/<pkg>/nest`), never its
  folders; a package never imports its own entries from inside.
- **No cycles**, between files or folders.

## 3. Names

- **Files and folders**: kebab-case (`run-tool-path.ts`), never camelCase or PascalCase, public surface included:
  the runner's `shared/` and `reporters/`, which Playwright loads by path, are checked too.
- **Nest pieces**: Nest's naming, `<name>.<type>.ts`, with only these types: `module`, `service`, `provider`,
  `decorator`, `interface` (in `interfaces/`), `dto`, `command` (nest-commander) and `constants` (injection tokens
  only, as `@nestjs/config`'s `config.constants.ts`). An agent provider is a Nest provider
  (`claude-agent.provider.ts`); the decorator that marks it is `register-agent-provider.decorator.ts`.
- **Functions**: `domain-action.ts`, no type suffix, the domain first (`ticket-superseded.ts`, `project-settings.ts`,
  `delete-tool.ts`, `theme-defaults.ts`).
- **One word, one meaning**: `command` is only a CLI command class; an agent turned into what `choliba <agent>` runs
  is an **invocation** (`AgentInvocation`). The same holds for `provider`, `help`, `tool` and `registry`.

## 4. CLI commands

- **One command per file**: `<action>.command.ts` → class `<Action>Command` → `choliba <subject> <action>`. A
  command that only groups others takes the subject's name (`projects.command.ts` → `choliba projects`).
- **Its CLI spec** (help and completion) lives in the command file, returned by its `helpEntries()`; when it is long,
  in a function file next to it, `<action>-spec.ts`. There is no `*.help.ts`.

## 5. Help belongs to `@choliba/core`

- `core/src/help/` (`HelpModule`): the formatting and completion (`CliHelpService`), `@RegisterHelp()` and the
  `HelpRegistryService`, which gathers the `helpEntries()` of every registered command, in the order the app
  registers its modules.
- `core/src/cli/`: the root, as it is made of commands: `RootModule.forRoot({ spec, version })` gives the app
  `<app>`, `--help`, `--version`, `__complete` and `__describe`. A first word that is not a command goes to the
  provider marked `@RegisterRootFallback()` (`choliba <agent>`), or is a usage error when there is none.
- An app only says who it is; nothing outside `core` lists commands or prints help. Direction inside core:
  `platform` → `help` → `cli`.

## 6. Language

Code, names and comments in English. What developers read (CLI output, messages, documentation) in Portuguese.

## 7. Enforced by ESLint, package by package

`eslint.structure.ts` (imported by `eslint.config.ts`) lists in `STRUCTURE` each package that already follows the
standard, with its folders by layer. For those packages `bun run lint` fails on:

- `boundaries/dependencies` ([eslint-plugin-boundaries](https://www.jsboundaries.dev)): an import upward, into
  another folder's inner file instead of its `index.ts`/`nest.ts`, into another package's folder, or into its own
  entries;
- `import-x/no-cycle`: a cycle between files;
- `check-file/filename-naming-convention` and `check-file/folder-naming-convention`: a name outside section 3.

To migrate a package: move it to the standard, add it to `STRUCTURE` (`common` is implicit), run `bun run check`.
Specs (`src/__tests__/`) are not checked.

## Migration status

Plan 035 migrates the packages in this order, all in one pull request at the end: `core`, `terminal`, `projects` and
`runner` (done; breaking: the runner's public `shared/` files became kebab-case, as `./shared/pages/base-page`) and
`agents` (done), then the two apps. A package not yet in `STRUCTURE` keeps its current layout until its turn; new code in it
already follows these rules where it can.
