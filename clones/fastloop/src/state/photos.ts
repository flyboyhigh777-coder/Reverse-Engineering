import { useEffect, useSyncExternalStore } from 'react';
import { DISH_QUERIES } from '../domain/dishPhotos';
import { chooseCommonsFile } from '../domain/commonsPick';
import { netFetch } from './net';

/**
 * Photographs for the recipe cards, fetched from Wikimedia Commons.
 *
 * Only the chosen file's address and its credit are kept — never the image
 * bytes. A cached data URL for forty dishes would be most of a megabyte of
 * local storage holding something the WebView's own HTTP cache already has,
 * and it would push the real records closer to the quota for no gain.
 *
 * Why a dish ended with no photograph is kept too. From the card they look
 * the same, but a search that returned nothing needs a different query and a
 * search whose results were all rejected needs different tokens — without the
 * reason there is no way to tell which, and no way to tell either from a
 * machine that cannot reach the network.
 */

export interface DishPhoto {
  readonly url: string;
  /** Who took it. Shown on the card — the licences require it. */
  readonly author: string;
  readonly license: string;
  /** The file's page on Commons, so the credit can be checked. */
  readonly page: string;
}

type Reason = 'нет результатов' | 'ничего не подошло' | 'нет связи' | 'база ответила ошибкой' | 'нет запроса';

interface Entry {
  readonly photo: DishPhoto | null;
  readonly at: number;
  readonly reason?: Reason;
}

/** v2: the matching rules changed, so every v1 miss has to be looked up again. */
const CACHE = 'fastloop.dishPhotos.v2';
const ENABLED = 'fastloop.dishPhotos.enabled';
/** Short enough that a tightened query reaches the phone the same day. */
const MISS_TTL = 6 * 60 * 60 * 1000;
const API = 'https://commons.wikimedia.org/w/api.php';

/**
 * Wikimedia refuses anonymous clients outright, the way Open Food Facts did:
 * a request that arrives as the WebView's Java default gets a 403 and the
 * cards silently stay drawn. The policy asks for a name and a way to reach
 * whoever is behind it, so that is what is sent.
 */
const AGENT = 'FastLoop/0.19 (personal build; https://github.com/flyboyhigh777-coder/Reverse-Engineering)';
const HEADERS: Readonly<Record<string, string>> = {
  accept: 'application/json',
  'user-agent': AGENT,
  'api-user-agent': AGENT,
};

type Cache = Record<string, Entry>;

