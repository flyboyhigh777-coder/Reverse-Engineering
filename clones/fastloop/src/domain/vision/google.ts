import { netFetch } from '../../state/net';
import {
  NO_FOOD_IN_PHOTO,
  NO_FOOD_IN_TEXT,
  reasonOf,
  transportFailed,
  TEXT_PROMPT,
  UNREADABLE,
  extractJson,
  parseDataUrl,
  photoPrompt,
  toGuesses,
} from './contract';
import type { KeyCheck, VisionProvider, VisionResult } from './contract';
import { noteAttempt } from './log';
import type { Attempt } from './log';

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
          alternatives: { type: 'ARRAY', items: { type: 'STRING' } },
          parts: {
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
                kind: { type: 'STRING', enum: ['seen', 'assumed'] },
              },
              required: ['name'],
            },
          },
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

/** The server's own message, if it sent one, trimmed to something readable. */
function detailOf(body: string): string {
  if (body.trim() === '') return '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown; status?: unknown } };
    const message = parsed.error?.message;
    if (typeof message === 'string' && message !== '') return message.slice(0, 300);
  } catch {
    /* Not JSON — fall through to the raw text. */
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 300);
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

/**
 * Whether this model deliberates before answering unless told not to.
 *
 * Gemini 2.5 onwards thinks by default, and those thoughts are billed to
 * the same output budget and paid for in seconds. Reading a plate into a
 * fixed schema is extraction, not deliberation, so the thinking buys very
 * little and costs the wait — long enough on a phone to look like a dead
 * connection, which is what it looked like.
 */
function deliberates(model: string): boolean {
  const version = /(\d+)\.(\d+)/.exec(model.toLowerCase());
  if (!version) return false;
  return Number(version[1]) * 100 + Number(version[2]) >= 205;
}

async function ask(
  apiKey: string,
  model: string,
  parts: unknown[],
  what: Attempt['what'],
  signal?: AbortSignal,
  // Cleared and the call repeated when the server does not know the field.
  // The model list comes from the server, so one that rejects this must
  // still work: an optimisation may not be the thing that breaks a camera.
  mayQuiet = true,
): Promise<VisionResult | { readonly text: string }> {
  const path = model.startsWith('models/') ? model : `models/${model}`;
  const quiet = mayQuiet && deliberates(model);
  let response: Awaited<ReturnType<typeof netFetch>>;
  const started = Date.now();
  let attempt = 0;
  for (;;) {
    try {
      attempt += 1;
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
            maxOutputTokens: 3000,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: ANSWER_SCHEMA,
            ...(quiet ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });
      break;
    } catch (failure) {
      const spent = Date.now() - started;
      // A connection that dies in the first seconds is the kind that comes
      // back on its own; one that dies after waiting was not a blip, and
      // asking again would only make somebody hold a cooling plate twice
      // as long. Retrying costs nothing in the first case and is wrong in
      // the second, so the clock decides.
      if (attempt === 1 && spent < 10_000) continue;
      noteAttempt({
        at: Date.now(), provider: 'Google AI Studio', model, what, ok: false, status: 0,
        detail: `${reasonOf(failure) || 'запрос не ушёл'} · через ${Math.round(spent / 1000)}с${attempt > 1 ? ', вторая попытка' : ''}`,
      });
      return { kind: 'error', reason: transportFailed(failure) };
    }
  }
  if (!response.ok) {
    const detail = detailOf(await response.text().catch(() => ''));
    // A model that will not take the no-thinking field answers 400. Asking
    // again without it keeps such a model working, just slower.
    if (response.status === 400 && quiet && /think/i.test(detail)) {
      return ask(apiKey, model, parts, what, signal, false);
    }
    noteAttempt({ at: Date.now(), provider: 'Google AI Studio', model, what, ok: false, status: response.status, detail });
    return { kind: 'error', reason: describeStatus(response.status) };
  }
  try {
    const text = textOf(await response.json());
    noteAttempt({ at: Date.now(), provider: 'Google AI Studio', model, what, ok: true, status: 200, detail: text.slice(0, 160) });
    return { text };
  } catch {
    noteAttempt({ at: Date.now(), provider: 'Google AI Studio', model, what, ok: false, status: response.status, detail: 'ответ не разобрался как JSON' });
    return { kind: 'error', reason: UNREADABLE };
  }
}

export const google: VisionProvider = {
  id: 'google',
  title: 'Google AI Studio',
  keyHint: 'AIza…',
  free: true,
  url: 'https://aistudio.google.com/apikey',
  steps: [
    'Нажмите кнопку ниже и войдите в аккаунт Google. Карта не нужна.',
    'Нажмите «Get API key», потом «Create API key».',
    'Скопируйте ключ — он начинается на AIza — и вернитесь сюда.',
  ],
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
    } catch (failure) {
      const said = reasonOf(failure);
      noteAttempt({
        at: Date.now(), provider: 'Google AI Studio', model: '', what: 'ключ', ok: false, status: 0,
        detail: said || 'запрос не ушёл: нет сети или хост закрыт',
      });
      return { ok: false, reason: said === '' ? 'Нет связи с сервером. Проверьте интернет на телефоне.' : `Нет связи с сервером: ${said}` };
    }
    if (!response.ok) {
      const detail = detailOf(await response.text().catch(() => ''));
      noteAttempt({ at: Date.now(), provider: 'Google AI Studio', model: '', what: 'ключ', ok: false, status: response.status, detail });
      return { ok: false, reason: describeStatus(response.status) };
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, reason: UNREADABLE };
    }
    const model = chooseModel(payload);
    noteAttempt({
      at: Date.now(), provider: 'Google AI Studio', model: model ?? '', what: 'ключ', ok: model !== null, status: 200,
      detail: model ? '' : 'в списке нет подходящей модели',
    });
    if (!model) {
      return { ok: false, reason: 'Ключ принят, но подходящей модели у него нет. Проверьте, включён ли Gemini API.' };
    }
    return { ok: true, model };
  },

  async describe(apiKey, model, text, signal) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return { kind: 'error', reason: 'Напишите, что вы ели.' };
    const answer = await ask(apiKey, model, [{ text: `${TEXT_PROMPT}\n\nЧто съели: ${trimmed}` }], 'описание', signal);
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
      'фото',
      signal,
    );
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_PHOTO } : { kind: 'ok', guesses };
  },
};
