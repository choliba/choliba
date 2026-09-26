#!/usr/bin/env bash
# Add a workspace package to the choliba monorepo.
# Usage: add-package.sh <package-name> [lib|app] [monorepo-root]
# Specs are created under src/__tests__/ (the project's test layout).
#   lib -> packages/<name>  (src/index.ts, exported via package.json "exports")
#   app -> apps/<name>      (src/main.ts thin entrypoint + src/run.ts with the logic)
# monorepo-root defaults to the repo that contains this skill's .agents/ folder.
set -euo pipefail

pkg="${1:?package name (without scope)}" kind="${2:-lib}"
root="${3:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
[[ "$kind" == "lib" || "$kind" == "app" ]] || { echo "kind must be lib or app" >&2; exit 2; }
[[ "$pkg" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "package name must be kebab-case (got '$pkg')" >&2; exit 2; }
[[ -f "$root/package.json" && -f "$root/tsconfig.base.json" ]] || { echo "$root does not look like the choliba monorepo (no package.json/tsconfig.base.json)" >&2; exit 1; }

# The scope comes from an existing workspace package so it never has to be repeated.
scope=""
for manifest in "$root"/packages/*/package.json "$root"/apps/*/package.json; do
  [[ -f "$manifest" ]] || continue
  scope="$(sed -n 's/.*"name": "\(@[^/]*\)\/.*/\1/p' "$manifest" | head -n1)"
  [[ -n "$scope" ]] && break
done
[[ -n "$scope" ]] || { echo "could not infer @scope from existing packages" >&2; exit 1; }

dir="$root/$([[ "$kind" == lib ]] && echo packages || echo apps)/$pkg"
[[ ! -e "$dir" ]] || { echo "$dir already exists" >&2; exit 1; }
mkdir -p "$dir/src/__tests__"

if [[ "$kind" == lib ]]; then
  cat > "$dir/package.json" <<JSON
{
  "name": "$scope/$pkg",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json" }
}
JSON
  cat > "$dir/src/index.ts" <<TS
export const packageName = '$scope/$pkg';
TS
  cat > "$dir/src/__tests__/index.spec.ts" <<TS
import { packageName } from '../index';

describe('$pkg', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('$scope/$pkg');
  });
});
TS
else
  cat > "$dir/package.json" <<JSON
{
  "name": "$scope/$pkg",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "start": "bun run src/main.ts"
  }
}
JSON
  cat > "$dir/src/run.ts" <<TS
export function run(args: readonly string[]): string {
  return \`$pkg: \${args.join(' ')}\`;
}
TS
  cat > "$dir/src/__tests__/run.spec.ts" <<TS
import { run } from '../run';

describe('run', () => {
  it('echoes its arguments', () => {
    expect(run(['a', 'b'])).toBe('$pkg: a b');
  });
});
TS
  cat > "$dir/src/main.ts" <<TS
import { run } from './run';

console.log(run(process.argv.slice(2)));
TS
fi

cat > "$dir/tsconfig.json" <<'JSON'
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
JSON

(cd "$root" && bun install && bun run format:fix >/dev/null)
echo "Added $kind $scope/$pkg at $dir — depend on siblings with \"$scope/<name>\": \"workspace:*\" then run bun install."
