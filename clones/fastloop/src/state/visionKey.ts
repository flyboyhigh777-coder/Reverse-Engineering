/**
 * The API key lives on its own, outside the app state.
 *
 * Keeping it out of AppState means it cannot reach the backup sheet, the CSV
 * export or anything else that serialises the state — not because every one
 * of those remembered to strip it, but because it was never in there.
 */

const KEY = 'fastloop.vision.key';

export function readVisionKey(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw && raw.trim() !== '' ? raw : null;
  } catch {
    return null;
  }
}

export function writeVisionKey(key: string | null): void {
  try {
    if (key && key.trim() !== '') globalThis.localStorage?.setItem(KEY, key.trim());
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* Storage unavailable — the key simply does not persist. */
  }
}

/** "sk-ant-…a1b2" — enough to recognise, not enough to use. */
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}
