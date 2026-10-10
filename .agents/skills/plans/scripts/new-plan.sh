#!/usr/bin/env bash
# Scaffold a plan file in plans/ (gitignored; never committed).
# Usage: new-plan.sh <claude|cursor> <NN> <slug> [monorepo-root]
#   NN is the two-digit queue number. The timestamp is America/Sao_Paulo epoch seconds.
# monorepo-root defaults to the repo that contains this skill's .agents/ folder.
set -euo pipefail

origin="${1:?origin: claude or cursor}"
nn="${2:?two-digit sequence, e.g. 14}"
slug="${3:?kebab-case slug}"
root="${4:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

[[ "$origin" == "claude" || "$origin" == "cursor" ]] || { echo "origin must be claude or cursor" >&2; exit 2; }
[[ "$nn" =~ ^[0-9]{2}$ ]] || { echo "sequence must be two digits (got '$nn')" >&2; exit 2; }
[[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be kebab-case (got '$slug')" >&2; exit 2; }
[[ -f "$root/package.json" ]] || { echo "$root does not look like the choliba monorepo (no package.json)" >&2; exit 1; }

ts="$(TZ='America/Sao_Paulo' date +%s)"
dir="$root/plans"
mkdir -p "$dir"
file="$dir/${origin}-${ts}-${nn}-${slug}.md"
[[ ! -e "$file" ]] || { echo "$file already exists" >&2; exit 1; }

cat >"$file" <<EOF
# ${nn} — Title

**PR único · commits estimados: 1 · depende de: —**

## Contexto

## Escopo (1 PR)

## Commits

1. \`type(scope): description\` — what this commit does

## Verificação

\`bun run check\` verde.
EOF

echo "$file"
