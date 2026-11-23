/**
 * The filters of a list (rounds): one select per choice ("todos" or a
 * value; one value alone shows as chosen), and per number a `<`/`>` and a field that
 * reads the unit (`4min`, `20k`, `0,05`, `7`), marked when it does not
 * read. "Limpar filtros" while anything is set. The logic is in filters.ts;
 * the page keeps the state (`useFilters`) and filters its own list.
 */

import { useState, type ReactNode } from 'react';

import {
  isFiltering,
  isInvalid,
  NO_FILTERS,
  shownChoices,
  withChoice,
  withNumber,
  type FilterSpec,
  type FilterState,
  type Unit,
} from '../filters';

/** What each unit's field shows as an example. */
const EXAMPLES: Readonly<Record<Unit, string>> = {
  duration: '4min',
  tokens: '20k',
  usd: '0,05',
  count: '3',
  grade: '7',
};

/** The state of a list's filters, starting empty. */
export function useFilters(): {
  readonly state: FilterState;
  readonly setState: (state: FilterState) => void;
} {
  const [state, setState] = useState<FilterState>(NO_FILTERS);
  return { state, setState };
}

export function FilterBar<Item, Row>({
  items,
  spec,
  state,
  onChange,
  actions,
}: {
  /** Every item of the list, filtered or not: the choices come from them. */
  readonly items: readonly Item[];
  readonly spec: FilterSpec<Item, Row>;
  readonly state: FilterState;
  readonly onChange: (state: FilterState) => void;
  /** Buttons at the end of the bar, such as the one that picks its fields. */
  readonly actions?: ReactNode;
}): ReactNode {
  return (
    <div className="filters">
      {shownChoices(items, spec, state).map(({ field, options }) => (
        <label key={field.key}>
          <span>{field.label}</span>
          <select
            // One value alone is shown as chosen: it is the same as "todos".
            value={
              (state.choices[field.key] ?? '') ||
              (options.length === 1 ? (options[0] ?? '') : '')
            }
            onChange={(event) =>
              onChange(withChoice(state, field.key, event.target.value))
            }
          >
            <option value="">todos</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ))}
      {spec.numbers.map((field) => {
        const filter = state.numbers[field.key] ?? { op: '>', text: '' };
        return (
          <label key={field.key} className="number-filter">
            <span>{field.label}</span>
            <span className="number-filter-inputs">
              <select
                aria-label={`${field.label}: maior ou menor que`}
                value={filter.op}
                onChange={(event) =>
                  onChange(
                    withNumber(state, field.key, {
                      ...filter,
                      op: event.target.value === '<' ? '<' : '>',
                    }),
                  )
                }
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input
                inputMode="decimal"
                placeholder={EXAMPLES[field.unit]}
                value={filter.text}
                aria-invalid={isInvalid(field, state)}
                onChange={(event) =>
                  onChange(
                    withNumber(state, field.key, {
                      ...filter,
                      text: event.target.value,
                    }),
                  )
                }
              />
            </span>
          </label>
        );
      })}
      {isFiltering(state) && (
        <button
          type="button"
          className="more-rounds filters-clear"
          onClick={() => onChange(NO_FILTERS)}
        >
          Limpar filtros
        </button>
      )}
      {actions}
    </div>
  );
}
