import { HOUR_MS, isoDate } from './fasting';
import { planById } from './plans';
import type { AppState, DayLog, FastSession, PlanId, StepSource, WeightEntry } from './types';

/**
 * Carrying records between installs.
 *
 * Android wipes an app's storage when it is uninstalled, and a sideloaded
 * build has no account to sync with. So the app can hand its records out as
 * text and take them back: a full JSON backup, and — because older builds
 * could only produce the CSV export — the CSV as well.
 */

export interface Records {
  readonly history: readonly FastSession[];
  readonly weights: readonly WeightEntry[];
  readonly days: readonly DayLog[];
}

export type Restore =
  | { readonly kind: 'backup'; readonly state: AppState; readonly savedAt: string | null }
  | { readonly kind: 'records'; readonly records: Records }
  | { readonly kind: 'error'; readonly reason: string };

const MARKER = 'fastloop-backup';

export function buildBackup(state: AppState, now: number): string {
  return JSON.stringify({ app: MARKER, format: 1, savedAt: new Date(now).toISOString(), state }, null, 1);
}

export function backupFileName(now: number): string {
  return `fastloop-backup-${isoDate(now)}.json`;
}

/** Reads either format and says what it found, or why it could not. */
export function parseRestore(text: string): Restore {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'error', reason: 'Пусто — вставьте текст резервной копии или экспорта CSV.' };
  if (trimmed.startsWith('{')) return parseBackup(trimmed);
  return parseCsv(trimmed);
}

function parseBackup(text: string): Restore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'error', reason: 'Это не похоже на резервную копию: JSON не читается.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'error', reason: 'Это не похоже на резервную копию.' };
  }
  const box = parsed as { app?: unknown; state?: unknown; savedAt?: unknown };
  if (box.app !== MARKER || !box.state || typeof box.state !== 'object') {
    return { kind: 'error', reason: 'Это JSON, но не копия FastLoop.' };
  }
  const state = box.state as AppState;
  if (state.version !== 1 || !Array.isArray(state.history)) {
    return { kind: 'error', reason: 'Копия сделана несовместимой версией приложения.' };
  }
  return { kind: 'backup', state, savedAt: typeof box.savedAt === 'string' ? box.savedAt : null };
}

/* ───────────────────────────────── CSV ─────────────────────────────────── */

/** Semicolon-separated, RFC 4180 quoting — the same shape the export writes. */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function newId(prefix: string, seed: string): string {
  return `${prefix}-${seed}`;
}

/**
 * The export drops the target time, keeping only whether the goal was met.
 * The target is rebuilt from the plan and then nudged to agree with that
 * note, so a restored fast keeps the verdict it was exported with.
 */
function rebuildTarget(startedAt: number, endedAt: number, planId: PlanId, metGoal: boolean): number {
  const hours = planById(planId).fastHours;
  let target = startedAt + hours * HOUR_MS;
  if (metGoal && target > endedAt) target = endedAt;
  if (!metGoal && target <= endedAt) target = endedAt + 60_000;
  return target;
}

function parseCsv(text: string): Restore {
  const rows = parseRows(text);
  if (rows.length === 0) return { kind: 'error', reason: 'Файл пуст.' };
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  if (header[0] !== 'тип') {
    return { kind: 'error', reason: 'Не узнаю формат: в первой строке ожидается заголовок экспорта FastLoop.' };
  }

  const history: FastSession[] = [];
  const weights: WeightEntry[] = [];
  const dayMap = new Map<string, { waterMl: number; steps: number; stepSource: StepSource }>();
  let skipped = 0;

  const dayOf = (date: string) => {
    const existing = dayMap.get(date);
    if (existing) return existing;
    const fresh = { waterMl: 0, steps: 0, stepSource: 'manual' as StepSource };
    dayMap.set(date, fresh);
    return fresh;
  };

  for (const row of rows.slice(1)) {
    const [kind, from, to, plan, value, note] = row.map((cell) => (cell ?? '').trim());
    if (kind === '') continue;

    if (kind === 'голодание') {
      const startedAt = Date.parse(from);
      const endedAt = Date.parse(to);
      if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) {
        skipped += 1;
        continue;
      }
      const planId = (plan || '16:8') as PlanId;
      history.push({
        id: newId('csv', String(startedAt)),
        startedAt,
        targetEndAt: rebuildTarget(startedAt, endedAt, planId, note.startsWith('цель')),
        endedAt,
        planId,
      });
      continue;
    }

    const amount = Number.parseFloat(value.replace(',', '.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(amount)) {
      skipped += 1;
      continue;
    }
    if (kind === 'вес') weights.push({ date: from, kg: amount });
    else if (kind === 'вода') dayOf(from).waterMl = Math.round(amount);
    else if (kind === 'шаги') {
      const day = dayOf(from);
      day.steps = Math.round(amount);
      day.stepSource = note === 'native' || note === 'motion' ? note : 'manual';
    } else skipped += 1;
  }

  const days: DayLog[] = [...dayMap.entries()].map(([date, day]) => ({ date, ...day }));

  if (history.length === 0 && weights.length === 0 && days.length === 0) {
    return {
      kind: 'error',
      reason: skipped > 0 ? 'Строки прочитаны, но ни одной записи распознать не удалось.' : 'В файле нет записей.',
    };
  }
  return { kind: 'records', records: { history, weights, days } };
}

export function describeRecords(records: Records): string {
  const parts: string[] = [];
  if (records.history.length > 0) parts.push(`голоданий: ${records.history.length}`);
  if (records.weights.length > 0) parts.push(`записей веса: ${records.weights.length}`);
  if (records.days.length > 0) parts.push(`дней с водой и шагами: ${records.days.length}`);
  return parts.join(', ');
}
