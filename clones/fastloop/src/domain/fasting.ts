import { planById } from './plans';
import type { FastSession, PlanId } from './types';

export const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startFast(planId: PlanId, now: number, startedAt = now): FastSession {
  return {
    id: newId(),
    startedAt,
    targetEndAt: startedAt + planById(planId).fastHours * HOUR_MS,
    endedAt: null,
    planId,
  };
}

/** Re-anchors a running fast to a new start time, keeping the plan length. */
export function moveStart(session: FastSession, startedAt: number): FastSession {
  return {
    ...session,
    startedAt,
    targetEndAt: startedAt + planById(session.planId).fastHours * HOUR_MS,
  };
}

export function elapsedMs(session: FastSession, now: number): number {
  return Math.max(0, (session.endedAt ?? now) - session.startedAt);
}

export function goalMs(session: FastSession): number {
  return Math.max(1, session.targetEndAt - session.startedAt);
}

/** 0 at the start, 1 at the goal. Can exceed 1 when a fast runs long. */
export function progress(session: FastSession, now: number): number {
  return elapsedMs(session, now) / goalMs(session);
}

export function remainingMs(session: FastSession, now: number): number {
  return Math.max(0, session.targetEndAt - (session.endedAt ?? now));
}

export function reachedGoal(session: FastSession): boolean {
  return session.endedAt !== null && session.endedAt >= session.targetEndAt;
}

/** "14:32:08" — hours are not wrapped at 24. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "14 ч 32 мин" for places where seconds would be noise. */
export function formatHoursShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDayClock(ts: number, now: number): string {
  const sameDay = isoDate(ts) === isoDate(now);
  const yesterday = isoDate(ts) === isoDate(now - DAY_MS);
  const time = formatClock(ts);
  if (sameDay) return `сегодня в ${time}`;
  if (yesterday) return `вчера в ${time}`;
  return `${new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${time}`;
}

/** Local-time ISO day key. Avoids toISOString(), which shifts to UTC. */
export function isoDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
