import { resolvePlan } from './plans';
import type { Plan } from './plans';
import type { AppState, PlanId } from './types';

/**
 * Which window applies on a given day.
 *
 * The weekday schedule answers the complaint the quiz collects most often —
 * "срывы по выходным" — by letting the weekend run a shorter window instead
 * of breaking the streak. Off by default; PRO.
 */
export function planIdForDay(state: AppState, at: number): PlanId {
  if (!state.scheduleEnabled || !state.premium) return state.planId;
  return state.schedule[String(new Date(at).getDay())] ?? state.planId;
}

export function activePlan(state: AppState, at: number): Plan {
  return resolvePlan(planIdForDay(state, at), state.customFastHours);
}
