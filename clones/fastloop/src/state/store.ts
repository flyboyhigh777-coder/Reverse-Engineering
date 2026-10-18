import { useSyncExternalStore } from 'react';
import { isoDate, startFast, moveStart, retarget, HOUR_MS } from '../domain/fasting';
import { waterTargetMl } from '../domain/metrics';
import { bmi } from '../domain/metrics';
import { resolvePlan } from '../domain/plans';
import { buildProfile } from '../domain/profile';
import { recommend } from '../domain/recommendation';
import { planIdForDay } from '../domain/schedule';
import { screen } from '../domain/screening';
import type { Activity, AppState, Experience, FastSession, Goal, PlanId, Profile, StepSource, Units } from '../domain/types';
import type { Wellbeing } from '../domain/wellbeing';
import type { ThemePreference } from './theme';
import * as storage from './storage';

const DAY_MS = 86_400_000;

const EMPTY_PROFILE: Profile = {
  name: '',
  sex: null,
  age: null,
  heightCm: null,
  startKg: null,
  goalKg: null,
  goal: null,
  activity: null,
  experience: null,
  units: 'metric',
  event: null,
  eventDate: null,
  reminders: true,
  theme: 'auto',
};

function initialState(): AppState {
  return {
    version: 1,
    stage: 'quiz',
    premium: true,
    proGranted: true,
    profile: EMPTY_PROFILE,
    planId: '16:8',
    person: null,
    screening: null,
    recommendation: null,
    observationMode: false,
    pendingRatingId: null,
    customFastHours: 16,
    schedule: {},
    scheduleEnabled: false,
    current: null,
    history: [],
    weights: [],
    days: [],
    answers: {},
  };
}

/**
 * A short, obviously-labelled sample history so the progress screen shows
 * what it does before the user has logged anything. Cleared from Profile.
 */
export function demoState(now: number): AppState {
  const base = initialState();
  const history = [6, 5, 4, 3, 2, 1].map((daysAgo, index) => {
    const startedAt = now - daysAgo * DAY_MS - 2 * HOUR_MS;
    const hours = [16.2, 15.1, 16.6, 13.4, 17.0, 16.4][index];
    return {
      id: `demo-${daysAgo}`,
      startedAt,
      targetEndAt: startedAt + 16 * HOUR_MS,
      endedAt: startedAt + hours * HOUR_MS,
      planId: '16:8' as PlanId,
    };
  });
  const weights = [7, 5, 3, 1, 0].map((daysAgo, index) => ({
    date: isoDate(now - daysAgo * DAY_MS),
    kg: [79.4, 79.0, 78.5, 78.3, 77.9][index],
  }));
  return {
    ...base,
    stage: 'app',
    history,
    weights,
    days: [
      { date: isoDate(now - DAY_MS), waterMl: 1750, steps: 7420, stepSource: 'manual' },
      { date: isoDate(now), waterMl: 750, steps: 3180, stepSource: 'manual' },
    ],
    profile: { ...base.profile, name: '', startKg: 79.4, goalKg: 70, heightCm: 172, age: 34, sex: 'female', goal: 'lose', activity: 'light', experience: 'tried' },
  };
}

/** Opens PRO once for state saved before this build; later opt-outs persist. */
function grantPro(loaded: AppState): AppState {
  return loaded.proGranted ? loaded : { ...loaded, premium: true, proGranted: true };
}

/** Fills fields added after a save was written, so older state keeps working. */
function normalize(loaded: AppState): AppState {
  const base = initialState();
  return {
    ...base,
    ...loaded,
    profile: { ...base.profile, ...loaded.profile },
    customFastHours: loaded.customFastHours ?? base.customFastHours,
    schedule: loaded.schedule ?? base.schedule,
    scheduleEnabled: loaded.scheduleEnabled ?? base.scheduleEnabled,
    days: (loaded.days ?? []).map((day) => ({ ...day, stepSource: day.stepSource ?? 'manual' })),
  };
}

let state: AppState = grantPro(normalize(storage.load() ?? initialState()));
storage.save(state);
const listeners = new Set<() => void>();

