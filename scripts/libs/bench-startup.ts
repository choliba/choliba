/** Wall-clock summary of one scenario's runs, in milliseconds. */
export interface Timing {
  readonly min: number;
  readonly median: number;
  readonly mean: number;
  readonly max: number;
}

/** One measured scenario, as a row of the report. */
export interface ScenarioResult {
  readonly scenario: string;
  readonly timing: Timing;
}

function nth(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) throw new Error(`sem amostra na posição ${String(index)}`);
  return value;
}

/** Min, median, mean and max of the samples. A scenario with no samples never ran, so it has no timing. */
export function summarize(samples: readonly number[]): Timing {
  if (samples.length === 0) throw new Error('nenhuma amostra para resumir');
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (nth(sorted, middle - 1) + nth(sorted, middle)) / 2 : nth(sorted, middle);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return { min: nth(sorted, 0), median, mean, max: nth(sorted, sorted.length - 1) };
}

/** A Markdown table with one row per scenario, times rounded to whole milliseconds. */
export function timingTable(results: readonly ScenarioResult[]): string {
  const ms = (value: number): string => String(Math.round(value));
  const rows = results.map(
    ({ scenario, timing }) =>
      `| ${scenario} | ${ms(timing.min)} | ${ms(timing.median)} | ${ms(timing.mean)} | ${ms(timing.max)} |`,
  );
  return [
    '| Cenário | mín (ms) | mediana (ms) | média (ms) | máx (ms) |',
    '| --- | --: | --: | --: | --: |',
    ...rows,
  ].join('\n');
}
