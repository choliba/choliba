# Where choliba does not follow the rules yet

Found on 2026-10-04 by reading the code on `develop`. Update this file when a gap is closed or a new one is
found; remove the line, do not mark it done.

| Rule (`SKILL.md`) | Today | Where |
|---|---|---|
| 7. `--no-input` | Not supported; the one prompt (open the HTML report in `tests`) is already TTY-only | `packages/runner/src/tests/run-tests.ts` |
| 9. Typo suggestions | An unknown command or flag is reported without a "did you mean" | `packages/choliba/src/help/root.command.ts`, the per-command parsers |

What already follows the rules, for reference: pt-BR help from `CommandSpec`, dynamic autocomplete of the whole
line (`choliba __complete`), `--dry-run` on agents and `install`, SIGINT/SIGTERM forwarding with cleanup of the run
folder (`runAgent`, `terminal run`), flags over environment over `.env` (`loadRepoConfig`), credentials only in
files, color decided once (`ThemeService`: `--no-color` global, `NO_COLOR`, `TERM=dumb`, non-TTY stdout,
`FORCE_COLOR`; colors from `CHOL_COLORS`), every command writing through the injected stdout/stderr, `choliba --version` (SemVer, with the commit as build
metadata).
