import { netFetch } from '../state/net';
import type { Food } from './foods';
import type { Macros } from './recipes';

/**
 * Packaged products from Open Food Facts.
 *
 * The built-in table covers dishes — плов, щи, творог — which is what people
 * cook. It cannot cover the yoghurt of a particular brand in a particular
 * shop, and that is exactly what an open product database is for. Search by
 * name or look a barcode up directly.
 *
 * Every field is treated as missing until proven otherwise: this is
 * crowd-sourced data, and a product with no protein figure is common. A
 * product without calories is dropped rather than logged as zero.
 *
 * NOT verified against the live API from the build container, whose egress
 * proxy refuses that host. The parsing is defensive and every failure path
 * ends in a message rather than a crash, but the first real request will be
 * made from a phone.
 */

const HOST = 'https://world.openfoodfacts.org';
const BASE = `${HOST}/api/v2`;
const FIELDS = 'code,product_name,product_name_ru,generic_name_ru,brands,nutriments,quantity';

/**
 * Open Food Facts asks every client to identify itself and blocks traffic
 * that does not. Android's default is "Dalvik/2.1.0 (Linux; U; Android …)",
 * which is exactly the kind of anonymous request they refuse — the service
 * answered 503 to every search until this was set. Browsers forbid setting
 * this header and silently ignore it, which is fine: there the origin
 * already identifies the caller.
 */
const HEADERS: Readonly<Record<string, string>> = {
  accept: 'application/json',
  'user-agent': 'FastLoop/0.18 (personal build; https://github.com/flyboyhigh777-coder/Reverse-Engineering)',
};

export type OffResult =
  | { readonly kind: 'ok'; readonly foods: readonly Food[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly reason: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Calories per 100 g. Some records carry only kilojoules, some only the
 * energy field without a unit; kJ is converted rather than shown as a
 * nonsense calorie count four times too large.
 */
function kcalPer100g(nutriments: Record<string, unknown>): number | null {
  const direct = num(nutriments['energy-kcal_100g']);
  if (direct !== null && direct > 0) return direct;
  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments.energy_100g);
  if (kj !== null && kj > 0) return kj / 4.184;
  return null;
}

function macrosOf(nutriments: Record<string, unknown>): Macros | null {
  const kcal = kcalPer100g(nutriments);
  if (kcal === null || kcal <= 0 || kcal > 1000) return null;
  return {
    kcal: Math.round(kcal),
    protein: Math.round((num(nutriments.proteins_100g) ?? 0) * 10) / 10,
    fat: Math.round((num(nutriments.fat_100g) ?? 0) * 10) / 10,
    carbs: Math.round((num(nutriments.carbohydrates_100g) ?? 0) * 10) / 10,
    fiber: Math.round((num(nutriments.fiber_100g) ?? 0) * 10) / 10,
  };
}

/** "Простоквашино — Творог 5%, 180 г" from whichever fields are filled in. */
function nameOf(product: Record<string, unknown>): string {
  const name =
    text(product.product_name_ru) || text(product.product_name) || text(product.generic_name_ru);
  const brand = text(product.brands).split(',')[0].trim();
  if (name === '') return brand;
  return brand === '' || name.toLowerCase().includes(brand.toLowerCase()) ? name : `${brand} — ${name}`;
}

/**
 * The pack size, when the record states one in grams or millilitres.
 * "0,5 л" and "180 г" both become a portion worth offering; anything the
 * regex does not recognise is left out rather than guessed at.
 */
function packPortion(quantity: string): { label: string; grams: number } | null {
  // \b is ASCII-only in JavaScript, so it never matches after "г" and the
  // whole Russian half of the database would fall through. A lookahead for
  // the next letter does the job in both alphabets; longer units come first
  // in the alternation so "кг" is not read as "к" followed by "г".
  const match = /(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|мл|ml|г|g|л|l)(?![а-яёa-z])/i.exec(quantity);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2].toLowerCase();
  const litres = unit === 'кг' || unit === 'kg' || unit === 'л' || unit === 'l';
  const grams = litres ? value * 1000 : value;
  if (grams < 5 || grams > 5000) return null;
  return { label: `упаковка ${Math.round(grams)} г`, grams: Math.round(grams) };
}

