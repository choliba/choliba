/**
 * Every filter the pages offer over rounds, by key, and the spec of the
 * ones a page asks for (`roundSpec(fields)`), in the order asked. A row is
 * one agent of a round, with the round's test: the choices (test, agent,
 * provider, CLI, model) are matched by one same row; the numbers are the
 * round's, as the tables show them.
 */

import type { ActorSnapshot, RoundRecord } from '../../../rounds/types';
import type {
  ChoiceField,
  FilterSpec,
  FilterState,
  NumberField,
} from './filters';
import { changedFiles, roundTokens } from './summary';

/** What the filters read of a round: the pages' `Round` is one. */
export interface FilterableRound {
  readonly record: RoundRecord;
  readonly test: { readonly key: string };
  readonly score: {
    readonly round: {
      readonly final: number | null;
      readonly effectiveness: { readonly score: number | null };
      readonly efficiency: { readonly score: number | null };
    };
  };
}

/** An agent of a round, with the round's test. */
export interface RoundRow {
  readonly test: string;
  readonly role: string;
  readonly actor: ActorSnapshot;
}

/** The agents of a round, each with the round's test. */
export const roundRows = (round: FilterableRound): RoundRow[] =>
  Object.entries(round.record.actors).map(([role, actor]) => ({
    test: round.test.key,
    role,
    actor,
  }));

/** How many of a round's rules were broken; `null` when they were not checked. */
const brokenRules = (record: RoundRecord): number | null =>
  record.start === null
    ? null
    : record.violations.filter((violation) => !violation.passed).length;

/** The choices, by key. */
const CHOICES = {
  test: { key: 'test', label: 'Teste', value: (row) => row.test },
  role: { key: 'role', label: 'Agente', value: (row) => row.role },
  provider: {
    key: 'provider',
    label: 'Provider',
    value: (row) => row.actor.provider.name,
  },
  // Ollama drives claude or codex; the others have none.
  cli: { key: 'cli', label: 'CLI', value: (row) => row.actor.provider.cli },
  model: {
    key: 'model',
    label: 'Modelo',
    value: (row) => row.actor.provider.model,
  },
} as const satisfies Readonly<Record<string, ChoiceField<RoundRow>>>;

/** The numbers, by key, as the rounds' tables show them. */
const NUMBERS = {
  time: {
    key: 'time',
    label: 'Tempo',
    unit: 'duration',
    value: (round) => round.record.timing.durationMs,
  },
  tokens: {
    key: 'tokens',
    label: 'Tokens',
    unit: 'tokens',
    value: (round) => roundTokens(round.record),
  },
  cost: {
    key: 'cost',
    label: 'Custo',
    unit: 'usd',
    value: (round) => round.record.totals.round.costUsd,
  },
  files: {
    key: 'files',
    label: 'Arquivos',
    unit: 'count',
    value: (round) => changedFiles(round.record),
  },
  rules: {
    key: 'rules',
    label: 'Regras violadas',
    unit: 'count',
    value: (round) => brokenRules(round.record),
  },
  final: {
    key: 'final',
    label: 'Nota',
    unit: 'grade',
    value: (round) => round.score.round.final,
  },
  effectiveness: {
    key: 'effectiveness',
    label: 'Eficácia',
    unit: 'grade',
    value: (round) => round.score.round.effectiveness.score,
  },
  efficiency: {
    key: 'efficiency',
    label: 'Eficiência',
    unit: 'grade',
    value: (round) => round.score.round.efficiency.score,
  },
} as const satisfies Readonly<Record<string, NumberField<FilterableRound>>>;

/** A filter the pages can ask for. */
export type RoundFieldKey = keyof typeof CHOICES | keyof typeof NUMBERS;

/** Every field, in the pages' order: the test, the agent, then the numbers. */
export const ROUND_FIELDS: readonly RoundFieldKey[] = [
  'test',
  'role',
  'provider',
  'cli',
  'model',
  'time',
  'tokens',
  'cost',
  'files',
  'rules',
  'final',
  'effectiveness',
  'efficiency',
];

const isChoice = (key: RoundFieldKey): key is keyof typeof CHOICES =>
  key in CHOICES;

/** The spec of the fields asked, in their order (choices are drawn before numbers). */
export function roundSpec(
  fields: readonly RoundFieldKey[],
): FilterSpec<FilterableRound, RoundRow> {
  return {
    rowsOf: roundRows,
    choices: fields.filter(isChoice).map((key) => CHOICES[key]),
    numbers: fields
      .filter((key): key is keyof typeof NUMBERS => !isChoice(key))
      .map((key) => NUMBERS[key]),
  };
}

/**
 * The fields shown, from what was kept (a list of keys): only the page's
 * own, in the page's order; nothing kept, or something else, shows them all.
 */
export function visibleFields(
  kept: unknown,
  fields: readonly RoundFieldKey[],
): RoundFieldKey[] {
  if (!Array.isArray(kept)) return [...fields];
  return fields.filter((key) => kept.includes(key));
}

/** The state without what a field had chosen or typed: a hidden field does not filter. */
export function withoutField(state: FilterState, key: string): FilterState {
  const { [key]: _choice, ...choices } = state.choices;
  const { [key]: _number, ...numbers } = state.numbers;
  return { choices, numbers };
}