function set(next: AppState): void {
  state = next;
  storage.save(state);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getState(): AppState {
  return state;
}

function upsertDay(
  current: AppState,
  date: string,
  patch: { waterMl?: number; steps?: number; stepSource?: StepSource },
): AppState {
  const existing = current.days.find((d) => d.date === date) ?? {
    date,
    waterMl: 0,
    steps: 0,
    stepSource: 'manual' as StepSource,
  };
  const merged = { ...existing, ...patch };
  return { ...current, days: [...current.days.filter((d) => d.date !== date), merged] };
}

export const actions = {
  answer(id: string, value: string | readonly string[]): void {
    set({ ...state, answers: { ...state.answers, [id]: value } });
  },

  /** Turns raw quiz answers into the typed profile the app runs on. */
  finishQuiz(): void {
    const a = state.answers;
    const num = (key: string, fallback: number | null): number | null => {
      const raw = a[key];
      if (typeof raw !== 'string') return fallback;
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const str = (key: string): string | null => (typeof a[key] === 'string' ? (a[key] as string) : null);

    const units: Units = str('units') === 'imperial' ? 'imperial' : 'metric';
    const startKg = num('weight', null);
    const heightCm = num('height', null);
    const profile: Profile = {
      name: (str('name') ?? '').trim(),
      sex: (str('sex') as Profile['sex']) ?? null,
      age: num('age', null),
      heightCm,
      startKg,
      goalKg: num('goalWeight', null),
      goal: (str('goal') as Goal | null) ?? null,
      activity: (str('activity') as Activity | null) ?? null,
      experience: (str('experience') as Experience | null) ?? null,
      units,
      event: str('event'),
      eventDate: str('eventDate'),
      reminders: str('reminders') !== 'no',
      theme: state.profile.theme,
    };

    const person = buildProfile(a);
    const screening = screen(a, startKg && heightCm ? bmi(startKg, heightCm) : null);
    const recommendation = recommend(a, person, screening);
    const planId: PlanId = recommendation?.planId ?? '12:12';
    const customFastHours = recommendation?.target.fastHours ?? state.customFastHours;
    const weights = startKg ? [{ date: isoDate(Date.now()), kg: startKg }] : [];

    set({
      ...state,
      stage: 'analyzing',
      profile,
      person,
      screening,
      recommendation,
      observationMode: screening.blocked,
      planId,
      customFastHours,
      weights,
    });
  },

  setStage(stage: AppState['stage']): void {
    set({ ...state, stage });
  },

  /** Demo checkout: flips the local flag. No payment is taken anywhere. */
  unlockPremium(): void {
    set({ ...state, premium: true, proGranted: true, stage: 'app' });
  },

  /** Lets you drop back to the free tier to inspect what the original locks. */
  setPremium(premium: boolean): void {
    set({ ...state, premium, proGranted: true });
  },

  setPlan(planId: PlanId): void {
    const hours = resolvePlan(planId, state.customFastHours).fastHours;
    const current = state.current ? retarget(state.current, planId, hours) : null;
    set({ ...state, planId, current });
  },

  setCustomHours(hours: number): void {
    const customFastHours = Math.round(hours * 2) / 2;
    const next = { ...state, customFastHours };
    const current =
      state.current && state.current.planId === 'custom'
        ? retarget(state.current, 'custom', resolvePlan('custom', customFastHours).fastHours)
        : state.current;
    set({ ...next, current });
  },

  setScheduleDay(dayKey: string, planId: PlanId | null): void {
    const schedule = { ...state.schedule };
    if (planId === null) delete schedule[dayKey];
    else schedule[dayKey] = planId;
    set({ ...state, schedule });
  },

  setScheduleEnabled(scheduleEnabled: boolean): void {
    set({ ...state, scheduleEnabled });
  },

  startFast(at = Date.now()): void {
    if (state.current) return;
    const planId = planIdForDay(state, at);
    const hours = resolvePlan(planId, state.customFastHours).fastHours;
    set({ ...state, current: startFast(planId, hours, at) });
  },

  moveStart(startedAt: number): void {
    if (!state.current) return;
    set({ ...state, current: moveStart(state.current, startedAt) });
  },

  endFast(at = Date.now()): void {
    const current = state.current;
    if (!current) return;
    set({
      ...state,
      current: null,
      pendingRatingId: current.id,
      history: [...state.history, { ...current, endedAt: at }],
    });
  },

  rateFast(id: string, wellbeing: Wellbeing): void {
    set({
      ...state,
      pendingRatingId: state.pendingRatingId === id ? null : state.pendingRatingId,
      history: state.history.map((session) => (session.id === id ? { ...session, wellbeing } : session)),
    });
  },

  dismissRating(): void {
    set({ ...state, pendingRatingId: null });
  },

  /**
   * Record a fast that was never started in the app — the complaint users
   * raise most often about trackers in this category after billing.
   */
  addPastFast(startedAt: number, endedAt: number, planId: PlanId): void {
    if (!(endedAt > startedAt)) return;
    const session: FastSession = {
      id: `m_${startedAt.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      startedAt,
      targetEndAt: startedAt + resolvePlan(planId, state.customFastHours).fastHours * 3_600_000,
      endedAt,
      planId,
      edited: true,
    };
    set({ ...state, history: [...state.history, session] });
  },

  updateFast(id: string, startedAt: number, endedAt: number): void {
    if (!(endedAt > startedAt)) return;
    set({
      ...state,
      history: state.history.map((session) =>
        session.id === id
          ? { ...session, startedAt, endedAt, targetEndAt: startedAt + (session.targetEndAt - session.startedAt), edited: true }
          : session,
      ),
    });
  },

  deleteFast(id: string): void {
    set({
      ...state,
      pendingRatingId: state.pendingRatingId === id ? null : state.pendingRatingId,
      history: state.history.filter((session) => session.id !== id),
    });
  },

  cancelFast(): void {
    if (!state.current) return;
    set({ ...state, current: null });
  },

  addWeight(kg: number, date = isoDate(Date.now())): void {
    if (!(kg > 0)) return;
    const weights = [...state.weights.filter((w) => w.date !== date), { date, kg }];
    const profile = state.profile.startKg === null ? { ...state.profile, startKg: kg } : state.profile;
    set({ ...state, weights, profile });
  },

  setGoalWeight(kg: number): void {
    set({ ...state, profile: { ...state.profile, goalKg: kg > 0 ? kg : null } });
  },

  addWater(ml: number): void {
    const date = isoDate(Date.now());
    const today = state.days.find((d) => d.date === date);
    const target = waterTargetMl(state.profile.sex, state.profile.activity);
    const next = Math.max(0, Math.min(target * 2, (today?.waterMl ?? 0) + ml));
    set(upsertDay(state, date, { waterMl: next }));
  },

  setSteps(count: number, stepSource: StepSource = 'manual'): void {
    set(upsertDay(state, isoDate(Date.now()), { steps: Math.max(0, Math.round(count)), stepSource }));
  },

  /**
   * Counts from a sensor. A manual figure for today is never overwritten by a
   * smaller automatic one — the sensor usually starts counting mid-day.
   */
  reportSensorSteps(count: number, stepSource: StepSource): void {
    const date = isoDate(Date.now());
    const today = state.days.find((d) => d.date === date);
    const steps = Math.max(0, Math.round(count));
    if (today && today.stepSource === 'manual' && today.steps > steps) return;
    if (today && today.stepSource === stepSource && today.steps === steps) return;
    set(upsertDay(state, date, { steps, stepSource }));
  },

  setUnits(units: Units): void {
    set({ ...state, profile: { ...state.profile, units } });
  },

  setName(name: string): void {
    set({ ...state, profile: { ...state.profile, name } });
  },

  setReminders(reminders: boolean): void {
    set({ ...state, profile: { ...state.profile, reminders } });
  },

  setTheme(theme: ThemePreference): void {
    set({ ...state, profile: { ...state.profile, theme } });
  },

  loadDemo(): void {
    set(demoState(Date.now()));
  },

  reset(): void {
    storage.clear();
    set(initialState());
  },
};
