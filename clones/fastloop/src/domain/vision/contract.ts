import type { Macros } from '../recipes';

/**
 * Reading a plate, independent of who does the reading.
 *
 * Everything here is true of any model that can look at a photograph and
 * answer in JSON: the prompts, the shape of an answer, and the work of
 * turning a reply that may still be wrapped in prose into numbers. What
 * changes between providers is the endpoint, the envelope and the words
 * their errors come back in, and that lives in the adapters.
 *
 * The split exists because the feature was unreachable, not because it was
 * untidy: the only provider on offer wanted a key with money behind it, and
 * most people will not do that for a food diary.
 */

export interface Guess {
  readonly name: string;
  /** Estimated portion on the plate. */
  readonly grams: number;
  readonly macros: Macros;
  /** What the model saw and what it had to assume. */
  readonly note: string;
  readonly confidence: 'high' | 'medium' | 'low';
}

export type VisionResult =
  | { readonly kind: 'ok'; readonly guesses: readonly Guess[] }
  | { readonly kind: 'error'; readonly reason: string };

/**
 * A key that works, and the model it will be used with.
 *
 * The model comes back from the check because providers retire names on
 * their own schedule: asking which ones exist beats hard-coding one that
 * quietly stops answering six months from now.
 */
export type KeyCheck =
  | { readonly ok: true; readonly model?: string }
  | { readonly ok: false; readonly reason: string };

export type ProviderId = 'google' | 'anthropic';

export interface VisionProvider {
  readonly id: ProviderId;
  readonly title: string;
  /** What the key looks like, for the field's placeholder. */
  readonly keyHint: string;
  /** Whether a key can be had without giving anyone a card. */
  readonly free: boolean;
  /** Where to get a key, in one line. */
  readonly where: string;
  /** What it costs, honestly. */
  readonly cost: string;
  /** The default model; a check may replace it with one the key can reach. */
  readonly model: string;
  check(apiKey: string, signal?: AbortSignal): Promise<KeyCheck>;
  describe(apiKey: string, model: string, text: string, signal?: AbortSignal): Promise<VisionResult>;
  recognise(apiKey: string, model: string, dataUrl: string, signal?: AbortSignal): Promise<VisionResult>;
}

export const TEXT_PROMPT = `Ты оцениваешь по описанию, что человек съел, для дневника питания.

Верни ТОЛЬКО JSON, без markdown и без пояснений вокруг, в таком виде:
{"items":[{"name":"","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"note":"","confidence":"high|medium|low"}]}

Правила:
- Если человек перечислил состав одного блюда, верни ОДНУ запись с названием блюда целиком, а не отдельные записи на каждый ингредиент.
- Если перечислены разные блюда или продукты, которые едят отдельно, верни запись на каждое.
- name — по-русски, коротко, как назвал бы человек. Если блюдо названо, используй это название.
- grams — оценка веса готовой порции целиком, в граммах.
- Значения kcal, protein, fat, carbs, fiber — для всей порции, НЕ на 100 г.
- Когда количество не указано, бери обычную домашнюю порцию и скажи об этом в note.
- note — одной фразой: какие допущения сделаны (например «масло взято 1 ст. л.», «порция принята за 300 г»).
- confidence — low, если состав или количество по описанию понять трудно.
- Если в тексте нет еды, верни {"items":[]}.`;

export const PHOTO_PROMPT = `Ты оцениваешь еду на фотографии для дневника питания.

Верни ТОЛЬКО JSON, без markdown и без пояснений вокруг, в таком виде:
{"items":[{"name":"","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"note":"","confidence":"high|medium|low"}]}

Правила:
- Отдельная запись на каждое блюдо или продукт, которые логично считать отдельно. Если это одно блюдо (например плов), не разбивай его на крупу, мясо и морковь.
- grams — оценка веса порции на фото, в граммах. Опирайся на размер тарелки, приборов и других предметов рядом.
- Значения kcal, protein, fat, carbs, fiber — для указанной порции целиком, НЕ на 100 г.
- name — по-русски, коротко, как назвал бы человек.
- note — одной фразой: что именно ты видишь и какое допущение сделал (например «жирность мяса неизвестна, взята средняя»).
- confidence — low, если блюдо закрыто, снято под углом или состав непонятен.
- Если еды на фото нет, верни {"items":[]}.`;

export interface ImageData {
  readonly mediaType: string;
  readonly base64: string;
}

export function parseDataUrl(dataUrl: string): ImageData | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  return match ? { mediaType: match[1], base64: match[2] } : null;
}

/** Pulls the JSON object out of a reply that may still be wrapped in prose. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function toGuesses(parsed: unknown): readonly Guess[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((raw): Guess | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (name === '') return null;
      const confidence = item.confidence === 'high' || item.confidence === 'low' ? item.confidence : 'medium';
      return {
        name,
        grams: Math.round(num(item.grams)),
        macros: {
          kcal: Math.round(num(item.kcal)),
          protein: Math.round(num(item.protein)),
          fat: Math.round(num(item.fat)),
          carbs: Math.round(num(item.carbs)),
          fiber: Math.round(num(item.fiber) * 10) / 10,
        },
        note: typeof item.note === 'string' ? item.note : '',
        confidence,
      };
    })
    .filter((guess): guess is Guess => guess !== null);
}

/**
 * The same dish at a different weight.
 *
 * Portion size is where these estimates go wrong, and they go wrong in one
 * direction: measurements of this whole category of app find they read low,
 * and that someone who does not correct the portion eats noticeably more
 * than the screen says. So the number has to be adjustable before it is
 * written down, and the macros have to follow it rather than stay put.
 *
 * Scaling is always from the model's own figures, never from the previous
 * edit, so dragging a portion up and back down lands exactly where it began.
 */
export function scaleGuess(guess: Guess, grams: number): Guess {
  const target = Math.max(0, Math.round(grams));
  if (guess.grams <= 0 || target === guess.grams) return { ...guess, grams: target };
  const k = target / guess.grams;
  return {
    ...guess,
    grams: target,
    macros: {
      kcal: Math.round(guess.macros.kcal * k),
      protein: Math.round(guess.macros.protein * k),
      fat: Math.round(guess.macros.fat * k),
      carbs: Math.round(guess.macros.carbs * k),
      fiber: Math.round(guess.macros.fiber * k * 10) / 10,
    },
  };
}

export const NO_FOOD_IN_PHOTO =
  'На снимке не удалось разобрать еду. Снимите ближе и при свете или введите вручную.';
export const NO_FOOD_IN_TEXT =
  'Не удалось разобрать описание. Напишите подробнее — что за блюдо и примерно сколько.';
export const NO_NETWORK = 'Не получилось связаться с сервером. Проверьте интернет.';
export const UNREADABLE = 'Ответ сервера не читается.';

export const VISION_NOTE =
  'Оценка по фотографии — это оценка, а не взвешивание. Модель не видит, сколько масла ушло в сковороду и какой жирности было мясо, ' +
  'поэтому цифры стоит проверять глазами и править перед записью. Ближе к правде получается, когда в кадре видна вся тарелка и рядом есть ' +
  'предмет известного размера — вилка, ложка, стакан.';
