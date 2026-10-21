import { HOUR_MS, elapsedMs, isoDate } from '../domain/fasting';
import { stepsTarget, waterTargetMl, weightSeries } from '../domain/metrics';
import { dailyTarget, entriesOn, totalFor } from '../domain/nutrition';
import { activePlan } from '../domain/schedule';
import type { AppState } from '../domain/types';

/**
 * The summary the home-screen widgets draw from.
 *
 * Widgets live in the launcher's process and cannot read this app's storage,
 * so the only numbers they can show are the ones handed over here. Kept
 * deliberately small and already decided: the widget renders what the app
 * concluded rather than recomputing goals of its own and disagreeing with
 * the screen next to it.
 */

export interface WidgetState {
  readonly running: boolean;
  readonly targetEndAt: number;
  readonly plan: string;
  readonly planHours: number;
  readonly elapsedHours: number;
  readonly waterMl: number;
  readonly waterGoalMl: number;
  readonly steps: number;
  readonly stepGoal: number;
  readonly kcal: number;
  readonly kcalGoal: number;
}

export function widgetState(state: AppState, now: number): WidgetState {
  const plan = activePlan(state, now);
  const session = state.current;
  const today = state.days.find((day) => day.date === isoDate(now));
  const kg = weightSeries(state.weights).at(-1)?.kg ?? null;
  const target = dailyTarget(state, kg);

  return {
    running: session !== null,
    targetEndAt: session?.targetEndAt ?? 0,
    plan: state.observationMode ? 'FastLoop' : `Схема ${plan.title}`,
    planHours: plan.fastHours,
    elapsedHours: session ? elapsedMs(session, now) / HOUR_MS : 0,
    waterMl: today?.waterMl ?? 0,
    waterGoalMl: waterTargetMl(state.profile.sex, state.profile.activity),
    steps: today?.steps ?? 0,
    stepGoal: stepsTarget(state.profile.activity),
    kcal: totalFor(entriesOn(state, isoDate(now))).kcal,
    kcalGoal: target?.kcal ?? 0,
  };
}

/** No-op outside the Android shell, where there are no widgets to feed. */
export function publishWidgetState(state: AppState, now = Date.now()): void {
  const bridge = typeof window === 'undefined' ? undefined : window.FastLoopNative;
  if (!bridge || typeof bridge.publishWidgetState !== 'function') return;
  try {
    bridge.publishWidgetState(JSON.stringify(widgetState(state, now)));
  } catch {
    /* The host went away mid-call; the widgets keep their last values. */
  }
}
