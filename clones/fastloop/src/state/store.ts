import { useSyncExternalStore } from 'react';
import { isoDate, startFast, moveStart, HOUR_MS } from '../domain/fasting';
import { waterTargetMl } from '../domain/metrics';
import type { Activity, AppState, Experience, Goal, PlanId, Profile, Units } from '../domain/types';
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
};

function initialState(): AppState {
  return {
    version: 1,
    stage: 'quiz',
    premium: true,
    proGranted: true,
    profile: EMPTY_PROFILE,
    planId: '16:8',
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
      { date: isoDate(now - DAY_MS), waterMl: 1750, steps: 7420 },
      { date: isoDate(now), waterMl: 750, steps: 3180 },
    ],
    profile: { ...base.profile, name: '', startKg: 79.4, goalKg: 70, heightCm: 172, age: 34, sex: 'female', goal: 'lose', activity: 'light', experience: 'tried' },
  };
}

/** Opens PRO once for state saved before this build; later opt-outs persist. */
function grantPro(loaded: AppState): AppState {
  return loaded.proGranted ? loaded : { ...loaded, premium: true, proGranted: true };
}

let state: AppState = grantPro(storage.load() ?? initialState());
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

function upsertDay(current: AppState, date: string, patch: { waterMl?: number; steps?: number }): AppState {
  const existing = current.days.find((d) => d.date === date) ?? { date, waterMl: 0, steps: 0 };
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
    const profile: Profile = {
      name: (str('name') ?? '').trim(),
      sex: (str('sex') as Profile['sex']) ?? null,
      age: num('age', null),
      heightCm: num('height', null),
      startKg,
      goalKg: num('goalWeight', null),
      goal: (str('goal') as Goal | null) ?? null,
      activity: (str('activity') as Activity | null) ?? null,
      experience: (str('experience') as Experience | null) ?? null,
      units,
      event: str('event'),
      eventDate: str('eventDate'),
      reminders: str('reminders') !== 'no',
    };
    const planId: PlanId = profile.experience === 'regular' ? '16:8' : profile.experience === 'tried' ? '14:10' : '12:12';
    const weights = startKg ? [{ date: isoDate(Date.now()), kg: startKg }] : [];
    set({ ...state, stage: 'analyzing', profile, planId, weights });
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
    const current = state.current ? { ...state.current, planId } : null;
    const retimed = current ? moveStart({ ...current, planId }, current.startedAt) : null;
    set({ ...state, planId, current: retimed });
  },

  startFast(at = Date.now()): void {
    if (state.current) return;
    set({ ...state, current: startFast(state.planId, Date.now(), at) });
  },

  moveStart(startedAt: number): void {
    if (!state.current) return;
    set({ ...state, current: moveStart(state.current, startedAt) });
  },

  endFast(at = Date.now()): void {
    const current = state.current;
    if (!current) return;
    set({ ...state, current: null, history: [...state.history, { ...current, endedAt: at }] });
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
    const target = waterTargetMl(state.profile.startKg);
    const next = Math.max(0, Math.min(target * 2, (today?.waterMl ?? 0) + ml));
    set(upsertDay(state, date, { waterMl: next }));
  },

  addSteps(count: number): void {
    const date = isoDate(Date.now());
    const today = state.days.find((d) => d.date === date);
    set(upsertDay(state, date, { steps: Math.max(0, (today?.steps ?? 0) + count) }));
  },

  setSteps(count: number): void {
    set(upsertDay(state, isoDate(Date.now()), { steps: Math.max(0, Math.round(count)) }));
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

  loadDemo(): void {
    set(demoState(Date.now()));
  },

  reset(): void {
    storage.clear();
    set(initialState());
  },
};
