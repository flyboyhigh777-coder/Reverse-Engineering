/** Core vocabulary shared by every layer. UI never invents these shapes. */

export type PlanId = '12:12' | '14:10' | '16:8' | '18:6' | '20:4' | '21:3' | '23:1' | 'custom';

/** Where a day's step count came from. The UI never presents one as another. */
export type StepSource = 'native' | 'motion' | 'manual';

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
  /** Filled in after the fast, when the person rates it. */
  readonly wellbeing?: import('./wellbeing').Wellbeing;
  /** Set when the record was added or corrected by hand. */
  readonly edited?: boolean;
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
  readonly stepSource: StepSource;
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
  readonly theme: import('../state/theme').ThemePreference;
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
  /** Hours for the 'custom' plan. PRO. */
  readonly customFastHours: number;
  /** Per-weekday override, 0 = Sunday. PRO; empty object when unused. */
  readonly schedule: Readonly<Record<string, PlanId>>;
  readonly scheduleEnabled: boolean;
  readonly current: FastSession | null;
  /** Derived from the interview; null until the quiz is finished. */
  readonly person: import('./profile').PersonProfile | null;
  readonly screening: import('./screening').Screening | null;
  readonly recommendation: import('./recommendation').Recommendation | null;
  /** Screening said no plan: tracking stays, the fasting timer is put away. */
  readonly observationMode: boolean;
  /** The fast just finished, waiting to be rated. */
  readonly pendingRatingId: string | null;
  readonly history: readonly FastSession[];
  readonly weights: readonly WeightEntry[];
  readonly days: readonly DayLog[];
  /** Quiz answers kept verbatim so the paywall can quote them back. */
  readonly answers: Readonly<Record<string, string | readonly string[]>>;
}
