/**
 * Where a row of the resource chart (Atores, Turnos) runs: from the first
 * start to the last end of its spans, in seconds on the chart's timeline.
 * Pure: the chart gives the spans and how an instant falls on its timeline.
 */

/** Something that ran: a step (an actor) or a turn. */
export interface TimelineSpan {
  readonly startedAt: string;
  readonly endedAt: string;
}

/** A row's line, in seconds on the timeline. */
export interface RowExtent {
  readonly from: number;
  readonly to: number;
}

/**
 * The line of a row: from its first start to its last end, one span or
 * many; `undefined` without any.
 */
export function rowExtent(
  spans: readonly TimelineSpan[],
  onTimeline: (iso: string) => number,
): RowExtent | undefined {
  if (spans.length === 0) return undefined;
  const starts = spans.map((span) => onTimeline(span.startedAt));
  const ends = spans.map((span) => onTimeline(span.endedAt));
  return { from: Math.min(...starts), to: Math.max(...ends) };
}
