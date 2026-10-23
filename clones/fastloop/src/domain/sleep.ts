import { isoDate, startOfDay } from './fasting';
import type { AppState, SleepEntry } from './types';

/**
 * Sleep, and what it has to do with when you ate.
 *
 * The tracking part is ordinary: when you fell asleep, when you woke, and
 * the stage minutes if a watch measured them. The part worth building is the
 * other half — this app already knows the timestamp of every meal, so it can
 * answer a question no sleep tracker can: does eating late cost you sleep,
 * for you specifically.
 *
 * That answer is a correlation inside one person's diary, which is a weak
 * kind of evidence and is labelled as such everywhere it appears. It is
 * still worth more than the same claim read in an article, because it is
 * about them. What it must never do is state a cause: a late dinner and a
 * short night share plenty of other explanations, starting with a late
 * evening.
 */

export const SLEEP_TARGET_MIN = 7 * 60;

export function durationMin(entry: SleepEntry): number {
  return Math.max(0, Math.round((entry.wokeAt - entry.asleepAt) / 60_000));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

export function sleepOn(state: AppState, date: string): SleepEntry | null {
  return state.sleep.find((entry) => entry.date === date) ?? null;
}

/** Nights in the window, oldest first, one per date. */
export function sleepSeries(state: AppState, days: number, now: number): readonly SleepEntry[] {
  const from = startOfDay(now) - (days - 1) * 86_400_000;
  return [...state.sleep]
    .filter((entry) => entry.wokeAt >= from)
    .sort((a, b) => a.asleepAt - b.asleepAt);
}

export function averageMin(entries: readonly SleepEntry[]): number | null {
  if (entries.length === 0) return null;
  return Math.round(entries.reduce((sum, entry) => sum + durationMin(entry), 0) / entries.length);
}

/** Stage minutes only make sense when a watch supplied all of them. */
export function hasStages(entry: SleepEntry): boolean {
  return entry.deep !== null && entry.light !== null && entry.rem !== null;
}

export interface MealLink {
  /** Nights after the last meal landed close to bedtime. */
  readonly lateNights: number;
  readonly lateAvgMin: number;
  /** Nights after an earlier last meal. */
  readonly earlyNights: number;
  readonly earlyAvgMin: number;
  /** Positive means the early-dinner nights were longer. */
  readonly differenceMin: number;
  /** The boundary used, in hours before falling asleep. */
  readonly gapHours: number;
}

/** Below this there is nothing to say, and saying it anyway would be noise. */
const MIN_NIGHTS = 5;
const LATE_GAP_HOURS = 3;

/**
 * Compares nights that followed a late last meal with nights that did not.
 *
 * Returns null unless both groups have enough nights to be worth a sentence.
 * The threshold is deliberately blunt — five nights each — because the point
 * is to avoid announcing a pattern from two data points, not to pass a
 * statistics exam.
 */
export function mealSleepLink(state: AppState): MealLink | null {
  const late: number[] = [];
  const early: number[] = [];

  for (const night of state.sleep) {
    const duration = durationMin(night);
    // A record of eighteen hours is a typo, not a night.
    if (duration < 120 || duration > 900) continue;
    const before = state.meals.filter((meal) => meal.at <= night.asleepAt && night.asleepAt - meal.at <= 12 * 3_600_000);
    if (before.length === 0) continue;
    const lastMeal = Math.max(...before.map((meal) => meal.at));
    const gapHours = (night.asleepAt - lastMeal) / 3_600_000;
    if (gapHours < LATE_GAP_HOURS) late.push(duration);
    else early.push(duration);
  }

  if (late.length < MIN_NIGHTS || early.length < MIN_NIGHTS) return null;
  const mean = (list: readonly number[]): number => Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  const lateAvgMin = mean(late);
  const earlyAvgMin = mean(early);
  return {
    lateNights: late.length,
    lateAvgMin,
    earlyNights: early.length,
    earlyAvgMin,
    differenceMin: earlyAvgMin - lateAvgMin,
    gapHours: LATE_GAP_HOURS,
  };
}

/**
 * Turns the comparison into a sentence, or into silence.
 *
 * Under twenty minutes either way is not a finding: night-to-night variation
 * swamps it, and dressing it up as one would be exactly the false precision
 * the rest of the app refuses.
 */
export function describeLink(link: MealLink): string {
  const size = Math.abs(link.differenceMin);
  if (size < 20) {
    return `За ${link.lateNights + link.earlyNights} ночей разницы между поздним и ранним ужином у вас не видно: ${formatDuration(link.lateAvgMin)} против ${formatDuration(link.earlyAvgMin)}. Это не значит, что связи нет — значит, в ваших записях она пока не проступает.`;
  }
  const longer = link.differenceMin > 0 ? 'дольше' : 'короче';
  return `В ночи после раннего ужина вы спали в среднем на ${size} мин ${longer}: ${formatDuration(link.earlyAvgMin)} против ${formatDuration(link.lateAvgMin)} после позднего. Это связь в ваших записях, а не причина: поздний ужин и короткий сон часто идут вместе просто потому, что вечер затянулся.`;
}

/** The night that belongs to this morning, for the «как спали» prompt. */
export function todayNightDate(now: number): string {
  return isoDate(now);
}
