import { elapsedMs, isoDate, reachedGoal } from './fasting';
import type { AppState } from './types';

const HOUR_MS = 3_600_000;

function cell(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rows(lines: readonly (readonly (string | number)[])[]): string {
  return lines.map((line) => line.map(cell).join(';')).join('\n');
}

/**
 * One file with every record, semicolon-separated so Excel with a Russian
 * locale opens it in columns without an import step.
 */
export function buildCsv(state: AppState, now: number): string {
  const fasts = [...state.history]
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => [
      'голодание',
      new Date(s.startedAt).toISOString(),
      new Date(s.endedAt ?? s.startedAt).toISOString(),
      s.planId,
      (elapsedMs(s, now) / HOUR_MS).toFixed(2),
      reachedGoal(s) ? 'цель достигнута' : 'короче цели',
    ]);

  const weights = [...state.weights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ['вес', w.date, '', '', w.kg.toFixed(1), 'кг']);

  const days = [...state.days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((d) => [
      ['вода', d.date, '', '', String(d.waterMl), 'мл'],
      ['шаги', d.date, '', '', String(d.steps), d.stepSource],
    ]);

  return rows([
    ['тип', 'начало', 'конец', 'схема', 'значение', 'примечание'],
    ...fasts,
    ...weights,
    ...days,
  ]);
}

export function csvFileName(now: number): string {
  return `fastloop-${isoDate(now)}.csv`;
}
