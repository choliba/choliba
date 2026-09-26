# Special documents

## README

The README is the front door. A new reader should know within a minute what the project is, whether it is for
them, and how to get it running.

Suggested order (keep only what applies):

1. **Name and one-sentence purpose** — what it does and for whom.
2. **Requirements** — runtime and tool versions.
3. **Quick start** — the shortest path from clone to a working result, with real commands.
4. **Common commands** — a short table of the everyday ones; link to the full reference.
5. **Structure** — where the main parts live (for monorepos: one line per package/app, each with its own README
   when it has users of its own).
6. **Where to go next** — links to the docs, contributing guide, changelog, license.

Avoid: long feature essays, duplicated reference material, badges that say nothing, instructions that only work
on the author's machine.

## Architecture decision record (ADR)

Source: Michael Nygard, "Documenting Architecture Decisions" (2011); <https://adr.github.io/>.

Write one when a decision is architecturally significant: it affects structure, non-functional characteristics,
dependencies, interfaces or construction techniques, and would be costly to reverse.

Template (Nygard):

```markdown
# <N>. <Short title of the decision>

Date: <YYYY-MM-DD>

## Status

Proposed | Accepted | Superseded by [ADR <M>](<file>) | Deprecated

## Context

The forces at play: the problem, constraints, requirements and options considered, stated neutrally.

## Decision

What we decided, in active voice: "We will ...".

## Consequences

What becomes easier and harder as a result — the good, the bad and the trade-offs accepted.
```

Rules:

- Number sequentially and keep them together (e.g. `docs/adr/0001-<slug>.md`).
- One decision per record; short enough to read in a few minutes.
- Once accepted, do not rewrite it. When the decision changes, write a new ADR that supersedes it and update only
  the old one's status line with a link. The chain is the history.

## Changelog

Source: Keep a Changelog, <https://keepachangelog.com/en/1.0.0/>.

- Written for humans, not generated from raw commit messages.
- Newest version first; each version with its release date; an `Unreleased` section at the top.
- Changes grouped by type: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.
- Each entry says what changed for the user, not how it was implemented.
- Say whether the project follows Semantic Versioning; mark breaking changes clearly.

```markdown
## [Unreleased]

### Changed

- `--plan` was removed; use `--mode-plan` instead.

## [1.2.0] - 2026-09-24

### Added

- `--since-pending` shortcut for `--since pending`.
```

## Docs that agents read

Coding agents and tools increasingly read project docs directly (`AGENTS.md`, `CLAUDE.md`-style files, `llms.txt`,
Markdown served to tools). Write them for a reader that follows instructions literally and has no memory of past
sessions.

- **Short and specific.** Start small (a few dozen lines) and add a rule only when an agent keeps getting that
  thing wrong; remove rules that stop being true. Long, generic instruction files measurably hurt agents.
- **Exact and executable:** real commands, paths and file names, not descriptions of them.
- **Structured Markdown:** clear headings, lists and tables; one topic per section, so the right part is easy to
  find and quote.
- **State the non-obvious:** project rules that differ from common defaults, and why.
- **Point, don't copy:** link to the detailed docs or skills instead of duplicating them, so there is one source.
- **`llms.txt`** (for published docs): a curated map of the most useful pages, each with a one-line description
  written for context, regenerated when the docs change.
