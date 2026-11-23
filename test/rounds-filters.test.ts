import { expect, test } from 'bun:test';

import {
  applyFilters,
  choiceOptions,
  isFiltering,
  isInvalid,
  NO_FILTERS,
  parseAmount,
  rowMatches,
  shownChoices,
  withChoice,
  withNumber,
  type ChoiceField,
  type FilterSpec,
  type NumberField,
} from '../src/rounds/web/src/filters';

/** An agent of a round: its role, provider, CLI and model. */
interface Agent {
  readonly role: string;
  readonly provider: string;
  readonly cli: string | null;
  readonly model: string;
}

/** A round: its agents and two numbers. */
interface Round {
  readonly id: string;
  readonly agents: readonly Agent[];
  readonly ms: number | null;
  readonly grade: number | null;
}

const agent = (
  role: string,
  provider: string,
  cli: string | null,
  model: string,
): Agent => ({ role, provider, cli, model });

const ROUNDS: readonly Round[] = [
  {
    id: 'a',
    agents: [
      agent('po', 'ollama', 'codex', 'qwen3.5:4b'),
      agent('dev', 'claude', null, 'sonnet'),
    ],
    ms: 300_000,
    grade: 4,
  },
  {
    id: 'b',
    agents: [agent('po', 'ollama', 'claude', 'qwen2.5-coder:7b')],
    ms: 120_000,
    grade: 8,
  },
  {
    id: 'c',
    agents: [agent('po', 'codex', null, 'gpt')],
    ms: null,
    grade: null,
  },
];

const role: ChoiceField<Agent> = {
  key: 'role',
  label: 'Agente',
  value: (a) => a.role,
};
const provider: ChoiceField<Agent> = {
  key: 'provider',
  label: 'Provider',
  value: (a) => a.provider,
};
const cli: ChoiceField<Agent> = {
  key: 'cli',
  label: 'CLI',
  value: (a) => a.cli,
};
const model: ChoiceField<Agent> = {
  key: 'model',
  label: 'Modelo',
  value: (a) => a.model,
};
const TIME: NumberField<Round> = {
  key: 'time',
  label: 'Tempo',
  unit: 'duration',
  value: (r) => r.ms,
};

const SPEC: FilterSpec<Round, Agent> = {
  rowsOf: (round) => round.agents,
  choices: [role, provider, cli, model],
  numbers: [
    TIME,
    { key: 'grade', label: 'Nota', unit: 'grade', value: (r) => r.grade },
  ],
};

const ids = (rounds: readonly Round[]): string[] => rounds.map((r) => r.id);

test('sem filtro, tudo passa', () => {
  expect(ids(applyFilters(ROUNDS, SPEC, NO_FILTERS))).toEqual(['a', 'b', 'c']);
  expect(isFiltering(NO_FILTERS)).toBe(false);
});

test('as escolhas valem para um mesmo agente', () => {
  // dev é claude, mas o modelo qwen3.5:4b é do po: nenhum agente bate com os dois.
  const state = withChoice(
    withChoice(NO_FILTERS, 'role', 'dev'),
    'model',
    'qwen3.5:4b',
  );
  expect(ids(applyFilters(ROUNDS, SPEC, state))).toEqual([]);
  const po = withChoice(state, 'role', 'po');
  expect(ids(applyFilters(ROUNDS, SPEC, po))).toEqual(['a']);
  expect(
    rowMatches(agent('po', 'x', null, 'qwen3.5:4b'), SPEC.choices, po),
  ).toBe(true);
});

test('facetas: escolher o provider deixa só os CLIs e modelos dele; o próprio filtro não se reduz', () => {
  const state = withChoice(NO_FILTERS, 'provider', 'ollama');
  expect(choiceOptions(ROUNDS, SPEC, state, cli)).toEqual(['claude', 'codex']);
  expect(choiceOptions(ROUNDS, SPEC, state, model)).toEqual([
    'qwen2.5-coder:7b',
    'qwen3.5:4b',
  ]);
  expect(choiceOptions(ROUNDS, SPEC, state, provider)).toEqual([
    'claude',
    'codex',
    'ollama',
  ]);
});

test('shownChoices: mostra o filtro de uma opção só, some o sem opção, e o escolhido fica', () => {
  const one: readonly Round[] = [
    { id: 'x', agents: [agent('po', 'ollama', null, 'm')], ms: 1, grade: 1 },
  ];
  // One value alone is still shown; no value (the CLI here) is not.
  expect(
    shownChoices(one, SPEC, NO_FILTERS).map(({ field }) => field.key),
  ).toEqual(['role', 'provider', 'model']);
  const chosen = withChoice(NO_FILTERS, 'model', 'outro');
  expect(shownChoices(one, SPEC, chosen)).toEqual([
    { field: model, options: ['m', 'outro'] },
  ]);
  expect(
    shownChoices(ROUNDS, SPEC, NO_FILTERS).map(({ field }) => field.key),
  ).toEqual(['role', 'provider', 'cli', 'model']);
});

test('números: < e >, e o que não foi medido fica de fora', () => {
  const slow = withNumber(NO_FILTERS, 'time', { op: '>', text: '4min' });
  expect(ids(applyFilters(ROUNDS, SPEC, slow))).toEqual(['a']);
  const fast = withNumber(NO_FILTERS, 'time', { op: '<', text: '4min' });
  expect(ids(applyFilters(ROUNDS, SPEC, fast))).toEqual(['b']);
  const low = withNumber(fast, 'grade', { op: '<', text: '5' });
  expect(ids(applyFilters(ROUNDS, SPEC, low))).toEqual([]);
});

test('um número que não lê é marcado e ignorado', () => {
  const state = withNumber(NO_FILTERS, 'time', { op: '>', text: 'muito' });
  const time = TIME;
  expect(isInvalid(time, state)).toBe(true);
  expect(isFiltering(state)).toBe(true);
  expect(ids(applyFilters(ROUNDS, SPEC, state))).toEqual(['a', 'b', 'c']);
  expect(
    isInvalid(time, withNumber(NO_FILTERS, 'time', { op: '>', text: ' ' })),
  ).toBe(false);
});

test('parseAmount lê cada unidade', () => {
  expect(parseAmount('duration', '4min')).toBe(240_000);
  expect(parseAmount('duration', '1,5min')).toBe(90_000);
  expect(parseAmount('duration', '90')).toBe(90_000);
  expect(parseAmount('duration', '2 dias')).toBeUndefined();
  expect(parseAmount('tokens', '20000')).toBe(20_000);
  expect(parseAmount('tokens', '20k')).toBe(20_000);
  expect(parseAmount('tokens', '1,5M')).toBe(1_500_000);
  expect(parseAmount('tokens', 'k')).toBeUndefined();
  expect(parseAmount('usd', '0,05')).toBe(0.05);
  expect(parseAmount('count', '3')).toBe(3);
  expect(parseAmount('grade', '7.5')).toBe(7.5);
  expect(parseAmount('grade', '')).toBeUndefined();
  expect(parseAmount('grade', '-1')).toBeUndefined();
});
