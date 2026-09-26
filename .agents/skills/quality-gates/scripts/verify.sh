#!/usr/bin/env bash
# Prove every quality gate works — including that the gates actually FAIL on
# bad input. A passing `check` alone does not show that the guards are armed.
# Usage: verify.sh [monorepo-root]   (default: the repo that contains this skill's .agents/ folder)
set -uo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
cd "$root" || exit 1
command -v bun >/dev/null || { echo "bun not on PATH" >&2; exit 1; }

fail=0
pass() { echo "  PASS  $1"; }
miss() { echo "  FAIL  $1"; fail=1; }

# First workspace package that has a src/ dir — probes are dropped in there.
probe_dir="$(ls -d packages/*/src apps/*/src 2>/dev/null | head -n1)"
[[ -n "$probe_dir" ]] || { echo "no package with src/ found" >&2; exit 1; }
cleanup() { rm -f "$probe_dir/__probe_any.ts" "$probe_dir/__probe_untested.ts"; }
trap cleanup EXIT

echo "== 1. Toolchain versions"
ts_version="$(bunx tsc --version | awk '{print $2}')"
[[ "$ts_version" == 6.0.* ]] && pass "TypeScript $ts_version" || miss "TypeScript is $ts_version, expected 6.0.x"
ls package-lock.json yarn.lock pnpm-lock.yaml >/dev/null 2>&1 && miss "non-Bun lockfile present" || pass "only Bun lockfile"
[[ -f bun.lock || -f bun.lockb ]] && pass "bun lockfile present" || miss "no bun lockfile"

echo "== 1b. Every workspace package is inside the gates"
# A package without a typecheck script or a tsconfig that extends the base is skipped by
# `bun run typecheck` and never reported, so it has to be checked explicitly.
for manifest in packages/*/package.json apps/*/package.json; do
  [[ -f "$manifest" ]] || continue
  dir="$(dirname "$manifest")"
  grep -q '"typecheck"' "$manifest" && pass "$dir has a typecheck script" || miss "$dir has no typecheck script (typecheck silently skips it)"
  grep -q 'tsconfig.base.json' "$dir/tsconfig.json" 2>/dev/null && pass "$dir/tsconfig.json extends tsconfig.base.json" || miss "$dir/tsconfig.json missing or does not extend tsconfig.base.json"
  ls "$dir"/src/__tests__/*.spec.ts >/dev/null 2>&1 && pass "$dir has at least one spec in src/__tests__/" || miss "$dir has no *.spec.ts in src/__tests__/"
  # Jest only discovers src/__tests__/**/*.spec.ts, so a spec anywhere else silently never runs.
  stray="$(find "$dir/src" -name '*.spec.ts' -not -path '*/__tests__/*' 2>/dev/null)"
  [[ -z "$stray" ]] && pass "$dir has no spec outside src/__tests__/" || miss "spec(s) outside src/__tests__/ never run: $stray"
done
cp bun.lock /tmp/verify-bun.lock.before 2>/dev/null
bun install --frozen-lockfile >/tmp/verify-install.log 2>&1 && pass "bun.lock is up to date (bun install --frozen-lockfile)" || { miss "bun.lock is stale — run bun install and commit it"; tail -5 /tmp/verify-install.log; }
[[ -f .editorconfig ]] && grep -q '^root = true' .editorconfig && pass ".editorconfig present with root = true" || miss ".editorconfig missing or without root = true"

echo "== 2. Full gate from the current install (bun run check)"
if bun run check >/tmp/verify-check.log 2>&1; then pass "bun run check"; else miss "bun run check (see /tmp/verify-check.log)"; tail -30 /tmp/verify-check.log; fi

echo "== 3. Guards must reject bad code"
cat > "$probe_dir/__probe_any.ts" <<'TS'
export function probe(input: string, maybe: string | undefined): number {
  const explicit: any = input;
  const leaked = JSON.parse(input);
  // @ts-ignore
  const n: number = 'x';
  return explicit.length + leaked.foo + n + maybe!.length;
}
TS
if bun run lint >/tmp/verify-lint.log 2>&1; then miss "lint accepted any / @ts-ignore / non-null assertion"; else
  for rule in no-explicit-any no-unsafe-assignment ban-ts-comment no-non-null-assertion; do
    grep -q "$rule" /tmp/verify-lint.log && pass "lint rejects $rule" || miss "lint did not report $rule"
  done
fi
rm -f "$probe_dir/__probe_any.ts"

echo 'export function probe(x) { return x; }' > "$probe_dir/__probe_any.ts"
bun run typecheck >/tmp/verify-tsc.log 2>&1 && miss "tsc accepted an implicit any parameter" || pass "tsc rejects implicit any"
rm -f "$probe_dir/__probe_any.ts"

cat > "$probe_dir/__probe_untested.ts" <<'TS'
export function untested(n: number): string {
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'zero';
}
TS
cp COVERAGE.md /tmp/verify-COVERAGE.md
if bun run test:cov >/tmp/verify-cov.log 2>&1; then miss "coverage regression was accepted"; else pass "Jest fails on coverage regression"; fi
rm -f "$probe_dir/__probe_untested.ts"
cmp -s COVERAGE.md /tmp/verify-COVERAGE.md && pass "failed run left COVERAGE.md untouched" || miss "failed run overwrote COVERAGE.md"

echo "== 4. Clean tree after probes"
bun run check >/tmp/verify-final.log 2>&1 && pass "bun run check green again" || { miss "check not green after probes"; tail -20 /tmp/verify-final.log; }

[[ $fail -eq 0 ]] && echo "ALL GATES VERIFIED" || echo "VERIFICATION FAILED"
exit $fail
