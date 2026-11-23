/**
 * Filters for the pages' lists (tests, rounds), without React. Two kinds:
 * a choice (a value of each row, such as an agent's model) and a number
 * compared with `<` or `>` (a value of each item, such as a round's time).
 * An item has rows (a round has its agents): it passes when its numbers pass
 * and one same row matches every choice made. Each choice offers the values
 * found in the rows that pass the other filters (facets), so choosing a
 * provider leaves only its CLIs and models; a choice with no value is not
 * shown.
 */

import { parseDuration } from '../../../rounds/criteria';

/** How a number filter reads what is typed. */
export type Unit = 'duration' | 'tokens' | 'usd' | 'count' | 'grade';

/** A choice among the values of a row: `todos` or one of them. */
export interface ChoiceField<Row> {
  readonly key: string;
  readonly label: string;
  /** The row's value; `null` when it has none (it offers nothing). */
  readonly value: (row: Row) => string | null;
}

/** A number of an item, kept above or below what is typed. */
export interface NumberField<Item> {
  readonly key: string;
  readonly label: string;
  readonly unit: Unit;
  /** The item's value, in the unit's base (ms, tokens, US$); `null` when not measured. */
  readonly value: (item: Item) => number | null;
}

/** What a list can be filtered by, and how an item gives its rows. */
export interface FilterSpec<Item, Row> {
  readonly rowsOf: (item: Item) => readonly Row[];
  readonly choices: readonly ChoiceField<Row>[];
  readonly numbers: readonly NumberField<Item>[];
}

/** A number filter as typed: the comparison and the text. */
export interface NumberFilter {
  readonly op: '<' | '>';
  readonly text: string;
}

/** What is chosen and typed, by field key. */
export interface FilterState {
  readonly choices: Readonly<Record<string, string>>;
  readonly numbers: Readonly<Record<string, NumberFilter>>;
}

/** Nothing chosen, nothing typed. */
export const NO_FILTERS: FilterState = { choices: {}, numbers: {} };

/** `1,5` and `1.5` alike; `undefined` when it is not a number. */
function decimalOf(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  return Number(normalized);
}

/** The multipliers a token count may end with: `20k`, `1,5M`. */
const TOKEN_SUFFIXES: Readonly<Record<string, number>> = {
  k: 1_000,
  m: 1_000_000,
};

/**
 * What is typed, in the unit's base: a duration in ms (`4min`, `20s`, `1h`,
 * or a bare number of seconds), tokens (`20000`, `20k`, `1,5M`), and plain
 * numbers for US$, counts and grades. `undefined` when it does not read.
 */
export function parseAmount(unit: Unit, text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  if (unit === 'duration') {
    const seconds = decimalOf(trimmed);
    if (seconds !== undefined) return seconds * 1000;
    try {
      return parseDuration(trimmed.replace(',', '.'));
    } catch {
      return undefined;
    }
  }
  if (unit === 'tokens') {
    const match = /^(.+?)\s*([kKmM])?$/.exec(trimmed);
    const amount = decimalOf(match?.[1] ?? '');
    if (amount === undefined) return undefined;
    const suffix = match?.[2]?.toLowerCase();
    return amount * (suffix === undefined ? 1 : (TOKEN_SUFFIXES[suffix] ?? 1));
  }
  return decimalOf(trimmed);
}

/** The value a number filter compares with; `undefined` when unset or unreadable. */
const limitOf = <Item>(
  field: NumberField<Item>,
  state: FilterState,
): number | undefined => {
  const filter = state.numbers[field.key];
  return filter === undefined
    ? undefined
    : parseAmount(field.unit, filter.text);
};

/** Whether a number filter is typed but does not read (shown as invalid, ignored). */
export const isInvalid = <Item>(
  field: NumberField<Item>,
  state: FilterState,
): boolean => {
  const filter = state.numbers[field.key];
  return (
    filter !== undefined &&
    filter.text.trim().length > 0 &&
    parseAmount(field.unit, filter.text) === undefined
  );
};

