import type { Macros } from './recipes';
import type { Activity, AppState, FoodEntry, MealSlot, Profile } from './types';

/**
 * How many calories a day, and how they split.
 *
 * Mifflin–St Jeor for resting metabolism, an activity factor for the rest,
 * and a deficit that is deliberately modest. Every number here is an
 * estimate for an average person of these measurements — individual
 * metabolism varies by roughly ±10%, which is why the app treats the target
 * as a starting point and corrects it against the weight line rather than
 * trusting the formula.
 */

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const SLOT_LABEL: Readonly<Record<MealSlot, string>> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const ACTIVITY_FACTOR: Readonly<Record<Activity, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

/** Resting metabolic rate, kcal/day. Null when measurements are missing. */
export function bmr(profile: Profile, kg: number | null): number | null {
  const weight = kg ?? profile.startKg;
  if (!weight || !profile.heightCm || !profile.age) return null;
  const base = 10 * weight + 6.25 * profile.heightCm - 5 * profile.age;
  // The sex term is +5 for men and −161 for women. With no answer the
  // midpoint is used rather than a guess from the name or anything else.
  const sexTerm = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  return Math.round(base + sexTerm);
}

/** Maintenance calories: resting rate times how much the person moves. */
export function maintenance(profile: Profile, kg: number | null): number | null {
  const rest = bmr(profile, kg);
  if (rest === null) return null;
  return Math.round(rest * ACTIVITY_FACTOR[profile.activity ?? 'light']);
}

export interface CalorieTarget {
  readonly kcal: number;
  readonly maintenance: number;
  readonly deficit: number;
  /** Set when the deficit was trimmed to keep the target off the floor. */
  readonly capped: boolean;
}

/**
 * The daily target.
 *
 * A 20% deficit lands inside the 0.5–1 kg per week corridor for most people
 * and keeps the plan edible. It is never allowed below resting metabolism:
 * eating under your own BMR for weeks is how people lose muscle and stall,
 * and no tracker should quietly recommend it.
 */
export function calorieTarget(profile: Profile, kg: number | null): CalorieTarget | null {
  const total = maintenance(profile, kg);
  if (total === null) return null;
  if (profile.goal !== 'lose') return { kcal: total, maintenance: total, deficit: 0, capped: false };

  const rest = bmr(profile, kg) ?? Math.round(total / 1.375);
  const floor = Math.max(rest, profile.sex === 'female' ? 1200 : 1500);
  const wanted = Math.round(total * 0.8);
  const kcal = Math.max(floor, wanted);
  return { kcal, maintenance: total, deficit: total - kcal, capped: kcal > wanted };
}

export interface MacroTarget {
  readonly kcal: number;
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

/**
 * Protein is set per kilogram of the weight being aimed at, not the current
 * one: 1.6 g/kg is the figure the muscle-retention literature converges on,
 * and anchoring it to a high starting weight would ask for portions nobody
 * eats. Fat holds 28% of the calories, enough for hormones and for food that
 * tastes of something, and carbohydrate takes what is left.
 */
export function macroTarget(profile: Profile, kg: number | null, kcal: number): MacroTarget {
  const anchor = profile.goalKg ?? kg ?? profile.startKg ?? 70;
  const protein = Math.round(Math.min(220, Math.max(60, anchor * 1.6)));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}

/** The target in force: the person's own number when they set one. */
export function dailyTarget(state: AppState, kg: number | null): MacroTarget | null {
  const computed = calorieTarget(state.profile, kg);
  const kcal = state.calorieGoal ?? computed?.kcal ?? null;
  if (kcal === null) return null;
  return macroTarget(state.profile, kg, kcal);
}

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
  };
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    fat: Math.round(m.fat),
    carbs: Math.round(m.carbs),
    fiber: Math.round(m.fiber * 10) / 10,
  };
}

/** Scales a per-100-g composition to the portion actually eaten. */
export function forGrams(per100g: Macros, grams: number): Macros {
  const k = grams / 100;
  return roundMacros({
    kcal: per100g.kcal * k,
    protein: per100g.protein * k,
    fat: per100g.fat * k,
    carbs: per100g.carbs * k,
    fiber: per100g.fiber * k,
  });
}

export function entriesOn(state: AppState, date: string): readonly FoodEntry[] {
  return state.meals.filter((entry) => entry.date === date).sort((a, b) => a.at - b.at);
}

export function totalFor(entries: readonly FoodEntry[]): Macros {
  return roundMacros(entries.reduce((sum, entry) => addMacros(sum, entry.macros), EMPTY_MACROS));
}

export function bySlot(entries: readonly FoodEntry[], slot: MealSlot): readonly FoodEntry[] {
  return entries.filter((entry) => entry.slot === slot);
}

/**
 * Was this moment inside a fast?
 *
 * The diary and the timer are the same app, so an entry that lands inside a
 * window the person was holding is worth marking — quietly, as a fact, not
 * as a scolding. Nothing is blocked and nothing is hidden.
 */
export function duringFast(state: AppState, at: number): boolean {
  const running = state.current;
  if (running && running.endedAt === null && at >= running.startedAt) return true;
  return state.history.some(
    (session) => session.endedAt !== null && at >= session.startedAt && at <= session.endedAt,
  );
}

/** The slot a meal logged right now most likely belongs to. */
export function slotForHour(hour: number): MealSlot {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 22) return 'dinner';
  return 'snack';
}
