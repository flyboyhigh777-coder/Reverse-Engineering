import { netFetch } from '../../state/net';
import {
  NO_FOOD_IN_PHOTO,
  NO_FOOD_IN_TEXT,
  NO_NETWORK,
  TEXT_PROMPT,
  UNREADABLE,
  extractJson,
  parseDataUrl,
  photoPrompt,
  toGuesses,
} from './contract';
import type { KeyCheck, VisionProvider, VisionResult } from './contract';

/**
 * Google AI Studio. The reason this feature is reachable at all.
 *
 * A key is free to create and needs no card and no balance, which is the
 * whole point: the paid provider was a wall, not a preference. The free
 * quota is generous enough for a food diary and runs out loudly rather than
 * silently — a spent quota comes back as 429 with its own message.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
/** Used only until a key is checked and the real list comes back. */
const FALLBACK_MODEL = 'models/gemini-2.0-flash';

/** The shape of an answer, stated to the API rather than asked for in prose. */
const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fiber: { type: 'NUMBER' },
          note: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'fat', 'carbs', 'confidence'],
      },
    },
  },
  required: ['items'],
};

function headers(apiKey: string): Record<string, string> {
  // The key goes in a header rather than the query string, so it never ends
  // up in anything that logs a URL.
  return { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
}

function describeStatus(status: number): string {
  if (status === 400) return 'Ключ не принят. Проверьте, что скопирован он целиком.';
  if (status === 401 || status === 403) return 'Ключ отклонён. Возможно, он отключён или у него нет доступа к Gemini API.';
  if (status === 429) return 'Бесплатная квота на сегодня исчерпана. Попробуйте позже или введите блюдо вручную.';
  if (status === 404) return 'Модель недоступна для этого ключа. Нажмите «Сохранить и проверить» ещё раз — приложение выберет другую.';
  if (status === 503) return 'Сервис перегружен. Попробуйте через минуту.';
  return `Сервер ответил ошибкой ${status}.`;
}

/** Gemini answers in parts; only the text ones matter. */
function textOf(payload: unknown): string {
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (part && typeof part === 'object' ? (part as { text?: unknown }).text : null))
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

/**
 * Names that are not a general vision model, whatever they can otherwise do.
 * Matched as substrings of the model name.
 */
const NOT_FOR_US = [
  'embedding', 'aqa', 'imagen', 'veo', 'tts', 'image-generation', 'native-audio',
  'live-', 'learnlm', 'gemma', 'thinking',
];

/**
 * Scores a model name for this job.
 *
 * The list is asked for rather than hard-coded because providers retire
 * names on their own schedule, and a hard-coded one turns into a 404 months
 * later with no way for the person to tell what broke. Flash tiers are
 * preferred: they are what the free quota is generous with, and the task is
 * reading a plate rather than writing an essay.
 */
function score(name: string): number {
  const lower = name.toLowerCase();
  if (NOT_FOR_US.some((bad) => lower.includes(bad))) return -1;
  if (!lower.includes('gemini')) return -1;
  let points = 0;
  if (lower.includes('flash')) points += 100;
  if (lower.includes('lite')) points -= 30;
  if (lower.includes('preview') || lower.includes('-exp')) points -= 40;
  const version = /(\d+)\.(\d+)/.exec(lower);
  if (version) points += Number(version[1]) * 10 + Number(version[2]);
  return points;
}

interface ListedModel {
  readonly name: string;
  readonly methods: readonly string[];
}

function listed(payload: unknown): ListedModel[] {
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];
  const out: ListedModel[] = [];
  for (const raw of models) {
    if (!raw || typeof raw !== 'object') continue;
    const model = raw as { name?: unknown; supportedGenerationMethods?: unknown };
    const name = typeof model.name === 'string' ? model.name : '';
    if (name === '') continue;
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods.filter((m): m is string => typeof m === 'string')
      : [];
    out.push({ name, methods });
  }
  return out;
}

export function chooseModel(payload: unknown): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const model of listed(payload)) {
    if (!model.methods.includes('generateContent')) continue;
    const points = score(model.name);
    if (points > bestScore) {
      bestScore = points;
      best = model.name;
    }
  }
  return best;
}

async function ask(apiKey: string, model: string, parts: unknown[], signal?: AbortSignal): Promise<VisionResult | { readonly text: string }> {
  const path = model.startsWith('models/') ? model : `models/${model}`;
  let response: Awaited<ReturnType<typeof netFetch>>;
  try {
    response = await netFetch(`${BASE}/${path}:generateContent`, {
      method: 'POST',
      signal,
      headers: headers(apiKey),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          // 900 was not enough for a table with three dishes on it, and a
          // reply cut off at the limit is unparseable however good the
          // parser is — the person just saw "не удалось разобрать еду".
          maxOutputTokens: 2000,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: ANSWER_SCHEMA,
        },
      }),
    });
  } catch {
    return { kind: 'error', reason: NO_NETWORK };
  }
  if (!response.ok) return { kind: 'error', reason: describeStatus(response.status) };
  try {
    return { text: textOf(await response.json()) };
  } catch {
    return { kind: 'error', reason: UNREADABLE };
  }
}

export const google: VisionProvider = {
  id: 'google',
  title: 'Google AI Studio',
  keyHint: 'AIza…',
  free: true,
  where: 'aistudio.google.com → Get API key → Create API key. Нужен только аккаунт Google, карта не нужна.',
  cost: 'Бесплатно в пределах дневной квоты. Для дневника её хватает с запасом.',
  model: FALLBACK_MODEL,

  /**
   * Checks the key by asking which models it can reach, which answers two
   * questions in one request: whether the key works, and which model to use.
   */
  async check(apiKey, signal): Promise<KeyCheck> {
    let response: Awaited<ReturnType<typeof netFetch>>;
    try {
      response = await netFetch(`${BASE}/models`, { headers: headers(apiKey), signal });
    } catch {
      return { ok: false, reason: 'Нет связи с сервером. Проверьте интернет на телефоне.' };
    }
    if (!response.ok) return { ok: false, reason: describeStatus(response.status) };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, reason: UNREADABLE };
    }
    const model = chooseModel(payload);
    if (!model) {
      return { ok: false, reason: 'Ключ принят, но подходящей модели у него нет. Проверьте, включён ли Gemini API.' };
    }
    return { ok: true, model };
  },

  async describe(apiKey, model, text, signal) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return { kind: 'error', reason: 'Напишите, что вы ели.' };
    const answer = await ask(apiKey, model, [{ text: `${TEXT_PROMPT}\n\nЧто съели: ${trimmed}` }], signal);
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_TEXT } : { kind: 'ok', guesses };
  },

  async recognise(apiKey, model, dataUrl, context, signal) {
    const image = parseDataUrl(dataUrl);
    if (!image) return { kind: 'error', reason: 'Снимок не удалось прочитать.' };
    const answer = await ask(
      apiKey,
      model,
      [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: photoPrompt(context) }],
      signal,
    );
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_PHOTO } : { kind: 'ok', guesses };
  },
};
