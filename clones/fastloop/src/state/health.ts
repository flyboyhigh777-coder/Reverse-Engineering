import type { SleepEntry } from '../domain/types';

/**
 * Sleep, read out of Health Connect by the Android host.
 *
 * The watch never talks to this app. It talks to its own companion app,
 * which — once its owner turns the integration on — writes what it recorded
 * into Health Connect. So there is nothing to pair and nothing to log into
 * here: either the store has last night in it or it does not, and the only
 * useful thing this can do is say which.
 *
 * Absent in the browser and in the build without AndroidX, hence the
 * feature detection rather than an assumption.
 */

export type HealthStatus =
  /** No host, or a host built without Health Connect. */
  | 'absent'
  /** The phone has no Health Connect at all. */
  | 'unavailable'
  /** It has one, too old to talk to. */
  | 'needs_update'
  /** It is there and has not been allowed to be read. */
  | 'no_permission'
  | 'ready';

export interface WatchStage {
  readonly type: 'deep' | 'light' | 'rem' | 'awake' | 'asleep' | 'out_of_bed' | 'unknown';
  readonly start: number;
  readonly end: number;
}

export interface WatchNight {
  readonly start: number;
  readonly end: number;
  /** The app that wrote it, e.g. com.xiaomi.wearable. */
  readonly source: string;
  readonly stages: readonly WatchStage[];
}

interface Reply {
  readonly id: string;
  readonly nights?: readonly WatchNight[];
  readonly error?: string;
}

interface Host {
  status(): string;
  /** Empty when the screen opened; otherwise why it did not. */
  requestPermission(): string | void;
  read(id: string, from: string, to: string): void;
  /** "com.xiaomi.wearable|Mi Fitness", or empty if none is installed. */
  watchApp?(): string;
  openWatchApp?(): string;
  openHealthConnect?(): string;
}

/** The watch app found on the phone, by its own name. */
export function watchAppName(): string {
  try {
    const said = host()?.watchApp?.() ?? '';
    return said.includes('|') ? said.slice(said.indexOf('|') + 1) : '';
  } catch {
    return '';
  }
}

/**
 * Opens the watch's own app, or Health Connect, and says why it could not.
 *
 * There is nothing to connect to a watch app directly — none of them
 * exposes anything to a third party, and the road through Health Connect is
 * the only one there is. What this can do is open the place where that road
 * is switched on, which beats describing a menu whose wording moves between
 * versions of the app.
 */
export function openWatchApp(): string {
  try {
    return host()?.openWatchApp?.() ?? 'Эта сборка не умеет открывать приложение часов.';
  } catch (failure) {
    return failure instanceof Error ? failure.message : 'Не удалось открыть.';
  }
}

export function openHealthConnect(): string {
  try {
    return host()?.openHealthConnect?.() ?? 'Эта сборка не умеет открывать Health Connect.';
  } catch (failure) {
    return failure instanceof Error ? failure.message : 'Не удалось открыть.';
  }
}

declare global {
  interface Window {
    FastLoopHealth?: Host;
    __fastloopSleep?: (payload: string) => void;
  }
}

function host(): Host | null {
  const found = typeof window === 'undefined' ? undefined : window.FastLoopHealth;
  return found && typeof found.status === 'function' ? found : null;
}

export function healthStatus(): HealthStatus {
  const shell = host();
  if (!shell) return 'absent';
  try {
    const said = shell.status();
    return said === 'ready' || said === 'no_permission' || said === 'needs_update' || said === 'unavailable'
      ? said
      : 'absent';
  } catch {
    return 'absent';
  }
}

/**
 * Opens Health Connect's own permission screen, and says if it could not.
 *
 * Whether permission was granted is not knowable here — that answer goes to
 * Health Connect, and the status is re-read when its owner comes back. But
 * whether the screen opened at all is knowable, and was being swallowed: a
 * button that cannot open anything and says nothing is indistinguishable
 * from a button that is not wired up.
 */
export function askHealthPermission(): string {
  try {
    const said = host()?.requestPermission();
    return typeof said === 'string' ? said : '';
  } catch (failure) {
    return failure instanceof Error ? failure.message : 'Мост не ответил.';
  }
}

