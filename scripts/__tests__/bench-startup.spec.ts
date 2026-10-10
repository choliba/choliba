import {
  measuredOn,
  REFERENCE_BEGIN,
  REFERENCE_END,
  summarize,
  timingTable,
  withReference,
} from '../libs/bench-startup';

describe('summarize', () => {
  it('reports min, median, mean and max of unordered samples', () => {
    expect(summarize([30, 10, 20])).toEqual({ min: 10, median: 20, mean: 20, max: 30 });
  });

  it('takes the median of an even count as the mean of the two middle samples', () => {
    expect(summarize([40, 10, 30, 20]).median).toBe(25);
  });

  it('refuses a scenario with no samples', () => {
    expect(() => summarize([])).toThrow('nenhuma amostra para resumir');
  });
});

describe('timingTable', () => {
  it('writes one Markdown row per scenario, in whole milliseconds', () => {
    const table = timingTable([
      { scenario: 'Bun vazio', timing: { min: 4.4, median: 5.5, mean: 5.6, max: 9.49 } },
      { scenario: 'fonte: --version', timing: { min: 200, median: 210.2, mean: 212.7, max: 250 } },
    ]);

    expect(table).toBe(
      [
        '| Cenário | mín (ms) | mediana (ms) | média (ms) | máx (ms) |',
        '| --- | --: | --: | --: | --: |',
        '| Bun vazio | 4 | 6 | 6 | 9 |',
        '| fonte: --version | 200 | 210 | 213 | 250 |',
      ].join('\n'),
    );
  });
});

describe('measuredOn', () => {
  it('says the day, the Bun, the system and the runs of the measurement', () => {
    expect(measuredOn(new Date(2026, 9, 10), '1.4.2', 'linux', 20)).toBe(
      'Medido em 10/10/2026, com Bun 1.4.2 e Linux, 20 execuções por cenário:',
    );
  });

  it('names a system it does not know as Node does', () => {
    expect(measuredOn(new Date(2026, 0, 2), '1.4.2', 'freebsd', 1)).toContain('e freebsd, 1 execuções');
  });
});

describe('withReference', () => {
  const document = ['# Desempenho', '', REFERENCE_BEGIN, '', 'antiga', '', REFERENCE_END, '', '## Leitura', ''].join(
    '\n',
  );

  it('replaces only what is between the markers, keeping them and the text around', () => {
    expect(withReference(document, 'nova')).toBe(
      ['# Desempenho', '', REFERENCE_BEGIN, '', 'nova', '', REFERENCE_END, '', '## Leitura', ''].join('\n'),
    );
  });

  it('refuses a document without both markers in order', () => {
    expect(() => withReference('# Desempenho', 'nova')).toThrow('faltam os marcadores');
    expect(() => withReference(`${REFERENCE_END}\n${REFERENCE_BEGIN}`, 'nova')).toThrow('faltam os marcadores');
  });
});
