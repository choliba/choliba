# Special documents

## README

Source: the Standard Readme specification, <https://github.com/RichardLitt/standard-readme> (`spec.md`).

The README is the front door. A new reader should know within a minute what the project is, whether it is for
them, and how to get it running. Unless the project already follows another convention, structure it by the
Standard Readme specification: sections in this order, optional ones omitted when they do not apply, titles exactly
as below (translated when the README is in another language, e.g. `Instalação`, `Uso`, `Contribuindo`, `Licença`).

| Section | Status | Rules |
| --- | --- | --- |
| Title | required | Matches the repository, folder and package names (or explains the difference in the long description). |
| Banner | optional | No title; a local image right after the title. |
| Badges | optional | No title; one per line; each says something (CI, coverage, release, license). |
| Short description | required | No title; one line, at most 120 characters; the same text as the package's `description` and the repository's description. |
| Long description | optional | No title; why the project exists and how its parts fit, in a few paragraphs. |
| Table of Contents | required over 100 lines | Links to every level-2 section after it. |
| Security | optional | Here when security matters to using the project; otherwise an extra section. |
| Background | optional | Motivation, abstract dependencies, "See also". |
| Install | required (not for docs repos) | A code block; a Dependencies subsection for anything installed by hand; an Updating subsection when versions change. |
| Usage | required (not for docs repos) | A code block of common use; a CLI subsection when there is a CLI. |
| Extra sections | optional | Custom titles, between Usage and API. |
| API | optional | Exported functions and objects, or a link to generated API docs. |
| Maintainers | optional | Titled Maintainer(s); each with a contact. |
| Thanks | optional | Titled Thanks, Credits or Acknowledgements. |
| Contributing | required | Where to ask questions, whether PRs are accepted, what they must meet; link CONTRIBUTING and the code of conduct when they exist. |
| License | required, last | SPDX name (or `UNLICENSED`) and owner; link the license file. |

The whole file: valid Markdown, no broken links (anchors, local files and URLs), code examples in the project's own
style. When a change adds a section, put it in its place in this order and add it to the table of contents.

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
