// globalTeardown do Jest (só roda com --coverage, ver jest.coverage.config.json). Depois
// de cada execução:
//   1. Compara a cobertura real (coverage/coverage-summary.json) com o
//      threshold salvo em jest/jest.coverage.config.json.
//   2. Sobe o threshold para o maior dos dois, métrica a métrica — nunca desce
//      sozinho (o "ratchet"; a regressão já foi barrada pelo próprio Jest via
//      coverageThreshold antes de chegar aqui).
//   3. Atualiza COVERAGE.md e o badge — só quando nenhuma métrica ficou abaixo
//      do threshold e só se a cobertura de fato mudou (o horário da geração
//      não conta), para rodar os testes não sujar a árvore de trabalho.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config } from 'jest';
import { format, resolveConfig } from 'prettier';
import { buildCoverageBadge, buildCoverageMarkdown, type CoverageSummary } from './jest.coverage.report';

interface Totals {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

const METRICS = ['lines', 'statements', 'functions', 'branches'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
}

function readTotals(source: unknown, pick: (metric: unknown) => unknown): Totals {
  if (!isRecord(source)) throw new Error('coverage totals must be an object');
  const totals = {} as Totals;
  for (const metric of METRICS) {
    const value = pick(source[metric]);
    if (typeof value !== 'number') throw new Error(`coverage metric "${metric}" must be a number`);
    totals[metric] = value;
  }
  return totals;
}

// Linha volátil do COVERAGE.md: muda a cada execução mesmo sem mudança de cobertura.
const GENERATED_AT_LINE = /^Gerado automaticamente por .*$/m;

/** Grava o arquivo só se o conteúdo mudou (desconsiderando `ignore`, quando informado). */
function writeIfChanged(filePath: string, content: string, ignore?: RegExp): void {
  if (fs.existsSync(filePath)) {
    const normalize = (text: string): string => (ignore ? text.replace(ignore, '') : text);
    if (normalize(fs.readFileSync(filePath, 'utf-8')) === normalize(content)) return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function ratchetUp(current: Totals, actual: Totals): Totals {
  const result = {} as Totals;
  for (const metric of METRICS) {
    result[metric] = Math.max(current[metric], actual[metric]);
  }
  return result;
}

export default async function globalTeardown(globalConfig: Config): Promise<void> {
  const rootDir = globalConfig.rootDir ?? process.cwd();
  const summaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');
  const configPath = path.join(rootDir, 'jest', 'jest.coverage.config.json');

  // Suíte rodou sem produzir cobertura (ex.: 0 testes) — nada a ratchear.
  if (!fs.existsSync(summaryPath)) return;

  const summary = readJson(summaryPath) as CoverageSummary;
  const actual = readTotals(summary.total, (metric) => (isRecord(metric) ? metric['pct'] : undefined));

  const config = readJson(configPath);
  const coverageConfig = isRecord(config) ? config['coverageConfig'] : undefined;
  const thresholds = isRecord(coverageConfig) ? coverageConfig['coverageThreshold'] : undefined;
  if (!isRecord(thresholds) || !isRecord(thresholds['global'])) {
    throw new Error('jest.coverage.config.json must contain coverageConfig.coverageThreshold.global');
  }
  const current = readTotals(thresholds['global'], (metric) => metric);

  // Execução que ficou abaixo do threshold já falhou no Jest: não sobrescreve
  // COVERAGE.md/badge com números piores (eles refletem sempre o último estado bom).
  if (METRICS.some((metric) => actual[metric] < current[metric])) return;

  thresholds['global'] = ratchetUp(current, actual);
  // Passa pelo Prettier (com as regras do .editorconfig): o JSON regravado tem que
  // sair idêntico ao formato que `bun run format` exige, senão o próximo check falha.
  const prettierOptions = (await resolveConfig(configPath, { editorconfig: true })) ?? {};
  writeIfChanged(
    configPath,
    await format(JSON.stringify(config, null, 2), { ...prettierOptions, filepath: configPath }),
  );

  writeIfChanged(path.join(rootDir, 'COVERAGE.md'), buildCoverageMarkdown(summary, rootDir), GENERATED_AT_LINE);

  writeIfChanged(
    path.join(rootDir, '.github', 'badges', 'coverage.json'),
    JSON.stringify(buildCoverageBadge(summary.total), null, 2) + '\n',
  );
}