function readCache(): Cache {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Cache = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = value as Partial<Entry> | null;
      if (!entry || typeof entry !== 'object') continue;
      const at = Number(entry.at) || 0;
      const reason = typeof entry.reason === 'string' ? (entry.reason as Reason) : undefined;
      const photo = entry.photo;
      if (photo === null || photo === undefined) {
        out[id] = { photo: null, at, reason };
      } else if (typeof photo === 'object' && typeof (photo as DishPhoto).url === 'string') {
        const p = photo as DishPhoto;
        out[id] = {
          photo: { url: p.url, author: String(p.author ?? ''), license: String(p.license ?? ''), page: String(p.page ?? '') },
          at,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function readEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(ENABLED) !== 'off';
  } catch {
    return true;
  }
}

let cache: Cache = readCache();
let enabled = readEnabled();
const listeners = new Set<() => void>();
const inFlight = new Set<string>();
const queue: string[] = [];
/**
 * Five at a time. Two was slow enough that a scrolled grid of forty cards
 * took a minute to fill, which looked exactly like the lookup not working;
 * Commons serves this rate without complaint.
 */
const MAX_PARALLEL = 5;

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  try {
    globalThis.localStorage?.setItem(CACHE, JSON.stringify(cache));
  } catch {
    /* Quota or private mode — the lookups simply repeat next launch. */
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function photosEnabled(): boolean {
  return enabled;
}

export function setPhotosEnabled(on: boolean): void {
  enabled = on;
  try {
    globalThis.localStorage?.setItem(ENABLED, on ? 'on' : 'off');
  } catch {
    /* Nothing to do: the choice lasts the session. */
  }
  emit();
}

export function usePhotosEnabled(): boolean {
  return useSyncExternalStore(subscribe, photosEnabled, photosEnabled);
}

export interface PhotoStats {
  readonly total: number;
  readonly found: number;
  readonly missing: number;
  readonly pending: number;
  /** How many misses each reason accounts for, worst first. */
  readonly reasons: readonly (readonly [string, number])[];
}

function stats(): PhotoStats {
  const total = Object.keys(DISH_QUERIES).length;
  let found = 0;
  const reasons = new Map<string, number>();
  for (const id of Object.keys(DISH_QUERIES)) {
    const entry = cache[id];
    if (!entry) continue;
    if (entry.photo !== null) found += 1;
    else reasons.set(entry.reason ?? 'неизвестно', (reasons.get(entry.reason ?? 'неизвестно') ?? 0) + 1);
  }
  const missing = [...reasons.values()].reduce((a, b) => a + b, 0);
  return {
    total,
    found,
    missing,
    pending: total - found - missing,
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
  };
}

let snapshotStats = stats();
function refreshStats(): void {
  snapshotStats = stats();
}
const readStats = (): PhotoStats => snapshotStats;

export function usePhotoStats(): PhotoStats {
  return useSyncExternalStore(subscribe, readStats, readStats);
}

/** Drops everything known and starts over — the one repair the person has. */
export function forgetPhotos(): void {
  cache = {};
  queue.length = 0;
  try {
    globalThis.localStorage?.removeItem(CACHE);
  } catch {
    /* Already gone as far as this session is concerned. */
  }
  refreshStats();
  emit();
}

/** Looks up every dish that has no photograph yet, not only the visible ones. */
export function findAllPhotos(): void {
  if (!enabled) return;
  for (const id of Object.keys(DISH_QUERIES)) want(id, true);
}

function searchUrl(query: string): string {
  return (
    `${API}?action=query&format=json&formatversion=2&generator=search` +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    '&gsrnamespace=6&gsrlimit=20&prop=imageinfo' +
    '&iiprop=url%7Cextmetadata%7Cmime%7Csize&iiurlwidth=560' +
    '&iiextmetadatafilter=Artist%7CLicenseShortName%7CObjectName%7CImageDescription%7CCategories' +
    '&origin=*'
  );
}

async function search(query: string, must: readonly string[]): Promise<
  { readonly photo: DishPhoto } | { readonly reason: Reason }
> {
  let response;
  try {
    response = await netFetch(searchUrl(query), { headers: HEADERS });
  } catch {
    return { reason: 'нет связи' };
  }
  if (!response.ok) return { reason: 'база ответила ошибкой' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { reason: 'база ответила ошибкой' };
  }
  const chosen = chooseCommonsFile(payload, must);
  if ('failure' in chosen) return { reason: chosen.failure };
  return {
    photo: {
      url: chosen.file.thumb,
      author: chosen.file.author === '' ? 'Wikimedia Commons' : chosen.file.author,
      license: chosen.file.license === '' ? 'CC' : chosen.file.license,
      page: chosen.file.page,
    },
  };
}

async function lookup(id: string): Promise<void> {
  const query = DISH_QUERIES[id];
  if (!query) {
    cache = { ...cache, [id]: { photo: null, at: Date.now(), reason: 'нет запроса' } };
    refreshStats();
    emit();
    return;
  }

  let result = await search(query.q, query.must);
  // A precise query that finds nothing is the common failure on Commons,
  // where five words often match no file and two words match hundreds. One
  // broader retry costs a request and recovers most of them.
  if ('reason' in result && result.reason === 'нет результатов' && query.alt) {
    result = await search(query.alt, query.must);
  }

  cache = {
    ...cache,
    [id]: 'photo' in result ? { photo: result.photo, at: Date.now() } : { photo: null, at: Date.now(), reason: result.reason },
  };
  persist();
  refreshStats();
  emit();
}

function pump(): void {
  while (inFlight.size < MAX_PARALLEL) {
    const id = queue.shift();
    if (id === undefined) return;
    if (inFlight.has(id)) continue;
    inFlight.add(id);
    void lookup(id).finally(() => {
      inFlight.delete(id);
      pump();
    });
  }
}

/**
 * Asks for this dish's photograph.
 *
 * `force` is what the profile's button means: look again now, ignoring the
 * six hours a miss is normally remembered for. It still skips dishes that
 * already have a photograph — re-fetching those would spend the person's
 * data to replace a picture with itself.
 */
function want(id: string, force = false): void {
  if (!enabled) return;
  const entry = cache[id];
  if (entry?.photo) return;
  if (!force && entry && Date.now() - entry.at < MISS_TTL) return;
  if (inFlight.has(id) || queue.includes(id)) return;
  queue.push(id);
  pump();
}

function snapshot(id: string): DishPhoto | null {
  if (!enabled) return null;
  return cache[id]?.photo ?? null;
}

/** Subscribes to this dish's photograph, asking for one if none is known. */
export function useDishPhoto(id: string | null): DishPhoto | null {
  const on = usePhotosEnabled();
  const read = (): DishPhoto | null => (id === null ? null : snapshot(id));
  const photo = useSyncExternalStore(subscribe, read, read);
  useEffect(() => {
    if (id !== null && on) want(id);
  }, [id, on]);
  return photo;
}
