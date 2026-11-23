/**
 * The filter of every list of rounds in the pages: the same bar, with the
 * fields each page asks for (`fields`, keys of round-filters.ts), in that
 * order. A gear opens the fields' modal: each can be hidden, and a hidden
 * field stops filtering. Which ones show is kept per page (`storageKey`) in
 * the viewer's browser; without it, all show. The page keeps the filters'
 * state (`useFilters`) and filters its rounds with
 * `applyFilters(rounds, roundSpec(fields), state)`.
 */

import { useState, type ReactNode } from 'react';

import type { Round } from '../data';
import type { FilterState } from '../filters';
import {
  ROUND_FIELDS,
  roundSpec,
  visibleFields,
  withoutField,
  type RoundFieldKey,
} from '../round-filters';
import { FilterBar } from './FilterBar';
import { Modal } from './Modal';

/** Where a page's shown fields are kept, in the viewer's browser. */
const storageName = (key: string): string => `choliba.filtros.${key}`;

/** What was kept for a page; `undefined` when nothing, or no storage. */
function readKept(key: string): unknown {
  try {
    const text = localStorage.getItem(storageName(key));
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/** Keeps a page's shown fields; without storage, they last until the page reloads. */
function keep(key: string, fields: readonly RoundFieldKey[]): void {
  try {
    localStorage.setItem(storageName(key), JSON.stringify(fields));
  } catch {
    // No storage (a private window, blocked site data): nothing to keep.
  }
}

/** Every field of the catalog, choices and numbers. */
const CATALOG = roundSpec(ROUND_FIELDS);

/** A field's label, as the bar shows it. */
const labelOf = (key: RoundFieldKey): string =>
  [...CATALOG.choices, ...CATALOG.numbers].find((field) => field.key === key)
    ?.label ?? key;

/** A gear, drawn: a ring of teeth around a hole. */
function GearIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="3.1 3.2"
      />
      <circle
        cx="12"
        cy="12"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function RoundFilters({
  rounds,
  fields,
  storageKey,
  state,
  onChange,
}: {
  /** Every round of the list, filtered or not: the choices come from them. */
  readonly rounds: readonly Round[];
  readonly fields: readonly RoundFieldKey[];
  /** The page's name for its kept fields: `indice`, `teste`. */
  readonly storageKey: string;
  readonly state: FilterState;
  readonly onChange: (state: FilterState) => void;
}): ReactNode {
  const [shown, setShown] = useState(() =>
    visibleFields(readKept(storageKey), fields),
  );
  const [picking, setPicking] = useState(false);

  const show = (next: readonly RoundFieldKey[]): void => {
    const ordered = fields.filter((key) => next.includes(key));
    setShown(ordered);
    keep(storageKey, ordered);
  };
  const toggle = (key: RoundFieldKey, on: boolean): void => {
    if (on) {
      show([...shown, key]);
      return;
    }
    show(shown.filter((field) => field !== key));
    onChange(withoutField(state, key));
  };

  return (
    <>
      <FilterBar
        items={rounds}
        spec={roundSpec(shown)}
        state={state}
        onChange={onChange}
        actions={
          <button
            type="button"
            className="more-rounds filters-fields"
            aria-label="Escolher os campos do filtro"
            title="Escolher os campos do filtro"
            onClick={() => setPicking(true)}
          >
            <GearIcon />
          </button>
        }
      />
      <Modal
        title="Campos do filtro"
        open={picking}
        onClose={() => setPicking(false)}
        actions={
          shown.length < fields.length && (
            <button
              type="button"
              className="more-rounds"
              onClick={() => show(fields)}
            >
              Mostrar todos
            </button>
          )
        }
      >
        <ul className="filter-fields">
          {fields.map((key) => (
            <li key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={shown.includes(key)}
                  onChange={(event) => toggle(key, event.target.checked)}
                />
                {labelOf(key)}
              </label>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
