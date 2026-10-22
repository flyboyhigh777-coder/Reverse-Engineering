import { useSyncExternalStore } from 'react';
import { ARTICLES } from '../domain/articles';
import type { Article } from '../domain/articles';
import { NOTES } from '../domain/daily';
import type { DailyNote } from '../domain/daily';
import { RECIPES } from '../domain/recipes';
import type { Recipe } from '../domain/recipes';
import { fetchPack, merge, parsePack } from '../domain/contentPack';
import type { ContentPack } from '../domain/contentPack';

/**
 * The library, built-in plus whatever has been pulled from the network.
 *
 * Kept apart from AppState on purpose: this is cached content, not the
 * person's records. It must not swell the backup they paste into a note, and
 * losing it costs nothing — the next refresh brings it back, and the
 * built-in library works without it.
 */

const CACHE = 'fastloop.content.v1';

/**
 * Where updates come from by default: this project's own repository, on its
 * main branch. It used to point at the working branch of the session that
 * wrote it, which outlives nothing: once that branch is merged and deleted,
 * every installed build gets a 404 and a message blaming a private
 * repository.
 * Readable only while the repository is public; the UI says so when the
 * address answers 404, and the address can be changed to any other.
 */
export const DEFAULT_URL =
  'https://raw.githubusercontent.com/flyboyhigh777-coder/Reverse-Engineering/main/clones/fastloop/content/content.json';

export type Status = 'idle' | 'loading' | 'ok' | 'error';

export interface ContentState {
  readonly url: string;
  readonly articles: readonly Article[];
  readonly recipes: readonly Recipe[];
  readonly notes: readonly DailyNote[];
  /** How many of each came from the pack rather than the build. */
  readonly fromNetwork: number;
  readonly fetchedAt: number | null;
  readonly packUpdatedAt: string | null;
  readonly status: Status;
  readonly message: string | null;
}

interface Cached {
  readonly url: string;
  readonly fetchedAt: number;
  readonly pack: unknown;
}

function base(url: string): ContentState {
  return {
    url,
    articles: ARTICLES,
    recipes: RECIPES,
    notes: NOTES,
    fromNetwork: 0,
    fetchedAt: null,
    packUpdatedAt: null,
    status: 'idle',
    message: null,
  };
}

function applied(url: string, pack: ContentPack, fetchedAt: number, message: string | null): ContentState {
  return {
    url,
    articles: merge(ARTICLES, pack.articles),
    recipes: merge(RECIPES, pack.recipes),
    notes: pack.notes.length > 0 ? [...NOTES, ...pack.notes] : NOTES,
    fromNetwork: pack.articles.length + pack.recipes.length + pack.notes.length,
    fetchedAt,
    packUpdatedAt: pack.updatedAt === '' ? null : pack.updatedAt,
    status: 'ok',
    message,
  };
}

function readCache(): ContentState {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE);
    if (!raw) return base(DEFAULT_URL);
    const cached = JSON.parse(raw) as Cached;
    const url = typeof cached.url === 'string' && cached.url !== '' ? cached.url : DEFAULT_URL;
    const result = parsePack(cached.pack);
    if (result.kind !== 'ok') return base(url);
    return applied(url, result.pack, Number(cached.fetchedAt) || 0, null);
  } catch {
    return base(DEFAULT_URL);
  }
}

let state: ContentState = readCache();
const listeners = new Set<() => void>();

function set(next: ContentState): void {
  state = next;
  for (const listener of listeners) listener();
}

function writeCache(url: string, pack: ContentPack, fetchedAt: number): void {
  try {
    globalThis.localStorage?.setItem(CACHE, JSON.stringify({ url, fetchedAt, pack } satisfies Cached));
  } catch {
    /* Quota or private mode — the pack simply does not survive a restart. */
  }
}

export function getContent(): ContentState {
  return state;
}

export function useContent(): ContentState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getContent,
    getContent,
  );
}

export async function refreshContent(url = state.url): Promise<void> {
  set({ ...state, url, status: 'loading', message: null });
  const result = await fetchPack(url);
  const at = Date.now();
  if (result.kind === 'error') {
    set({ ...state, url, status: 'error', message: result.reason });
    return;
  }
  const dropped = result.dropped > 0 ? `Пропущено записей с ошибками: ${result.dropped}.` : null;
  writeCache(url, result.pack, at);
  set(applied(url, result.pack, at, dropped));
}

export function setContentUrl(url: string): void {
  set({ ...base(url.trim() === '' ? DEFAULT_URL : url.trim()), status: 'idle' });
  try {
    globalThis.localStorage?.removeItem(CACHE);
  } catch {
    /* ignore */
  }
}

const SIX_HOURS = 6 * 3_600_000;

/** Called once on start: refresh quietly if the cache is stale. */
export function refreshIfStale(): void {
  if (state.status === 'loading') return;
  if (state.fetchedAt !== null && Date.now() - state.fetchedAt < SIX_HOURS) return;
  void refreshContent();
}
