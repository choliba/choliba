#!/usr/bin/env bash
# Scaffold a plan file in plans/ (gitignored; never committed).
# Usage: new-plan.sh <claude|cursor|codex> <NN> <slug> [monorepo-root]
#   The first argument is the plan's author (who writes the draft), not who executes it.
#   NN is the two-digit queue number. The timestamp is America/Sao_Paulo epoch seconds.
#   When plans/00-indice.md exists, the plan is appended to its "Fila ativa" table as rascunho.
# monorepo-root defaults to the repo that contains this skill's .agents/ folder.
set -euo pipefail

autor="${1:?author: claude, cursor or codex}"
nn="${2:?two-digit sequence, e.g. 14}"
slug="${3:?kebab-case slug}"
root="${4:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

[[ "$autor" =~ ^(claude|cursor|codex)$ ]] || { echo "author must be claude, cursor or codex (got '$autor')" >&2; exit 2; }
[[ "$nn" =~ ^[0-9]{2}$ ]] || { echo "sequence must be two digits (got '$nn')" >&2; exit 2; }
[[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be kebab-case (got '$slug')" >&2; exit 2; }
[[ -f "$root/package.json" ]] || { echo "$root does not look like the choliba monorepo (no package.json)" >&2; exit 1; }

ts="$(TZ='America/Sao_Paulo' date +%s)"
dir="$root/plans"
mkdir -p "$dir"
file="$dir/${autor}-${ts}-${nn}-${slug}.md"
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

# Appends the row after the last table row of "## Fila ativa". The index is rewritten in place (not replaced) so a
# flock held on it by another agent keeps guarding the same file.
add_to_index() {
  local index="$1" row="| ${nn} | ${autor} | ${slug} | rascunho | — | — |" updated
  updated="$(awk -v row="$row" '
    NR == FNR {
      if ($0 ~ /^## /) in_queue = ($0 ~ /^## Fila ativa/)
      else if (in_queue && $0 ~ /^\|/) last = FNR
      next
    }
    { print }
    FNR == last { print row }
    END { if (!last) exit 1 }
  ' "$index" "$index")" || { echo "$index has no \"## Fila ativa\" table; add the plan to it by hand" >&2; return 0; }
  printf '%s\n' "$updated" >"$index"
  echo "$index"
}

index="$dir/00-indice.md"
if [[ -f "$index" ]]; then
  if command -v flock >/dev/null; then
    { flock 9; add_to_index "$index"; } 9<"$index"
  else
    add_to_index "$index"
  fi
fi
