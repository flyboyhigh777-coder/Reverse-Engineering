/**
 * The last few attempts at reading a plate.
 *
 * This feature cannot be tested where it is built: the network policy here
 * denies every provider, so the only person who ever sees a real answer is
 * the one holding the phone. When they say «камера не работает», the app has
 * to be able to say what actually happened — which provider, which model,
 * what the server replied — instead of a sentence translated from an HTTP
 * status. The entries stay in memory only: they can carry fragments of a
 * server reply, and that is not something to leave on disk.
 */

export interface Attempt {
  readonly at: number;
  readonly provider: string;
  readonly model: string;
  readonly what: 'ключ' | 'фото' | 'описание';
  readonly ok: boolean;
  /** HTTP status, or 0 when the request never got a reply. */
  readonly status: number;
  /** The server's own words, trimmed — the part a translated message loses. */
  readonly detail: string;
}

const MAX = 6;
let attempts: Attempt[] = [];
const listeners = new Set<() => void>();

export function noteAttempt(attempt: Attempt): void {
  attempts = [attempt, ...attempts].slice(0, MAX);
  for (const listener of listeners) listener();
}

export function visionLog(): readonly Attempt[] {
  return attempts;
}

export function clearVisionLog(): void {
  attempts = [];
  for (const listener of listeners) listener();
}

export function subscribeVisionLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Enough for someone to paste into a message and for me to read. */
export function describeLog(entries: readonly Attempt[]): string {
  if (entries.length === 0) return 'Пока ни одной попытки.';
  return entries
    .map((entry) => {
      const time = new Date(entry.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const head = `${time} · ${entry.provider} · ${entry.what} · ${entry.ok ? 'ок' : `ошибка ${entry.status || 'без ответа'}`}`;
      const model = entry.model === '' ? '' : `\n  модель: ${entry.model}`;
      const detail = entry.detail === '' ? '' : `\n  ответ: ${entry.detail}`;
      return head + model + detail;
    })
    .join('\n');
}