const pending = new Map<string, (reply: Reply) => void>();
let counter = 0;

function install(): void {
  if (typeof window === 'undefined' || window.__fastloopSleep) return;
  window.__fastloopSleep = (payload: string) => {
    let reply: Reply;
    try {
      reply = JSON.parse(payload) as Reply;
    } catch {
      return;
    }
    const settle = pending.get(reply.id);
    if (!settle) return;
    pending.delete(reply.id);
    settle(reply);
  };
}

/** A read that hangs would leave the button spinning for ever. */
const TIMEOUT_MS = 30_000;

export async function readWatchSleep(fromMs: number, toMs: number): Promise<readonly WatchNight[]> {
  const shell = host();
  if (!shell) throw new Error('Этот телефон или эта сборка без Health Connect.');
  install();
  counter += 1;
  const id = `s${counter}`;

  return new Promise<readonly WatchNight[]>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('Health Connect не ответил.'));
    }, TIMEOUT_MS);

    pending.set(id, (reply) => {
      window.clearTimeout(timer);
      if (reply.error !== undefined) reject(new Error(reply.error));
      else resolve(reply.nights ?? []);
    });

    try {
      shell.read(id, String(Math.round(fromMs)), String(Math.round(toMs)));
    } catch (failure) {
      window.clearTimeout(timer);
      pending.delete(id);
      reject(failure instanceof Error ? failure : new Error('Мост не ответил.'));
    }
  });
}

/** The morning a night belongs to: the date it ended on. */
function morningOf(endMs: number): string {
  const woke = new Date(endMs);
  const year = woke.getFullYear();
  const month = `${woke.getMonth() + 1}`.padStart(2, '0');
  const day = `${woke.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minutesIn(stages: readonly WatchStage[], type: WatchStage['type']): number {
  let total = 0;
  for (const stage of stages) {
    if (stage.type === type) total += Math.max(0, stage.end - stage.start);
  }
  return Math.round(total / 60_000);
}

/**
 * One night from the store becomes one entry.
 *
 * Stages are kept as null when the store has none rather than as zeroes: a
 * watch that reports only a span and a watch that measured no deep sleep at
 * all are different facts, and a zero would quietly claim the second.
 * `rested` is always null here — it is the one thing no watch can measure,
 * and it is left for its owner to fill in.
 */
export function toSleepEntry(night: WatchNight): SleepEntry {
  const measured = night.stages.some((stage) => stage.type === 'deep' || stage.type === 'light' || stage.type === 'rem');
  return {
    date: morningOf(night.end),
    asleepAt: night.start,
    wokeAt: night.end,
    deep: measured ? minutesIn(night.stages, 'deep') : null,
    light: measured ? minutesIn(night.stages, 'light') : null,
    rem: measured ? minutesIn(night.stages, 'rem') : null,
    awake: measured ? minutesIn(night.stages, 'awake') : null,
    rested: null,
    source: 'watch',
  };
}

/**
 * What the import would change, worked out before anything is written.
 *
 * A night already written by hand is not overwritten silently: somebody who
 * typed it in and rated how rested they felt should not lose that to a
 * sync. The watch fills what is missing and adds what is not there, and the
 * count of each is what the screen reports.
 */
export interface Merge {
  readonly added: readonly SleepEntry[];
  readonly updated: readonly SleepEntry[];
  readonly keptManual: number;
  readonly sources: readonly string[];
}

export function mergeNights(nights: readonly WatchNight[], existing: readonly SleepEntry[]): Merge {
  const byDate = new Map(existing.map((entry) => [entry.date, entry]));
  const added: SleepEntry[] = [];
  const updated: SleepEntry[] = [];
  let keptManual = 0;
  const sources = new Set<string>();

  for (const night of nights) {
    if (night.end <= night.start) continue;
    sources.add(night.source);
    const entry = toSleepEntry(night);
    const had = byDate.get(entry.date);
    if (!had) {
      added.push(entry);
      continue;
    }
    if (had.source === 'manual') {
      keptManual += 1;
      continue;
    }
    // Already from the watch: replace it, but keep a rating if one was added.
    updated.push(had.rested === null ? entry : { ...entry, rested: had.rested });
  }

  return { added, updated, keptManual, sources: [...sources].sort() };
}
