import { netFetch } from '../state/net';
import type { NetResponse } from '../state/net';
import type { Article, Category, Evidence } from './articles';
import { CATEGORIES } from './articles';
import type { DailyNote } from './daily';
import { RECIPE_CATEGORIES, RECIPE_TAGS, REGIONS } from './recipes';
import type { Macros, Recipe, RecipeCategory, RecipeTag, Region } from './recipes';

/**
 * Articles and recipes that arrive over the network.
 *
 * The app ships a library and can be handed more of one later, without a new
 * APK. The pack is read as untrusted boundary data: anything malformed is
 * dropped on its own rather than failing the whole file, because a single bad
 * entry should not cost the reader the other forty.
 *
 * Nothing here can change how the app behaves — only what it has to read.
 * There is no code in a pack and no field that reaches the timer, the
 * screening rules or the calorie maths.
 */

export interface ContentPack {
  readonly format: 1;
  /** Free text the app shows so the person can see what they pulled. */
  readonly updatedAt: string;
  readonly articles: readonly Article[];
  readonly recipes: readonly Recipe[];
  readonly notes: readonly DailyNote[];
}

export type PackResult =
  | { readonly kind: 'ok'; readonly pack: ContentPack; readonly dropped: number }
  | { readonly kind: 'error'; readonly reason: string };

const EVIDENCE: readonly Evidence[] = ['established', 'likely', 'contested', 'weak'];

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map(str).filter((item) => item !== '') : [];
}

function int(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function macros(value: unknown): Macros | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const kcal = int(raw.kcal, -1);
  if (kcal < 0) return null;
  return {
    kcal,
    protein: int(raw.protein, 0),
    fat: int(raw.fat, 0),
    carbs: int(raw.carbs, 0),
    fiber: Number(((typeof raw.fiber === 'number' ? raw.fiber : 0) || 0).toFixed(1)),
  };
}

function toArticle(value: unknown): Article | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = str(raw.id);
  const title = str(raw.title);
  const body = strings(raw.body);
  if (id === '' || title === '' || body.length === 0) return null;
  const category = CATEGORIES.includes(str(raw.category) as Category) ? (str(raw.category) as Category) : 'Основы';
  const evidence = EVIDENCE.includes(str(raw.evidence) as Evidence) ? (str(raw.evidence) as Evidence) : 'likely';
  return {
    id,
    category,
    title,
    minutes: Math.max(1, int(raw.minutes, 3)),
    lede: str(raw.lede),
    evidence,
    body,
    premium: raw.premium === true,
  };
}

function toRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = str(raw.id);
  const title = str(raw.title);
  const steps = strings(raw.steps);
  const ingredients = strings(raw.ingredients);
  const composition = macros(raw.macros);
  if (id === '' || title === '' || steps.length === 0 || ingredients.length === 0 || composition === null) return null;

  const category = RECIPE_CATEGORIES.includes(str(raw.category) as RecipeCategory)
    ? (str(raw.category) as RecipeCategory)
    : 'Основное';
  const tags = strings(raw.tags).filter((tag): tag is RecipeTag => RECIPE_TAGS.includes(tag as RecipeTag));
  const art = str(raw.art);
  const known = ['bowl', 'leaf', 'fish', 'egg', 'soup', 'grain', 'meat', 'berry', 'nuts', 'avocado'];
  // A region only counts when the app knows it; an unknown one would create
  // a cuisine tab with no way to reach it.
  const region = REGIONS.includes(str(raw.region) as Region) ? (str(raw.region) as Region) : undefined;

  return {
    id,
    title,
    category,
    minutes: Math.max(1, int(raw.minutes, 15)),
    servings: Math.max(1, int(raw.servings, 1)),
    macros: composition,
    tags,
    art: (known.includes(art) ? art : 'bowl') as Recipe['art'],
    why: str(raw.why),
    ingredients,
    steps,
    ...(region ? { region, adapted: str(raw.adapted) } : {}),
    premium: raw.premium === true,
  };
}

function toNote(value: unknown): DailyNote | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const text = str(raw.text);
  if (text === '') return null;
  return { text, source: str(raw.source) };
}

export function parsePack(payload: unknown): PackResult {
  if (!payload || typeof payload !== 'object') {
    return { kind: 'error', reason: 'Файл контента не похож на JSON-объект.' };
  }
  const raw = payload as Record<string, unknown>;
  if (int(raw.format, 0) !== 1) {
    return { kind: 'error', reason: 'Формат файла не поддерживается этой версией приложения.' };
  }

  const rawArticles = Array.isArray(raw.articles) ? raw.articles : [];
  const rawRecipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const rawNotes = Array.isArray(raw.notes) ? raw.notes : [];

  const articles = rawArticles.map(toArticle).filter((item): item is Article => item !== null);
  const recipes = rawRecipes.map(toRecipe).filter((item): item is Recipe => item !== null);
  const notes = rawNotes.map(toNote).filter((item): item is DailyNote => item !== null);
  const dropped =
    rawArticles.length - articles.length + (rawRecipes.length - recipes.length) + (rawNotes.length - notes.length);

  if (articles.length === 0 && recipes.length === 0 && notes.length === 0) {
    return { kind: 'error', reason: 'В файле нет ни одной читаемой записи.' };
  }
  return {
    kind: 'ok',
    pack: { format: 1, updatedAt: str(raw.updatedAt), articles, recipes, notes },
    dropped,
  };
}

export async function fetchPack(url: string, signal?: AbortSignal): Promise<PackResult> {
  if (url.trim() === '') return { kind: 'error', reason: 'Адрес обновлений не задан.' };
  // netFetch, not fetch: the Android build serves its page from file://,
  // which is an opaque origin, so a cross-origin fetch is refused before it
  // is sent. Everything else that touches the network was moved across when
  // that was found; this call was missed, and it is the one that makes
  // «Обновить сейчас» silently never work on a phone.
  let response: NetResponse;
  try {
    response = await netFetch(url, { signal, headers: { accept: 'application/json', 'cache-control': 'no-cache' } });
  } catch {
    return { kind: 'error', reason: 'Нет связи. Проверьте интернет на телефоне.' };
  }
  if (response.status === 404) {
    return { kind: 'error', reason: 'По этому адресу файла нет (404). Если репозиторий закрытый, ссылка не откроется без входа.' };
  }
  if (!response.ok) return { kind: 'error', reason: `Сервер ответил ошибкой ${response.status}.` };
  try {
    return parsePack(await response.json());
  } catch {
    return { kind: 'error', reason: 'Ответ не читается как JSON.' };
  }
}

/** Pack entries win on a shared id, so a built-in text can be corrected. */
export function merge<T extends { readonly id: string }>(builtIn: readonly T[], extra: readonly T[]): readonly T[] {
  if (extra.length === 0) return builtIn;
  const byId = new Map(builtIn.map((item) => [item.id, item] as const));
  for (const item of extra) byId.set(item.id, item);
  return [...byId.values()];
}
