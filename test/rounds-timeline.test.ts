import { expect, test } from 'bun:test';

import { rowExtent } from '../src/rounds/web/src/timeline';

/** The chart's timeline: seconds after the first sample, kept inside 0–maxT. */
const t0 = Date.parse('2026-11-16T22:03:08.000Z');
const maxT = 280;
const onTimeline = (iso: string): number =>
  Math.min(maxT, Math.max(0, (Date.parse(iso) - t0) / 1000));
const at = (second: number): string =>
  new Date(t0 + second * 1000).toISOString();

test('rowExtent: um span só também é uma linha, do início ao fim', () => {
  expect(
    rowExtent([{ startedAt: at(5), endedAt: at(200) }], onTimeline),
  ).toEqual({
    from: 5,
    to: 200,
  });
});

test('rowExtent: vários vão do primeiro início ao último fim, fora de ordem', () => {
  expect(
    rowExtent(
      [
        { startedAt: at(120), endedAt: at(250) },
        { startedAt: at(10), endedAt: at(90) },
      ],
      onTimeline,
    ),
  ).toEqual({ from: 10, to: 250 });
});

test('rowExtent: o que começa antes da primeira amostra ou acaba depois fica dentro do eixo', () => {
  expect(
    rowExtent([{ startedAt: at(-1), endedAt: at(281) }], onTimeline),
  ).toEqual({ from: 0, to: 280 });
});

test('rowExtent: sem spans, sem linha', () => {
  expect(rowExtent([], onTimeline)).toBeUndefined();
});
