import { isoDate, reachedGoal, startOfDay, elapsedMs } from './fasting';
import { planById } from './plans';
import type { Activity, FastSession, PlanId, Profile, Units, WeightEntry } from './types';

const DAY_MS = 86_400_000;

export function bmi(kg: number, heightCm: number): number | null {
  if (!(kg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return kg / (m * m);
}

export function bmiBand(value: number): { label: string; tone: 'low' | 'ok' | 'warn' | 'high' } {
  if (value < 18.5) return { label: 'Ниже нормы', tone: 'low' };
  if (value < 25) return { label: 'Норма', tone: 'ok' };
  if (value < 30) return { label: 'Избыточный вес', tone: 'warn' };
  return { label: 'Ожирение', tone: 'high' };
}

/**
 * A reference for drinks, not a medical norm — and the app says so.
 *
 * The "30 ml per kg" figure these apps all use comes from maintenance
 * intravenous fluid prescribing (NICE; originally Holliday–Segar, derived for
 * children), not from research on how much a healthy person should drink.
 * This uses the EFSA adequate intake for total water — 2.5 l for men, 2.0 l
 * for women — of which roughly 70–80% is normally expected from drinks, with
 * the rest coming from food. A short eating window shifts some of that food
 * water onto drinks, which is the one real reason to pay attention while
 * fasting.
 */
export function waterTargetMl(sex: Profile['sex'], activity: Activity | null): number {
  const total = sex === 'male' ? 2500 : 2000;
  const fromDrinks = total * 0.75;
  const exercise = activity === 'high' ? 400 : activity === 'moderate' ? 250 : 0;
  return Math.round((fromDrinks + exercise) / 50) * 50;
}

export const WATER_NOTE =
  'Единой доказанной нормы в миллилитрах нет. Правило «30 мл на кг», которое показывают почти все трекеры, пришло из расчёта ' +
  'внутривенных растворов для пациентов, а не из исследований о питье. Здесь — ориентир EFSA по общей воде за вычетом той, ' +
  'что приходит с едой. Надёжнее смотреть на жажду и цвет мочи, а в окне голодания пить осознаннее: часть воды обычно ' +
  'поступает с пищей, и при коротком окне этой части меньше.';

export function stepsTarget(activity: Activity | null): number {
  switch (activity) {
    case 'sedentary':
      return 6000;
    case 'light':
      return 8000;
    case 'moderate':
      return 10000;
    case 'high':
      return 12000;
    default:
      return 8000;
  }
}

/**
 * Rough weekly loss used by the plan preview and the paywall chart.
 * This is an estimate from the chosen window and activity level, not a
 * prediction — the UI labels it as such everywhere it appears.
 */
export function weeklyLossKg(planId: PlanId, activity: Activity | null): number {
  const base = 0.12 * (planById(planId).fastHours - 10);
  const bump = activity === 'high' ? 0.25 : activity === 'moderate' ? 0.15 : activity === 'light' ? 0.07 : 0;
  return Math.min(0.9, Math.max(0.25, Number((base + bump).toFixed(2))));
}

export interface Projection {
  readonly weeklyKg: number;
  readonly totalKg: number;
  readonly weeks: number;
  readonly date: Date;
}

export function projectGoal(
  startKg: number | null,
  goalKg: number | null,
  planId: PlanId,
  activity: Activity | null,
  now: number,
): Projection | null {
  if (!startKg || !goalKg || goalKg >= startKg) return null;
  const weeklyKg = weeklyLossKg(planId, activity);
  const totalKg = Number((startKg - goalKg).toFixed(1));
  const weeks = Math.max(1, Math.ceil(totalKg / weeklyKg));
  return { weeklyKg, totalKg, weeks, date: new Date(now + weeks * 7 * DAY_MS) };
}

/** Points along the projected curve, for the plan-reveal chart. */
export function projectionSeries(
  startKg: number,
  goalKg: number,
  weeklyKg: number,
  now: number,
): readonly { readonly t: number; readonly kg: number }[] {
  const weeks = Math.max(1, Math.ceil((startKg - goalKg) / weeklyKg));
  const points: { t: number; kg: number }[] = [];
  for (let w = 0; w <= weeks; w += 1) {
    points.push({ t: now + w * 7 * DAY_MS, kg: Math.max(goalKg, Number((startKg - w * weeklyKg).toFixed(2))) });
  }
  return points;
}

export interface FastStats {
  readonly completed: number;
  readonly totalMs: number;
  readonly averageMs: number;
  readonly longestMs: number;
  readonly streak: number;
  readonly goalRate: number;
}

export function fastStats(history: readonly FastSession[], now: number): FastStats {
  const done = history.filter((s) => s.endedAt !== null);
  const totalMs = done.reduce((sum, s) => sum + elapsedMs(s, now), 0);
  const longestMs = done.reduce((max, s) => Math.max(max, elapsedMs(s, now)), 0);
  const hit = done.filter(reachedGoal).length;
  return {
    completed: done.length,
    totalMs,
    averageMs: done.length ? Math.round(totalMs / done.length) : 0,
    longestMs,
    streak: streakDays(done, now),
    goalRate: done.length ? hit / done.length : 0,
  };
}

/**
 * Consecutive days ending today or yesterday that contain a finished fast.
 * Yesterday counts so that a streak is not lost before the day is over.
 */
export function streakDays(done: readonly FastSession[], now: number): number {
  const days = new Set(done.map((s) => isoDate(s.endedAt ?? s.startedAt)));
  if (days.size === 0) return 0;
  const today = startOfDay(now);
  let cursor = days.has(isoDate(today)) ? today : today - DAY_MS;
  if (!days.has(isoDate(cursor))) return 0;
  let streak = 0;
  while (days.has(isoDate(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Weight entries sorted oldest first, de-duplicated by day. */
export function weightSeries(entries: readonly WeightEntry[]): readonly WeightEntry[] {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function kgToDisplay(kg: number, units: Units): number {
  return units === 'metric' ? kg : kg * 2.2046226218;
}

export function displayToKg(value: number, units: Units): number {
  return units === 'metric' ? value : value / 2.2046226218;
}

export function weightUnit(units: Units): string {
  return units === 'metric' ? 'кг' : 'фнт';
}

export function formatWeight(kg: number, units: Units): string {
  return `${kgToDisplay(kg, units).toFixed(1)} ${weightUnit(units)}`;
}
