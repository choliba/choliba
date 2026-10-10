#!/usr/bin/env bash
# Add a workspace package to the choliba monorepo.
# Usage: add-package.sh <package-name> [lib|app] [monorepo-root]
# Specs are created under src/__tests__/ (the project's test layout).
#   lib -> packages/<name>  (src/index.ts: a function, a service and a ShellModule; cli-shell skill)
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
  # A library on the shell: plain functions, a service and one ShellModule, all through `.` (see the cli-shell skill).
  class="$(echo "$pkg" | awk -F- '{ for (i = 1; i <= NF; i++) printf toupper(substr($i, 1, 1)) substr($i, 2) }')"
  token="$(echo "$pkg" | tr '[:lower:]-' '[:upper:]_')"
  shell="$(echo "$pkg" | awk -F- '{ printf $1; for (i = 2; i <= NF; i++) printf toupper(substr($i, 1, 1)) substr($i, 2) }')Shell"
  mkdir -p "$dir/src/$pkg" "$dir/src/__tests__/$pkg"
  cat > "$dir/package.json" <<JSON
{
  "name": "$scope/$pkg",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json" },
  "dependencies": { "@choliba/core": "workspace:*" }
}
JSON
  cat > "$dir/src/$pkg/$pkg.ts" <<TS
/** The logic of $scope/$pkg, as plain functions: the service only calls them. */
export function greeting(name: string): string {
  return \`$pkg: \${name}\`;
}
TS
  cat > "$dir/src/$pkg/$pkg.service.ts" <<TS
import { greeting } from './$pkg';

export class ${class}Service {
  greet(name: string): string {
    return greeting(name);
  }
}
TS
  cat > "$dir/src/$pkg/$pkg.constants.ts" <<TS
import { token } from '@choliba/core';

import type { ${class}Service } from './$pkg.service';

export const ${token} = token<${class}Service>('${class}Service');
TS
  cat > "$dir/src/$pkg/$pkg-shell.ts" <<TS
import type { ShellModule } from '@choliba/core';

import { ${token} } from './$pkg.constants';
import { ${class}Service } from './$pkg.service';

/** $scope/$pkg in the shell. A command of this package is added to \`commands\`. */
export const ${shell}: ShellModule = {
  name: '$scope/$pkg',
  provide: (container) => {
    container.provide(${token}, () => new ${class}Service());
  },
  commands: [],
};
TS
  cat > "$dir/src/$pkg/index.ts" <<TS
export { greeting } from './$pkg';
export { ${token} } from './$pkg.constants';
export { ${class}Service } from './$pkg.service';
export { ${shell} } from './$pkg-shell';
TS
  cat > "$dir/src/index.ts" <<TS
export { greeting, ${class}Service, ${shell} } from './$pkg';
TS
  cat > "$dir/src/__tests__/$pkg/$pkg.service.spec.ts" <<TS
import { greeting, ${class}Service } from '../..';

describe('${class}Service', () => {
  it('greets', () => {
    expect(new ${class}Service().greet('ana')).toBe(greeting('ana'));
    expect(greeting('ana')).toBe('$pkg: ana');
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
