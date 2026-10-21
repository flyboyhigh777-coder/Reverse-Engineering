import { DEFAULT_PROVIDER } from '../domain/vision';
import type { ProviderId } from '../domain/vision';

/**
 * The API key lives on its own, outside the app state.
 *
 * Keeping it out of AppState means it cannot reach the backup sheet, the CSV
 * export or anything else that serialises the state — not because every one
 * of those remembered to strip it, but because it was never in there.
 */

/** v1 held a bare Anthropic key; v2 holds who it is for and which model. */
const LEGACY = 'fastloop.vision.key';
const KEY = 'fastloop.vision.v2';

export interface VisionAccess {
  readonly provider: ProviderId;
  readonly key: string;
  /** Chosen when the key was checked, because providers retire model names. */
  readonly model: string | null;
}

export function readVisionAccess(): VisionAccess | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisionAccess>;
      const key = typeof parsed.key === 'string' ? parsed.key.trim() : '';
      if (key === '') return null;
      return {
        provider: parsed.provider === 'anthropic' || parsed.provider === 'google' ? parsed.provider : DEFAULT_PROVIDER,
        key,
        model: typeof parsed.model === 'string' && parsed.model !== '' ? parsed.model : null,
      };
    }
    // Somebody who already pasted an Anthropic key keeps it.
    const legacy = globalThis.localStorage?.getItem(LEGACY);
    if (legacy && legacy.trim() !== '') return { provider: 'anthropic', key: legacy.trim(), model: null };
    return null;
  } catch {
    return null;
  }
}

export function writeVisionAccess(access: VisionAccess | null): void {
  try {
    if (access && access.key.trim() !== '') {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...access, key: access.key.trim() }));
    } else {
      globalThis.localStorage?.removeItem(KEY);
    }
    globalThis.localStorage?.removeItem(LEGACY);
  } catch {
    /* Storage unavailable — the key simply does not persist. */
  }
}

/** "sk-ant-…a1b2" — enough to recognise, not enough to use. */
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}
