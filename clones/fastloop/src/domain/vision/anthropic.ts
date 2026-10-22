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

/** Claude. The better estimate of the two, and the one that costs money. */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5-5';

function headers(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // Required for a request made straight from a page rather than a server.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return 'Ключ не принят. Проверьте, что скопирован он целиком.';
  if (status === 429) return 'Слишком часто — лимит запросов. Попробуйте через минуту.';
  if (status === 400) return 'Запрос отклонён. Возможно, на ключе нет доступа к этой модели.';
  if (status === 402) return 'На счёте Anthropic нет средств — пополните баланс в консоли.';
  return `Сервер ответил ошибкой ${status}.`;
}

/** The assistant's reply is a list of blocks; only the text ones matter. */
function textOf(payload: unknown): string {
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (block && typeof block === 'object' ? (block as { text?: unknown }).text : null))
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

async function ask(apiKey: string, model: string, content: unknown, signal?: AbortSignal): Promise<VisionResult | { readonly text: string }> {
  let response: Awaited<ReturnType<typeof netFetch>>;
  try {
    response = await netFetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: headers(apiKey),
      // A reply cut off at the limit is unparseable however good the parser
      // is, and a table with three dishes on it does not fit in 900.
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content }] }),
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

export const anthropic: VisionProvider = {
  id: 'anthropic',
  title: 'Claude',
  keyHint: 'sk-ant-…',
  free: false,
  where: 'console.anthropic.com → Settings → API keys → Create key, и пополнить баланс на минимальную сумму.',
  cost: 'Каждый снимок — платный запрос на вашем счету. Оценивает точнее.',
  model: MODEL,

  /**
   * One tiny request, so the answer is yes or no before a photo is taken.
   *
   * A key that turns out to be wrong at the moment someone is holding a
   * plate is the worst time to find out, and the error a failed photo
   * returns cannot distinguish "bad key" from "bad picture".
   */
  async check(apiKey, signal): Promise<KeyCheck> {
    let response: Awaited<ReturnType<typeof netFetch>>;
    try {
      response = await netFetch(ENDPOINT, {
        method: 'POST',
        signal,
        headers: headers(apiKey),
        body: JSON.stringify({ model: MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
      });
    } catch {
      return { ok: false, reason: 'Нет связи с сервером. Проверьте интернет на телефоне.' };
    }
    return response.ok ? { ok: true, model: MODEL } : { ok: false, reason: describeStatus(response.status) };
  },

  async describe(apiKey, model, text, signal) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return { kind: 'error', reason: 'Напишите, что вы ели.' };
    const answer = await ask(apiKey, model, `${TEXT_PROMPT}\n\nЧто съели: ${trimmed}`, signal);
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
      [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        { type: 'text', text: photoPrompt(context) },
      ],
      signal,
    );
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_PHOTO } : { kind: 'ok', guesses };
  },
};
