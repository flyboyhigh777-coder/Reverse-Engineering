import type { Macros } from './recipes';

/**
 * Reading a plate from a photo.
 *
 * This is the one place the app talks to a network, and it stays switched
 * off until someone puts their own API key in. The photo is sent to
 * Anthropic, an answer comes back, and neither the photo nor the answer is
 * stored anywhere but in the entry the person then confirms. The app never
 * logs a guess by itself: a number nobody looked at is worse than no number.
 */

export const VISION_MODEL = 'claude-sonnet-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

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

const PROMPT = `Ты оцениваешь еду на фотографии для дневника питания.

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

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  return match ? { mediaType: match[1], base64: match[2] } : null;
}

/** Pulls the JSON object out of a reply that may still be wrapped in prose. */
function extractJson(text: string): unknown {
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

function toGuesses(parsed: unknown): readonly Guess[] {
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

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return 'Ключ не принят. Проверьте, что скопирован он целиком.';
  if (status === 429) return 'Слишком часто — лимит запросов. Попробуйте через минуту.';
  if (status === 400) return 'Запрос отклонён. Возможно, на ключе нет доступа к этой модели.';
  if (status === 402) return 'На счёте Anthropic нет средств — пополните баланс в консоли.';
  return `Сервер ответил ошибкой ${status}.`;
}

export type KeyCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * One tiny request, so the answer is yes or no before a photo is taken.
 *
 * A key that turns out to be wrong at the moment someone is holding a plate
 * is the worst time to find out, and the error a failed photo returns cannot
 * distinguish "bad key" from "bad picture".
 */
export async function checkKey(apiKey: string, signal?: AbortSignal): Promise<KeyCheck> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    });
  } catch {
    return { ok: false, reason: 'Нет связи с сервером. Проверьте интернет на телефоне.' };
  }
  return response.ok ? { ok: true } : { ok: false, reason: describeStatus(response.status) };
}

export async function recogniseFood(apiKey: string, dataUrl: string, signal?: AbortSignal): Promise<VisionResult> {
  const image = parseDataUrl(dataUrl);
  if (!image) return { kind: 'error', reason: 'Снимок не удалось прочитать.' };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Required for a request made straight from a page rather than a server.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 900,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    return { kind: 'error', reason: 'Не получилось связаться с сервером. Проверьте интернет.' };
  }

  if (!response.ok) return { kind: 'error', reason: describeStatus(response.status) };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { kind: 'error', reason: 'Ответ сервера не читается.' };
  }

  const content = (payload as { content?: unknown }).content;
  const text = Array.isArray(content)
    ? content
        .map((block) => (block && typeof block === 'object' ? (block as { text?: unknown }).text : null))
        .filter((value): value is string => typeof value === 'string')
        .join('\n')
    : '';
  const guesses = toGuesses(extractJson(text));
  if (guesses.length === 0) {
    return { kind: 'error', reason: 'На снимке не удалось разобрать еду. Снимите ближе и при свете или введите вручную.' };
  }
  return { kind: 'ok', guesses };
}

export const VISION_NOTE =
  'Оценка по фотографии — это оценка, а не взвешивание. Модель не видит, сколько масла ушло в сковороду и какой жирности было мясо, ' +
  'поэтому цифры стоит проверять глазами и править перед записью. Ближе к правде получается, когда в кадре видна вся тарелка и рядом есть ' +
  'предмет известного размера — вилка, ложка, стакан.';
