import type { FastSession } from './types';

/**
 * How a finished fast actually felt.
 *
 * This is the one thing a tracker can collect that turns its own history into
 * advice: without it, "you fasted 16 hours" is a number with nothing to
 * compare against. With it, the coach can say which window length actually
 * suits this person instead of repeating the brochure.
 */
export interface Wellbeing {
  /** 1–5, higher is better. */
  readonly energy: number;
  /** 1–5, higher means hungrier. */
  readonly hunger: number;
  /** 1–5, higher is better. */
  readonly sleep: number;
  readonly note?: string;
}

export const WELLBEING_SCALES: readonly {
  readonly key: keyof Pick<Wellbeing, 'energy' | 'hunger' | 'sleep'>;
  readonly question: string;
  readonly low: string;
  readonly high: string;
}[] = [
  { key: 'energy', question: 'Энергия за это окно', low: 'Разбитость', high: 'Бодрость' },
  { key: 'hunger', question: 'Насколько мучил голод', low: 'Почти не было', high: 'Тяжело' },
  { key: 'sleep', question: 'Как спалось', low: 'Плохо', high: 'Отлично' },
];

export type Rated = FastSession & { readonly wellbeing: Wellbeing };

export function isRated(session: FastSession): session is Rated {
  const candidate = (session as Partial<Rated>).wellbeing;
  return !!candidate && typeof candidate.energy === 'number';
}

/** Mean rating per rounded window length, for the coach's comparisons. */
export function byWindowLength(
  sessions: readonly FastSession[],
  pick: (w: Wellbeing) => number,
): readonly { readonly hours: number; readonly mean: number; readonly count: number }[] {
  const buckets = new Map<number, number[]>();
  for (const session of sessions) {
    if (!isRated(session) || session.endedAt === null) continue;
    const hours = Math.round((session.endedAt - session.startedAt) / 3_600_000);
    const list = buckets.get(hours) ?? [];
    list.push(pick(session.wellbeing));
    buckets.set(hours, list);
  }
  return [...buckets.entries()]
    .map(([hours, values]) => ({
      hours,
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      count: values.length,
    }))
    .sort((a, b) => a.hours - b.hours);
}