/** Whether anything is chosen or typed (an unreadable number counts: it can be cleared). */
export const isFiltering = (state: FilterState): boolean =>
  Object.values(state.choices).some((value) => value.length > 0) ||
  Object.values(state.numbers).some((filter) => filter.text.trim().length > 0);

/** Whether one row matches every choice made, but `except`'s. */
export function rowMatches<Row>(
  row: Row,
  choices: readonly ChoiceField<Row>[],
  state: FilterState,
  except?: string,
): boolean {
  return choices.every((field) => {
    if (field.key === except) return true;
    const chosen = state.choices[field.key] ?? '';
    return chosen.length === 0 || field.value(row) === chosen;
  });
}

/** Whether a choice other than `except` is made. */
const choosing = <Row>(
  choices: readonly ChoiceField<Row>[],
  state: FilterState,
  except?: string,
): boolean =>
  choices.some(
    (field) =>
      field.key !== except && (state.choices[field.key] ?? '').length > 0,
  );

/** Whether an item's numbers pass every number filter that reads. */
function numbersPass<Item>(
  item: Item,
  numbers: readonly NumberField<Item>[],
  state: FilterState,
): boolean {
  return numbers.every((field) => {
    const limit = limitOf(field, state);
    if (limit === undefined) return true;
    const value = field.value(item);
    if (value === null) return false;
    return state.numbers[field.key]?.op === '<' ? value < limit : value > limit;
  });
}

/** Whether an item passes: its numbers, and one same row for every choice (but `except`'s). */
function passes<Item, Row>(
  item: Item,
  spec: FilterSpec<Item, Row>,
  state: FilterState,
  except?: string,
): boolean {
  if (!numbersPass(item, spec.numbers, state)) return false;
  if (!choosing(spec.choices, state, except)) return true;
  return spec
    .rowsOf(item)
    .some((row) => rowMatches(row, spec.choices, state, except));
}

/** The items that pass every filter, in their order. */
export const applyFilters = <Item, Row>(
  items: readonly Item[],
  spec: FilterSpec<Item, Row>,
  state: FilterState,
): Item[] => items.filter((item) => passes(item, spec, state));

/**
 * What a choice offers: the values of the rows that pass every other filter,
 * sorted. Its own choice is left out, so the others stay offered.
 */
export function choiceOptions<Item, Row>(
  items: readonly Item[],
  spec: FilterSpec<Item, Row>,
  state: FilterState,
  field: ChoiceField<Row>,
): string[] {
  const values = items
    .filter((item) => passes(item, spec, state, field.key))
    .flatMap((item) =>
      spec
        .rowsOf(item)
        .filter((row) => rowMatches(row, spec.choices, state, field.key))
        .map((row) => field.value(row)),
    )
    .filter((value): value is string => value !== null && value.length > 0);
  return [...new Set(values)].toSorted();
}

/**
 * The choices to show, with what each offers: every one with at least one
 * value (one alone is still shown: the bar keeps its fields), or one already
 * chosen (it can still be undone).
 */
export function shownChoices<Item, Row>(
  items: readonly Item[],
  spec: FilterSpec<Item, Row>,
  state: FilterState,
): { readonly field: ChoiceField<Row>; readonly options: string[] }[] {
  return spec.choices.flatMap((field) => {
    const options = choiceOptions(items, spec, state, field);
    const chosen = state.choices[field.key] ?? '';
    if (chosen.length === 0 && options.length === 0) return [];
    return [
      {
        field,
        options:
          chosen.length > 0 && !options.includes(chosen)
            ? [...options, chosen].toSorted()
            : options,
      },
    ];
  });
}

/** The state with a choice made (`''` undoes it). */
export const withChoice = (
  state: FilterState,
  key: string,
  value: string,
): FilterState => ({ ...state, choices: { ...state.choices, [key]: value } });

/** The state with a number filter typed. */
export const withNumber = (
  state: FilterState,
  key: string,
  filter: NumberFilter,
): FilterState => ({ ...state, numbers: { ...state.numbers, [key]: filter } });
