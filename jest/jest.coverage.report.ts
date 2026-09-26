// Converte o coverage-summary.json do Jest num COVERAGE.md legível — um resumo por
// pacote no topo e, abaixo, os arquivos de cada pacote num bloco recolhível
// (<details>, que GitHub e GitLab renderizam) — e num badge "endpoint" do shields.io.

export interface Metric {
  pct: number;
  /** Itens cobertos e total de itens da métrica; somados, dão a cobertura de um pacote. */
  covered?: number;
  total?: number;
}

export interface FileCoverage {
  lines: Metric;
  statements: Metric;
  functions: Metric;
  branches: Metric;
}

export type CoverageSummary = Record<string, FileCoverage> & { total: FileCoverage };

function getStatus(pct: number): string {
  if (pct < 50) return '🔴';
  if (pct < 80) return '🟡';
  return '🟢';
}

function getBadgeColor(pct: number): string {
  if (pct < 50) return 'red';
  if (pct < 80) return 'yellow';
  return 'brightgreen';
}

function relativePath(absolutePath: string, rootDir: string): string {
  return absolutePath.startsWith(`${rootDir}/`) ? absolutePath.slice(rootDir.length + 1) : absolutePath;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day} ${time}`;
}

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

const TABLE_HEADER = (label: string): string[] => [
  `Status|${label}|% Stmts|% Branch|% Funcs|% Lines`,
  '--|--|--|--|--|--',
];

function formatRow(label: string, cov: FileCoverage, link?: string): string {
  const name = link === undefined ? `**${label}**` : `[${label}](${link})`;
  const cells = METRICS.map((metric) => cov[metric].pct.toFixed(2));
  return [getStatus(cov.statements.pct), name, ...cells].join('|');
}

/** The package a file belongs to: `packages/<name>` or `apps/<name>`, else its top folder (or `.` at the root). */
function packageOf(file: string): string {
  const parts = file.split('/');
  if ((parts[0] === 'packages' || parts[0] === 'apps') && parts.length > 2) return parts.slice(0, 2).join('/');
  return parts.length > 1 ? (parts[0] ?? '.') : '.';
}

/** One metric over several files: covered/total summed (100% with nothing to cover), or the mean of `pct` without counts. */
function sumMetric(metrics: readonly Metric[]): Metric {
  const withCounts = metrics.every((metric) => metric.covered !== undefined && metric.total !== undefined);
  if (!withCounts) {
    return { pct: metrics.reduce((sum, metric) => sum + metric.pct, 0) / metrics.length };
  }
  const covered = metrics.reduce((sum, metric) => sum + (metric.covered ?? 0), 0);
  const total = metrics.reduce((sum, metric) => sum + (metric.total ?? 0), 0);
  return { pct: total === 0 ? 100 : (covered / total) * 100, covered, total };
}

function sumCoverage(files: readonly FileCoverage[]): FileCoverage {
  return {
    statements: sumMetric(files.map((file) => file.statements)),
    branches: sumMetric(files.map((file) => file.branches)),
    functions: sumMetric(files.map((file) => file.functions)),
    lines: sumMetric(files.map((file) => file.lines)),
  };
}

function isComplete(cov: FileCoverage): boolean {
  return METRICS.every((metric) => cov[metric].pct >= 100);
}

/**
 * The files of one package in a collapsible block. It opens by itself when something in it is
 * below 100%, so what needs attention is visible without a click. The blank lines around the
 * table are required: without them neither GitHub nor GitLab render Markdown inside <details>.
 */
function packageSection(
  name: string,
  files: readonly (readonly [string, FileCoverage])[],
  cov: FileCoverage,
): string[] {
  const count = files.length === 1 ? '1 arquivo' : `${String(files.length)} arquivos`;
  const summary = `${getStatus(cov.statements.pct)} <b>${name}</b> — ${cov.lines.pct.toFixed(2)}% das linhas, ${count}`;
  return [
    files.every(([, file]) => isComplete(file)) ? '<details>' : '<details open>',
    `<summary>${summary}</summary>`,
    '',
    ...TABLE_HEADER('Arquivo'),
    ...files.map(([file, fileCov]) => formatRow(file.slice(name === '.' ? 0 : name.length + 1), fileCov, file)),
    '',
    '</details>',
    '',
  ];
}

export function buildCoverageMarkdown(
  summary: CoverageSummary,
  rootDir: string,
  generatedAt: Date = new Date(),
): string {
  const { total, ...rest } = summary;
  const files = Object.entries(rest)
    .map(([absolutePath, cov]) => [relativePath(absolutePath, rootDir), cov] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const packages = new Map<string, (readonly [string, FileCoverage])[]>();
  for (const entry of files) {
    const name = packageOf(entry[0]);
    packages.set(name, [...(packages.get(name) ?? []), entry]);
  }
  const perPackage = [...packages].map(([name, list]) => ({
    name,
    list,
    cov: sumCoverage(list.map(([, cov]) => cov)),
  }));

  return (
    [
      '# Cobertura de testes',
      '',
      `Gerado automaticamente por \`bun run test:cov\` em ${formatTimestamp(generatedAt)} — não editar manualmente.`,
      '',
      '## Resumo',
      '',
      ...TABLE_HEADER('Pacote'),
      formatRow('Total', total),
      ...perPackage.map(({ name, cov }) => formatRow(name, cov, name)),
      '',
      '## Por pacote',
      '',
      ...perPackage.flatMap(({ name, list, cov }) => packageSection(name, list, cov)),
    ]
      .join('\n')
      .trimEnd() + '\n'
  );
}

export interface ShieldsEndpointBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

/** JSON no schema "endpoint badge" do shields.io (https://shields.io/endpoint) — média das 4 métricas. */
export function buildCoverageBadge(total: FileCoverage): ShieldsEndpointBadge {
  const pcts = [total.statements.pct, total.branches.pct, total.functions.pct, total.lines.pct];
  const average = pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length;

  return {
    schemaVersion: 1,
    label: 'coverage',
    message: `${average.toFixed(2)}%`,
    color: getBadgeColor(average),
  };
}
