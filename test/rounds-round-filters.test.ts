import { expect, test } from 'bun:test';

import type { RoundRecord } from '../src/rounds/types';
import { roundRecord } from './support/round-record';
import {
  applyFilters,
  NO_FILTERS,
  withChoice,
  withNumber,
} from '../src/rounds/web/src/filters';
import {
  ROUND_FIELDS,
  roundSpec,
  visibleFields,
  withoutField,
  type FilterableRound,
} from '../src/rounds/web/src/round-filters';

/** A round of `testId`, with one agent on `model` through `cli`, lasting `ms`. */
const record = (
  id: string,
  testId: string,
  model: string,
  cli: string | null,
  ms: number,
): RoundRecord => roundRecord({ id, testId, model, cli, ms });

/** A round as the pages hold it, with its test and no grades measured. */
const round = (rec: RoundRecord): FilterableRound => ({
  record: rec,
  test: { key: rec.definition.id },
  score: {
    round: {
      final: null,
      effectiveness: { score: null },
      efficiency: { score: null },
    },
  },
});

const rounds: readonly FilterableRound[] = [
  round(record('1', 'kanban', 'qwen3.5:4b', 'claude', 300_000)),
  round(record('2', 'kanban', 'qwen2.5-coder', 'codex', 60_000)),
  round(record('3', 'react-project', 'qwen3.5:4b', 'codex', 90_000)),
];
const ids = (list: readonly { record: RoundRecord }[]): string[] =>
  list.map((r) => r.record.id).toSorted();

test('roundSpec: os campos pedidos, na ordem pedida', () => {
  const spec = roundSpec(['model', 'time', 'test']);
  expect(spec.choices.map((field) => field.key)).toEqual(['model', 'test']);
  expect(spec.numbers.map((field) => field.key)).toEqual(['time']);
  expect(ROUND_FIELDS[0]).toBe('test');
  expect(roundSpec(ROUND_FIELDS).numbers).toHaveLength(8);
});

test('o campo test filtra pelo teste da rodada, junto dos outros', () => {
  const spec = roundSpec(ROUND_FIELDS);
  const kanban = withChoice(NO_FILTERS, 'test', 'kanban');
  expect(ids(applyFilters(rounds, spec, kanban))).toEqual(['1', '2']);
  const codex = withChoice(kanban, 'cli', 'codex');
  expect(ids(applyFilters(rounds, spec, codex))).toEqual(['2']);
  const slow = withNumber(NO_FILTERS, 'time', { op: '>', text: '80s' });
  expect(ids(applyFilters(rounds, spec, slow))).toEqual(['1', '3']);
});

test('cada número lê a rodada como a tabela mostra; o que não foi medido não passa', () => {
  const spec = roundSpec(ROUND_FIELDS);
  for (const key of [
    'tokens',
    'cost',
    'files',
    'rules',
    'final',
    'effectiveness',
    'efficiency',
  ]) {
    expect(
      ids(
        applyFilters(
          rounds,
          spec,
          withNumber(NO_FILTERS, key, { op: '>', text: '0' }),
        ),
      ),
    ).toEqual([]);
  }
});

test('visibleFields: só os campos da página, na ordem dela; nada guardado mostra todos', () => {
  const page = ['test', 'model', 'time'] as const;
  expect(visibleFields(undefined, page)).toEqual(['test', 'model', 'time']);
  expect(visibleFields('lixo', page)).toEqual(['test', 'model', 'time']);
  expect(visibleFields(['time', 'test', 'sumiu'], page)).toEqual([
    'test',
    'time',
  ]);
  expect(visibleFields([], page)).toEqual([]);
});

test('withoutField: um campo escondido deixa de filtrar', () => {
  const spec = roundSpec(ROUND_FIELDS);
  const state = withNumber(withChoice(NO_FILTERS, 'cli', 'codex'), 'time', {
    op: '>',
    text: '80s',
  });
  expect(ids(applyFilters(rounds, spec, state))).toEqual(['3']);
  const noCli = withoutField(state, 'cli');
  expect(noCli.choices).toEqual({});
  expect(ids(applyFilters(rounds, spec, noCli))).toEqual(['1', '3']);
  expect(withoutField(noCli, 'time')).toEqual(NO_FILTERS);
});
