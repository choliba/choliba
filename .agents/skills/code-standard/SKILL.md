---
name: code-standard
description: The one code standard of choliba's packages — a library's single entry (.) and the app's main.ts, the layers of src/ (common, domain, orchestration, module, entries) with an index.ts per folder and imports only downward, kebab-case names and the type suffixes still in use, one CLI command per file, help owned by @choliba/shell, English code — and how ESLint enforces it (eslint.structure.ts). Use before creating or moving any file under packages/, naming one, adding a command, or when lint rejects a dependency or a file name.
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
- **Extra entries**, only these: `@choliba/kernel/testing`, `@choliba/shell/testing` and `@choliba/tui/testing`
  (fakes for specs), and the
  runner's entries that projects' specs import (`@choliba/runner/shared/env`,
  `@choliba/runner/shared/pages/base-page`).
- **App** (`bin`): `src/main.ts`, wiring only. It builds the `Platform` and the `Runtime` and calls
  `createCholibaShell(platform, runtime).run()`. `src/index.ts` exports that shell (`createCholibaShell`,
  `cholibaShell`, `CHOLIBA_SHELL` and the `Runtime` type) and the read-only facade for scripts (`choliba`,
  `openCholiba`, from the `library/` folder), and does nothing on import. Nothing else imports `main.ts`. The facade is
  the one other place that reads the process (`process.cwd()`, `process.env`), and only when a script uses it and
  passes no `cwd` or `env`: a script has no `main.ts` to build a `Platform` for it. `--version` uses `findManifest`
  and `versionLine` from `@choliba/kernel`.
- **Installed package.** `choliba` republishes each of those entries as a subpath: `choliba`, `choliba/core`,
  `choliba/core/testing`, `choliba/agents`, `choliba/projects`, `choliba/runner`, `choliba/sandbox`, `choliba/runner/env`,
  `choliba/runner/pages/base-page` and `choliba/eslint`. Experimental until 1.0. Code in this repository keeps
  importing `@choliba/<pkg>`.

## 2. Layers of a package's `src/`

Every folder of `src/` belongs to one layer and imports only its own layer and the layers below it, from its own
package, through the folder's `index.ts` (folders of one layer may build on each other; a cycle between them is
rejected):

| Layer | What it holds |
| --- | --- |
| `common/` | what two or more folders **of this package** share and no domain owns; cross-package behavior belongs to its owning package, while runtime primitives belong in `@choliba/kernel` |
| domain | folders of pure functions about one subject (`paths/`, `steps/`) |
| ports | interfaces a package asks of the outside, over its domain (the engine's provider and screen) |
| orchestration | folders of pure functions that combine domains (`runs/`) |
| module | folders that expose a service, a command or a token: the package's `ShellModule` lives in one of them |
| entries | the files right in `src/`: `index.ts` and, in the app, `main.ts` |

- **A folder is a module** when it exposes a service, a command or a token; with only logic, it is a folder of
  functions. A module keeps its domain's files, in subfolders when they are many (`agents/` has `agent-loader.ts`,
  `invocation.ts`, `steps/`, `runs/`; `tickets/` has `ticket.ts`, `ticket-template.ts`…).
- **What two modules share goes down to `common/`** (or to a domain folder), so that they never import each other
  in a cycle. Cross-package types and behavior live in the package that owns that domain, not in an unrelated
  catch-all. A subfolder belongs to its folder: inside it, files import each other directly.
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
- **One word, one meaning**: `command` is only a CLI command; an agent turned into what `choliba run agent` runs
  is an **invocation** (`AgentInvocation`). The same holds for `provider`, `help`, `tool` and `registry`.

## 4. CLI commands

- **One command per file**: `<subject>-<action>.command.ts` exports a `ShellCommand` (`name`, `help`, `run`), for
  `choliba <verb> <type>` or for a command of its own word: `agents-run.command.ts` → `choliba run agent`,
  `projects-list.command.ts` → `choliba list projects`, `check.command.ts` → `choliba check`.
- **Its CLI spec** lives in the command file as a `CommandEntry`; when it is long, in a function file next to it,
  `<action>-spec.ts`. There is no `*.help.ts`. `help(container)` returns the entries the root lists.

## 5. Help belongs to `@choliba/shell`

- `shell/src/help/`: formatting (`formatHelp`, `entryHelp`, `formatRows`) and completion (`complete`, `describe`,
  `formatSuggestions`). A command's `help` returns `CommandEntry`s; the root sorts them.
- The app's root is the `root` of `cholibaShell`: `spec`, `version()`, `groups`, `order` and `verbs`. It handles an
  empty line, `help [words…]`/`--help`/`-h`, `version`/`--version`, `__complete`, `__describe` and `__entries`
  before the command table. A first word that is neither a command nor a verb is a usage error that suggests the
  closest one.
- An entry with `listed: false` is completed and described but not listed by `--help`. A command with no `help` is
  absent from both (`terminal`). Nothing outside `shell` lists commands or prints help.

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

Between packages, `scripts/__tests__/architecture.spec.ts` holds the code to two checked-in lists in
`scripts/architecture/`: the package graph (`A → B`, A imports B, from production code and matching each
package.json) and the names each entry exports. A change to either on purpose is `bun run arch:update`, and the new
lists go in the same pull request, where the diff shows it.

## Where the packages stand

`config`, `kernel`, `workspace`, `domain`, `engine`, `shell`, `tui`, `runner`, `sandbox`, `providers` and the app
`choliba` are in `STRUCTURE`, so `bun run lint` holds the codebase to this standard. The process runner lives in
`shell`'s `terminal/` folder, not in a package of its own.
