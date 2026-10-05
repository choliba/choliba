#!/usr/bin/env bash
# Add a workspace package to the choliba monorepo.
# Usage: add-package.sh <package-name> [lib|app] [monorepo-root]
# Specs are created under src/__tests__/ (the project's test layout).
#   lib -> packages/<name>  (src/index.ts plain, src/nest.ts with a Nest module and service; nestjs skill)
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
  # A Nest library: plain functions at the root (importable anywhere, the Playwright runner included) and the
  # module and service under ./nest (see the nestjs skill).
  class="$(echo "$pkg" | awk -F- '{ for (i = 1; i <= NF; i++) printf toupper(substr($i, 1, 1)) substr($i, 2) }')"
  mkdir -p "$dir/src/$pkg" "$dir/src/__tests__/$pkg"
  cat > "$dir/package.json" <<JSON
{
  "name": "$scope/$pkg",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./nest": "./src/nest.ts" },
  "scripts": { "typecheck": "tsc --noEmit -p tsconfig.json" },
  "dependencies": {
    "@nestjs/common": "~11.2",
    "@nestjs/core": "~11.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": { "@nestjs/testing": "~11.2" }
}
JSON
  cat > "$dir/src/$pkg/$pkg.ts" <<TS
/** The logic of $scope/$pkg, as plain functions: the service only calls them. */
export function greeting(name: string): string {
  return \`$pkg: \${name}\`;
}
TS
  cat > "$dir/src/$pkg/$pkg.service.ts" <<TS
import { Injectable } from '@nestjs/common';

import { greeting } from './$pkg';

@Injectable()
export class ${class}Service {
  greet(name: string): string {
    return greeting(name);
  }
}
TS
  cat > "$dir/src/$pkg/$pkg.module.ts" <<TS
import { Module } from '@nestjs/common';

import { ${class}Service } from './$pkg.service';

@Module({
  providers: [${class}Service],
  exports: [${class}Service],
})
export class ${class}Module {}
TS
  cat > "$dir/src/index.ts" <<TS
export { greeting } from './$pkg/$pkg';
TS
  cat > "$dir/src/nest.ts" <<TS
export { ${class}Module } from './$pkg/$pkg.module';
export { ${class}Service } from './$pkg/$pkg.service';
TS
  cat > "$dir/src/__tests__/$pkg/$pkg.service.spec.ts" <<TS
import { Test } from '@nestjs/testing';

import { greeting } from '../../index';
import { ${class}Module, ${class}Service } from '../../nest';

describe('${class}Service', () => {
  it('greets through the module', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [${class}Module] }).compile();

    expect(moduleRef.get(${class}Service).greet('ana')).toBe(greeting('ana'));
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
