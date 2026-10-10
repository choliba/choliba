---
name: code-standard
description: The one code standard of choliba's packages — a library's single entry (.) and the app's main.ts, the layers of src/ (common, domain, orchestration, module, entries) with an index.ts per folder and imports only downward, kebab-case names and the type suffixes still in use, one CLI command per file, help owned by @choliba/core, English code — and how ESLint enforces it (eslint.structure.ts). Use before creating or moving any file under packages/, naming one, adding a command, or when lint rejects a dependency or a file name.
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

- **Library** (no `bin`): one entry, `.` (`src/index.ts`: functions, types, tokens and the package's
  `ShellModule`). It must load anywhere, under Node too, as the Playwright runner does: no decorators (its Babel
  rejects a parameter decorator) and nothing that names the `Bun` global in a type the runner typechecks (the
  runner's tsconfig has `node` and `jest` only). `createBunProcessSpawner` takes a structural function type for
  that reason; `main.ts` is the one place that reads `Bun.spawn`.
- **Extra entries**, only these: `@choliba/core/testing` (fakes for specs) and the runner's entries that projects'
  specs import (public surface).
- **App** (`bin`): `src/main.ts`, wiring only. Nothing imports an app. It builds the `Platform` and the `Runtime`
  and calls `createCholibaShell(platform, runtime).run()`. `--version` uses `findManifest` and `versionLine` from
  `@choliba/core`.

## 2. Layers of a package's `src/`

Every folder of `src/` belongs to one layer and imports only its own layer and the layers below it, from its own
package, through the folder's `index.ts` (folders of one layer may build on each other; a cycle between them is
rejected):

| Layer | What it holds |
| --- | --- |
| `common/` | what two or more folders **of this package** share and no domain owns (what several packages share is `@choliba/core`) |
| domain | folders of pure functions about one subject (`paths/`, `steps/`) |
| orchestration | folders of pure functions that combine domains (`runs/`) |
| module | folders that expose a service, a command or a token: the package's `ShellModule` lives in one of them |
| entries | the files right in `src/`: `index.ts` and, in the app, `main.ts` |

- **A folder is a module** when it exposes a service, a command or a token; with only logic, it is a folder of
  functions. A module keeps its domain's files, in subfolders when they are many (`agents/` has `agent-loader.ts`,
  `invocation.ts`, `steps/`, `runs/`; `tickets/` has `ticket.ts`, `ticket-template.ts`…).
- **What two modules share goes down to `common/`** (or to a domain folder, as `projects`' `paths/`), so that they
  never import each other in a cycle: `agents/` and `providers/` both use the agent's types, permissions,
  variables and MCPs, the provider's contract, events and parser, the prompt and the run tools, so all of that is
  in `agents`' `common/`. A subfolder belongs to its folder: inside it, files import each other directly.
- **Every folder has one public face**: `index.ts`. Nothing outside the folder imports any other file inside it.
  `src/index.ts` only gathers the folders' faces. `terminal/` does not import `shell/`: the command that wires the
  process runner lives in `shell/terminal.command.ts` and imports `terminal/` through its `index.ts`.
- **Another package** is reached only through its entry (`@choliba/<pkg>`), never its folders; a package never
  imports its own entry from inside.
- **No cycles**, between files or folders.

## 3. Names

- **Files and folders**: kebab-case (`run-tool-path.ts`), never camelCase or PascalCase, public surface included:
  the runner's `shared/` and `reporters/`, which Playwright loads by path, are checked too.
- **Typed files**: `<name>.<type>.ts`, with only these types: `service`, `provider`, `interface` (in
  `interfaces/`), `dto`, `command` and `constants` (injection tokens only). An agent provider is
  `<id>-agent.provider.ts`. A file of functions has no type suffix (`ticket-superseded.ts`).
- **Functions**: `domain-action.ts`, the domain first (`ticket-superseded.ts`, `project-settings.ts`,
  `delete-tool.ts`, `theme-defaults.ts`).
- **One word, one meaning**: `command` is only a CLI command; an agent turned into what `choliba <agent>` runs
  is an **invocation** (`AgentInvocation`). The same holds for `provider`, `help`, `tool` and `registry`.

## 4. CLI commands

- **One command per file**: `<action>.command.ts` exports a `ShellCommand` (`name`, `help`, `run`) for
  `choliba <subject> <action>`. A command that only groups others takes the subject's name
  (`projects.command.ts` → `choliba projects`).
- **Its CLI spec** lives in the command file as a `CommandEntry`; when it is long, in a function file next to it,
  `<action>-spec.ts`. There is no `*.help.ts`. `help(container)` returns the entries the root lists.

## 5. Help belongs to `@choliba/core`

- `core/src/help/`: formatting (`formatHelp`, `entryHelp`, `formatRows`) and completion (`complete`, `describe`,
  `formatSuggestions`). A command's `help` returns `CommandEntry`s; the root sorts them.
- The app's root is the `root` of `cholibaShell`: `spec`, `version()`, `groups` and `order`. It handles an empty
  line, `help`/`--help`/`-h`, `version`/`--version`, `__complete`, `__describe` and `__entries` before the command
  table. A first word that is not a command goes to the one module with `fallback` (`choliba <agent>`), or is a
  usage error when there is none.
- An entry with `listed: false` is completed and described but not listed by `--help` (the `choliba <agent>`
  shortcuts). A command with no `help` is absent from both (`terminal`). Nothing outside `core` lists commands or
  prints help.

## 6. Language

Code, names and comments in English. What developers read (CLI output, messages, documentation) in Portuguese.

## 7. Enforced by ESLint, package by package

`eslint.structure.ts` (imported by `eslint.config.ts`) lists in `STRUCTURE` each package that already follows the
standard, with its folders by layer. For those packages `bun run lint` fails on:

- `boundaries/dependencies` ([eslint-plugin-boundaries](https://www.jsboundaries.dev)): an import upward, into
  another folder's inner file instead of its `index.ts`, into another package's folder, or into its own entries;
- `import-x/no-cycle`: a cycle between files;
- `check-file/filename-naming-convention` and `check-file/folder-naming-convention`: a name outside section 3.

A new package is added to `STRUCTURE` (`common` is implicit) in its first commit, then `bun run check`. Specs
(`src/__tests__/`) are not checked.

## Where the packages stand

`core`, `projects`, `runner`, `agents` and the app `choliba` are in `STRUCTURE`, so `bun run lint` holds the
codebase to this standard. The process runner lives in `core`'s `terminal/` folder, not in a package of its own.
