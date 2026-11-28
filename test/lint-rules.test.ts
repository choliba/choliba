import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { UsageError } from '../src/errors';
import {
  type LintOverride,
  OWNERS,
  readLintConfig,
  withOwnerRules,
} from '../scripts/lint-rules';

const config = readLintConfig(
  readFileSync(join(import.meta.dir, '..', '.oxlintrc.json'), 'utf8'),
  '.oxlintrc.json',
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a rule (`['error', ...entries]`) lists after its level. */
function ruleEntries(rules: LintOverride['rules'], name: string): unknown[] {
  const rule: unknown = rules === undefined ? undefined : rules[name];
  const entries: unknown[] = Array.isArray(rule) ? rule.slice(1) : [];
  return entries;
}

/** The import names a `no-restricted-imports` rule restricts. */
const restrictedImports = (rules: LintOverride['rules']): string[] =>
  ruleEntries(rules, 'eslint/no-restricted-imports').flatMap((options) => {
    if (!isRecord(options) || !Array.isArray(options['paths'])) return [];
    return options['paths'].flatMap((entry: unknown) =>
      isRecord(entry) && typeof entry['name'] === 'string'
        ? [entry['name']]
        : [],
    );
  });

/** The `Bun.x` and `globalThis.x` a `no-restricted-properties` rule restricts. */
const restrictedProperties = (rules: LintOverride['rules']): string[] =>
  ruleEntries(rules, 'eslint/no-restricted-properties').flatMap((entry) =>
    isRecord(entry) &&
    typeof entry['object'] === 'string' &&
    typeof entry['property'] === 'string'
      ? [`${entry['object']}.${entry['property']}`]
      : [],
  );

const ownerOverride = (glob: string): LintOverride['rules'] =>
  withOwnerRules(config).overrides?.find(
    ({ files }) => files.length === 1 && files[0] === glob,
  )?.rules;

test('as regras dos donos no .oxlintrc.json são as da tabela; se falhar, rode bun run lint:owners', () => {
  expect(config).toEqual(withOwnerRules(config));
});

test('a base barra os imports e as propriedades de todos os donos', () => {
  const { rules } = withOwnerRules(config);

  expect(restrictedImports(rules)).toEqual(
    expect.arrayContaining([
      'node:fs',
      'node:path',
      'node:child_process',
      'node:readline',
      'node:process',
      '@modelcontextprotocol/server',
      'bun:sqlite',
      'bun',
    ]),
  );
  expect(restrictedProperties(rules)).toEqual(
    expect.arrayContaining(['globalThis.process', 'Bun.file', 'Bun.spawn']),
  );
});

test('cada dono libera o que é seu, e o process.ts também o do execute', () => {
  const filesystem = ownerOverride('src/filesystem/**/*.ts');
  expect(restrictedImports(filesystem)).not.toContain('node:fs');
  expect(restrictedImports(filesystem)).toContain('node:child_process');
  expect(restrictedProperties(filesystem)).not.toContain('Bun.file');

  const processFile = ownerOverride('src/execute/process.ts');
  expect(restrictedImports(processFile)).not.toContain('node:process');
  expect(restrictedImports(processFile)).not.toContain('node:child_process');
  expect(restrictedImports(processFile)).toContain('node:fs');

  const stdio = ownerOverride('src/output/stdio.ts');
  expect(restrictedProperties(stdio)).not.toContain('Bun.stdout');
  expect(restrictedProperties(stdio)).toContain('Bun.stdin');
});

test('num config sem os overrides dos donos, eles entram depois do primeiro override', () => {
  const tests: LintOverride = { files: ['test/**/*.ts'], rules: {} };
  const other: LintOverride = { files: ['src/outro.ts'], rules: {} };

  const written = withOwnerRules({ rules: {}, overrides: [tests, other] });
  expect(written.overrides?.map(({ files }) => files[0])).toEqual([
    'test/**/*.ts',
    ...OWNERS,
    'src/outro.ts',
  ]);

  const bare = withOwnerRules({ rules: {} });
  expect(bare.overrides?.map(({ files }) => files[0])).toEqual([...OWNERS]);
});

test('readLintConfig recusa o que não é um .oxlintrc.json, dizendo de onde veio', () => {
  expect(() => readLintConfig('{}', 'x.json')).toThrow(UsageError);
  expect(() =>
    readLintConfig('{"rules": {}, "overrides": [{"rules": {}}]}', 'x.json'),
  ).toThrow('x.json não tem a forma de um .oxlintrc.json');
});
