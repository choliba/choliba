import { expect, test } from 'bun:test';

import type { RoundRecord } from '../src/rounds/types';
import {
  cost,
  count,
  duration,
  energy,
  goalOf,
  megabytes,
  NOT_MEASURED,
  percent,
  providerOf,
  spread,
  sumTokens,
  title,
  tokens,
  tokensShort,
  when,
} from '../src/rounds/web/src/format';
import {
  changedFiles,
  decimal,
  ranged,
  roundTokens,
  rulesOf,
} from '../src/rounds/web/src/summary';
import { roundRecord } from './support/round-record';

/** Intl puts a no-break space in money: compared as a plain one. */
const plain = (text: string): string => text.replaceAll(' ', ' ');

test('duration: ms, s, min e s, e o não medido', () => {
  expect(duration(850)).toBe('850 ms');
  expect(duration(27_400)).toBe('27 s');
  expect(duration(88_000)).toBe('1 min 28 s');
  expect(duration(null)).toBe(NOT_MEASURED);
});

test('tokens, custo, contagens e datas, em português', () => {
  expect(tokens(117_464)).toBe('117.464');
  expect(tokens(null)).toBe(NOT_MEASURED);
  expect(tokensShort(850)).toBe('850');
  expect(tokensShort(117_464)).toBe('117 mil');
  expect(tokensShort(null)).toBe(NOT_MEASURED);
  expect(plain(cost(0.05))).toBe('US$ 0,05');
  expect(cost(null)).toBe(NOT_MEASURED);
  expect(count(1, 'rodada', 'rodadas')).toBe('1 rodada');
  expect(count(3, 'rodada', 'rodadas')).toBe('3 rodadas');
  expect(when('2026-11-16T22:03:07.490Z')).toMatch(
    /^\d{2}\/11\/2026, \d{2}:03$/,
  );
});

test('percentual, memória, energia e objetivo', () => {
  expect(percent(9)).toBe('9%');
  expect(percent(2.34)).toBe('2,3%');
  expect(percent(null)).toBe(NOT_MEASURED);
  expect(megabytes(512)).toBe('512 MB');
  expect(megabytes(5530)).toBe('5,4 GB');
  expect(megabytes(null)).toBe(NOT_MEASURED);
  expect(energy(0.02)).toBe('0,02 Wh');
  expect(energy(1200)).toBe('1,2 kWh');
  expect(energy(null)).toBe(NOT_MEASURED);
  expect(goalOf('  ')).toBe('sem objetivo declarado');
  expect(goalOf('achar o bug')).toBe('achar o bug');
});

/** The agent of a round run through `cli`. */
const actorOn = (cli: string | null) => roundRecord({ cli }).actors['po'];

test('providerOf mostra o CLI só quando o provider o tem; title capitaliza', () => {
  expect(providerOf(actorOn('codex'))).toBe('Ollama (codex) · qwen3.5:4b');
  expect(providerOf(actorOn(null))).toBe('Ollama · qwen3.5:4b');
  expect(title('analista')).toBe('Analista');
});

test('somas e médias: tokens, spread, ranged e decimal', () => {
  const none = { cacheRead: null, cacheWrite: null, reasoning: null };
  expect(sumTokens({ input: null, output: null, ...none })).toBeNull();
  expect(sumTokens({ input: 10, output: null, ...none })).toBe(10);
  expect(spread([null])).toBeUndefined();
  expect(spread([2, null, 4])).toEqual({ mean: 3, min: 2, max: 4 });
  expect(ranged([null], String)).toBe(NOT_MEASURED);
  expect(ranged([5, 5], String)).toBe('5');
  expect(ranged([2, 4], String)).toBe('3 (2 – 4)');
  expect(decimal(3.46)).toBe('3,5');
});

const started = { tag: 't', commit: 'c', fixture: 'f' };
const measure = (files: number) => ({
  turns: 1,
  tools: 0,
  questions: 0,
  changedFiles: files,
  tests: null,
  typecheck: null,
});
const passed = { rule: 'r', actor: 'po', passed: true, detail: '' };

test('o que a tabela diz de uma rodada: arquivos, tokens e regras', () => {
  const base = roundRecord({});
  const checked = roundRecord({
    extra: {
      start: started,
      measures: { po: measure(2), dev: measure(1) },
      totals: {
        ...base.totals,
        round: {
          ...base.totals.round,
          tokens: { ...base.totals.round.tokens, input: 100, output: 20 },
        },
      },
    },
  });
  expect(changedFiles(checked)).toBe(3);
  expect(changedFiles(base)).toBeNull();
  expect(roundTokens(checked)).toBe(120);
  expect(roundTokens(base)).toBeNull();
  expect(rulesOf(base)).toBe('não conferidas');
  expect(rulesOf(checked)).toBe('nenhuma declarada');
  const rules = (violations: RoundRecord['violations']) =>
    rulesOf(roundRecord({ extra: { start: started, violations } }));
  expect(rules([passed, passed])).toBe('2 cumpridas');
  expect(rules([passed, { ...passed, passed: false }])).toBe('1 violada(s)');
});
