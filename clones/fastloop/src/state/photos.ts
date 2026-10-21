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
 * A dish that has been looked up and found nothing is remembered as a miss,
 * so the same fruitless search is not repeated on every scroll; the miss
 * expires after a day in case Commons gained a better photograph.
 */

export interface DishPhoto {
  readonly url: string;
  /** Who took it. Shown on the card — the licences require it. */
  readonly author: string;
  readonly license: string;
  /** The file's page on Commons, so the credit can be checked. */
  readonly page: string;
}

interface Entry {
  readonly photo: DishPhoto | null;
  readonly at: number;
}

const CACHE = 'fastloop.dishPhotos.v1';
const ENABLED = 'fastloop.dishPhotos.enabled';
const MISS_TTL = 24 * 60 * 60 * 1000;
const API = 'https://commons.wikimedia.org/w/api.php';

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
      const photo = entry.photo;
      if (photo === null) {
        out[id] = { photo: null, at };
      } else if (photo && typeof photo === 'object' && typeof (photo as DishPhoto).url === 'string') {
        const p = photo as DishPhoto;
        out[id] = { photo: { url: p.url, author: String(p.author ?? ''), license: String(p.license ?? ''), page: String(p.page ?? '') }, at };
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
/** Two at a time: a scrolled grid would otherwise fire forty searches at once. */
const MAX_PARALLEL = 2;

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

export function forgetPhotos(): void {
  cache = {};
  try {
    globalThis.localStorage?.removeItem(CACHE);
  } catch {
    /* Already gone as far as this session is concerned. */
  }
  emit();
}

export function photoCount(): number {
  return Object.values(cache).filter((e) => e.photo !== null).length;
}

async function lookup(id: string): Promise<void> {
  const query = DISH_QUERIES[id];
  if (!query) {
    cache = { ...cache, [id]: { photo: null, at: Date.now() } };
    emit();
    return;
  }
  const url =
    `${API}?action=query&format=json&formatversion=2&generator=search` +
    `&gsrsearch=${encodeURIComponent(`${query.q} filetype:bitmap`)}` +
    '&gsrnamespace=6&gsrlimit=14&prop=imageinfo' +
    '&iiprop=url%7Cextmetadata%7Cmime%7Csize&iiurlwidth=560' +
    '&iiextmetadatafilter=Artist%7CLicenseShortName' +
    '&origin=*';
  let photo: DishPhoto | null = null;
  try {
    const response = await netFetch(url, { headers: { accept: 'application/json' } });
    if (response.ok) {
      const picked = chooseCommonsFile(await response.json(), query.must);
      if (picked) {
        photo = {
          url: picked.thumb,
          author: picked.author === '' ? 'Wikimedia Commons' : picked.author,
          license: picked.license === '' ? 'CC' : picked.license,
          page: picked.page,
        };
      }
    }
  } catch {
    /* Offline or refused: recorded as a miss and retried tomorrow. */
  }
  cache = { ...cache, [id]: { photo, at: Date.now() } };
  persist();
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

function want(id: string): void {
  if (!enabled) return;
  const entry = cache[id];
  if (entry && (entry.photo !== null || Date.now() - entry.at < MISS_TTL)) return;
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
