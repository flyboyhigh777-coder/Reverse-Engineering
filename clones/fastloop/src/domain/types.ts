/** Core vocabulary shared by every layer. UI never invents these shapes. */

export type PlanId = '12:12' | '14:10' | '16:8' | '18:6' | '20:4' | '21:3' | '23:1';

export type Units = 'metric' | 'imperial';

/** A fast that is running, or one that has been closed out. */
export interface FastSession {
  readonly id: string;
  /** Epoch ms. */
  readonly startedAt: number;
  /** Epoch ms the user is aiming for. */
  readonly targetEndAt: number;
  /** Epoch ms when it was actually ended; null while running. */
  readonly endedAt: number | null;
  readonly planId: PlanId;
}

export interface WeightEntry {
  /** ISO date, YYYY-MM-DD — one entry per day, last write wins. */
  readonly date: string;
  /** Always stored in kg; display converts. */
  readonly kg: number;
}

export interface DayLog {
  readonly date: string;
  readonly waterMl: number;
  readonly steps: number;
}

export type Goal = 'lose' | 'maintain' | 'energy' | 'health' | 'clarity';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high';
export type Experience = 'none' | 'tried' | 'regular';

export interface Profile {
  readonly name: string;
  readonly sex: 'female' | 'male' | 'other' | null;
  readonly age: number | null;
  readonly heightCm: number | null;
  readonly startKg: number | null;
  readonly goalKg: number | null;
  readonly goal: Goal | null;
  readonly activity: Activity | null;
  readonly experience: Experience | null;
  readonly units: Units;
  /** Free-text motivating event from the quiz, e.g. "отпуск". */
  readonly event: string | null;
  /** ISO date of that event. */
  readonly eventDate: string | null;
  readonly reminders: boolean;
}

export type Phase = 'route' | 'quiz' | 'analyzing' | 'plan' | 'paywall' | 'app';

export interface AppState {
  readonly version: 1;
  readonly stage: Exclude<Phase, 'route'>;
  readonly premium: boolean;
  /** PRO is on by default in this build; the flag records that the one-time
   *  grant already ran, so turning PRO off in Profile is not undone on reload. */
  readonly proGranted: boolean;
  readonly profile: Profile;
  readonly planId: PlanId;
  readonly current: FastSession | null;
  readonly history: readonly FastSession[];
  readonly weights: readonly WeightEntry[];
  readonly days: readonly DayLog[];
  /** Quiz answers kept verbatim so the paywall can quote them back. */
  readonly answers: Readonly<Record<string, string | readonly string[]>>;
}