function toFood(raw: unknown): Food | null {
  if (!raw || typeof raw !== 'object') return null;
  const product = raw as Record<string, unknown>;
  const nutriments = product.nutriments;
  if (!nutriments || typeof nutriments !== 'object') return null;
  const macros = macrosOf(nutriments as Record<string, unknown>);
  if (macros === null) return null;
  const name = nameOf(product);
  if (name === '') return null;

  const pack = packPortion(text(product.quantity));
  // A 100 g pack would otherwise appear twice under two names.
  const portions =
    pack && pack.grams !== 100 ? [{ label: '100 г', grams: 100 }, pack] : [{ label: '100 г', grams: 100 }];

  return {
    id: `off-${text(product.code) || name}`,
    name,
    group: 'Готовые блюда',
    per100g: macros,
    portions,
  };
}

interface Failure {
  readonly error: string;
  /** The service is up but refusing right now; another route may work. */
  readonly retryable: boolean;
}

async function request(url: string, signal?: AbortSignal): Promise<unknown | Failure> {
  let response: Awaited<ReturnType<typeof netFetch>>;
  try {
    response = await netFetch(url, { signal, headers: HEADERS });
  } catch {
    return { error: 'Нет связи с базой продуктов. Проверьте интернет.', retryable: false };
  }
  if (response.status === 404) return { error: 'Такого штрихкода в базе нет.', retryable: false };
  if (response.status >= 500) {
    return { error: 'База сейчас перегружена и отвечает отказом.', retryable: true };
  }
  if (!response.ok) return { error: `База ответила ошибкой ${response.status}.`, retryable: false };
  try {
    return await response.json();
  } catch {
    return { error: 'Ответ базы не читается.', retryable: false };
  }
}

function failed(value: unknown): value is Failure {
  return Boolean(value) && typeof value === 'object' && typeof (value as { error?: unknown }).error === 'string';
}

export async function searchOnline(query: string, signal?: AbortSignal): Promise<OffResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { kind: 'empty' };
  const term = encodeURIComponent(trimmed);

  // The v2 search is the newer route and the first to shed load. The old CGI
  // one is slower but stays up when v2 is returning 503, so it is worth one
  // attempt before telling someone their search failed.
  let payload = await request(`${BASE}/search?search_terms=${term}&fields=${FIELDS}&page_size=20&lc=ru`, signal);
  if (failed(payload) && payload.retryable) {
    payload = await request(
      `${HOST}/cgi/search.pl?search_terms=${term}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}&lc=ru`,
      signal,
    );
  }
  if (failed(payload)) return { kind: 'error', reason: payload.error };

  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return { kind: 'error', reason: 'База вернула неожиданный ответ.' };
  const foods = products.map(toFood).filter((item): item is Food => item !== null);
  return foods.length === 0 ? { kind: 'empty' } : { kind: 'ok', foods };
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<OffResult> {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 8) return { kind: 'error', reason: 'Штрихкод — это 8–13 цифр.' };
  let payload = await request(`${BASE}/product/${digits}.json?fields=${FIELDS}`, signal);
  if (failed(payload) && payload.retryable) {
    payload = await request(`${HOST}/api/v0/product/${digits}.json`, signal);
  }
  if (failed(payload)) return { kind: 'error', reason: payload.error };

  const box = payload as { status?: unknown; product?: unknown };
  if (box.status === 0) return { kind: 'empty' };
  const item = toFood(box.product);
  if (item === null) {
    return { kind: 'error', reason: 'Продукт найден, но калорийность в базе не указана — запишите вручную.' };
  }
  return { kind: 'ok', foods: [item] };
}

export const OFF_NOTE =
  'Данные берутся из Open Food Facts — открытой базы, которую наполняют сами покупатели. Состав указан производителем ' +
  'на упаковке, но записи бывают неполными и устаревшими. Если цифра выглядит странно, доверяйте этикетке в руках. ' +
  'База бесплатная и живёт на пожертвования, поэтому иногда отвечает отказом — тогда помогает повтор через минуту.';
