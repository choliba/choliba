# Where choliba does not follow the rules yet

Found on 2026-10-12 by reading `references/clig-checklist.md` item by item against the code on `develop`. Update this
file when a gap is closed or a new one is found; remove the line, do not mark it done. A departure made on purpose is
not a gap: it is in `SKILL.md`, "Where choliba departs from clig.dev".

| Rule | Today | Where |
|---|---|---|
| 7. `--no-input` | Only `new project` takes it; the one other prompt (open the HTML report in `run tests`) is already TTY-only | `packages/runner/src/tests/run-tests.ts` |
| Output: `--json`, `--quiet` | No command has them; `list projects --tickets` is a line format the `product-owner` reads | `packages/projects/src/projects/projects-list.command.ts` |
| Output: pager | Long help and `list agents` are not paged on a TTY | `ShellIo.printHelp`, `runList` |

What already follows the rules, for reference: pt-BR help from `CommandSpec`, `help [COMMAND...]`, dynamic
autocomplete of the whole line (`choliba __complete`), `--dry-run` on agents and `add`, SIGINT/SIGTERM forwarding with
cleanup of the run folder (`runAgent`, `terminal run`), flags over environment over `.env` (`loadRepoConfig`),
credentials only in files or the environment, color decided once (`ThemeService`: `--no-color` global, `NO_COLOR`,
`TERM=dumb`, non-TTY stdout, `FORCE_COLOR`; colors from `CHOL_COLORS`), every command writing through the injected
stdout/stderr, `choliba --version` (SemVer, with the commit as build metadata), no catch-all at the root, and a
suggestion for an unknown command, verb type or agent.
