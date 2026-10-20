import { elapsedMs, isoDate, startOfDay } from './fasting';
import { stepsTarget, waterTargetMl, weightSeries } from './metrics';
import type { AppState } from './types';

/**
 * Day-by-day series for the charts.
 *
 * Days with no record are kept in the series with a null value instead of a
 * zero. A zero means "logged nothing"; a gap means "did not log" — drawing
 * them the same way would invent a bad day the person never had.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type Range = 'week' | 'month' | 'quarter';

export const RANGES: readonly { readonly id: Range; readonly label: string; readonly days: number }[] = [
  { id: 'week', label: 'Неделя', days: 7 },
  { id: 'month', label: 'Месяц', days: 30 },
  { id: 'quarter', label: '3 месяца', days: 90 },
];

export function rangeDays(range: Range): number {
  return RANGES.find((r) => r.id === range)?.days ?? 7;
}

export interface DayPoint {
  readonly date: string;
  readonly t: number;
  readonly value: number | null;
}

function emptyDays(now: number, days: number): DayPoint[] {
  const last = startOfDay(now);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const t = last - i * DAY_MS;
    out.push({ date: isoDate(t), t, value: null });
  }
  return out;
}

function fill(base: readonly DayPoint[], values: ReadonlyMap<string, number>): readonly DayPoint[] {
  return base.map((point) => ({ ...point, value: values.get(point.date) ?? point.value }));
}

/**
 * The length of the fast that ended on each day.
 *
 * Attributed to the day it ended, because that is the day the person closed
 * the window. Two fasts closed on one day show the longer one rather than
 * their sum: a window can start the day before, so adding them up would
 * print more than 24 hours for a single day and mean nothing.
 */
export function fastHoursSeries(state: AppState, now: number, days: number): readonly DayPoint[] {
  const longest = new Map<string, number>();
  for (const session of state.history) {
    if (session.endedAt === null) continue;
    const key = isoDate(session.endedAt);
    const hours = elapsedMs(session, now) / HOUR_MS;
    longest.set(key, Math.max(longest.get(key) ?? 0, hours));
  }
  return fill(emptyDays(now, days), longest);
}

export function waterSeries(state: AppState, now: number, days: number): readonly DayPoint[] {
  const values = new Map(state.days.filter((d) => d.waterMl > 0).map((d) => [d.date, d.waterMl] as const));
  return fill(emptyDays(now, days), values);
}

export function stepsSeries(state: AppState, now: number, days: number): readonly DayPoint[] {
  const values = new Map(state.days.filter((d) => d.steps > 0).map((d) => [d.date, d.steps] as const));
  return fill(emptyDays(now, days), values);
}

export function weightPoints(state: AppState, now: number, days: number): readonly { t: number; kg: number }[] {
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  return weightSeries(state.weights)
    .map((entry) => ({ t: new Date(`${entry.date}T12:00:00`).getTime(), kg: entry.kg }))
    .filter((point) => point.t >= from);
}

export interface SeriesSummary {
  /** Mean over the days that have a value — not over the whole window. */
  readonly average: number | null;
  readonly best: number | null;
  readonly logged: number;
  readonly total: number;
  /** Days that met the goal, when the series has one. */
  readonly hit: number;
}

export function summarize(points: readonly DayPoint[], goal: number | null): SeriesSummary {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) return { average: null, best: null, logged: 0, total: points.length, hit: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    average: sum / values.length,
    best: Math.max(...values),
    logged: values.length,
    total: points.length,
    hit: goal === null ? 0 : values.filter((v) => v >= goal).length,
  };
}

/** Goals used by the charts, so the dashed line and the summary agree. */
export function chartGoals(state: AppState): { readonly water: number; readonly steps: number } {
  return {
    water: waterTargetMl(state.profile.sex, state.profile.activity),
    steps: stepsTarget(state.profile.activity),
  };
}
