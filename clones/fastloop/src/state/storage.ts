import type { AppState } from '../domain/types';

const KEY = 'fastloop.state.v1';

/**
 * localStorage is per-browser and can throw (private windows, blocked site
 * data, preview frames). Every access is guarded and the app renders fine
 * when it comes back empty.
 */
export function load(): AppState | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const state = parsed as AppState;
    return state.version === 1 ? state : null;
  } catch {
    return null;
  }
}

export function save(state: AppState): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Storage unavailable — the session simply does not persist. */
  }
}

export function clear(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
