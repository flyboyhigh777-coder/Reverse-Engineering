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
import type { KeyCheck, ProbeStep, VisionProvider, VisionResult } from './contract';
import { noteAttempt } from './log';
import type { Attempt } from './log';

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

/** The server's own message, if it sent one, trimmed to something readable. */
function detailOf(body: string): string {
  if (body.trim() === '') return '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    if (typeof message === 'string' && message !== '') return message.slice(0, 300);
  } catch {
    /* Not JSON — fall through to the raw text. */
  }
  return body.replace(/\s+/g, ' ').trim().slice(0, 300);
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

async function ask(apiKey: string, model: string, content: unknown, what: Attempt['what'], signal?: AbortSignal): Promise<VisionResult | { readonly text: string }> {
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
  } catch (failure) {
    noteAttempt({
      at: Date.now(), provider: 'Claude', model, what, ok: false, status: 0,
      detail: reasonOf(failure) || 'запрос не ушёл: нет сети или хост закрыт',
    });
    return { kind: 'error', reason: transportFailed(failure) };
  }
  if (!response.ok) {
    const detail = detailOf(await response.text().catch(() => ''));
    noteAttempt({ at: Date.now(), provider: 'Claude', model, what, ok: false, status: response.status, detail });
    return { kind: 'error', reason: describeStatus(response.status) };
  }
  try {
    const text = textOf(await response.json());
    noteAttempt({ at: Date.now(), provider: 'Claude', model, what, ok: true, status: 200, detail: text.slice(0, 160) });
    return { text };
  } catch {
    noteAttempt({ at: Date.now(), provider: 'Claude', model, what, ok: false, status: response.status, detail: 'ответ не разобрался как JSON' });
    return { kind: 'error', reason: UNREADABLE };
  }
}

export const anthropic: VisionProvider = {
  id: 'anthropic',
  title: 'Claude',
  keyHint: 'sk-ant-…',
  free: false,
  url: 'https://console.anthropic.com/settings/keys',
  steps: [
    'Нажмите кнопку ниже, войдите и пополните баланс на минимальную сумму.',
    'Settings → API keys → Create key.',
    'Скопируйте ключ — он начинается на sk-ant — и вернитесь сюда.',
  ],
  cost: 'Каждый снимок — платный запрос на вашем счету. Оценивает точнее.',
  model: MODEL,

  /**
   * One tiny request, so the answer is yes or no before a photo is taken.
   *
   * A key that turns out to be wrong at the moment someone is holding a
   * plate is the worst time to find out, and the error a failed photo
   * returns cannot distinguish "bad key" from "bad picture".
   */
  /** The same three legs, so a failure says which one rather than "интернет". */
  async probe(apiKey, model, sample, signal): Promise<readonly ProbeStep[]> {
    const steps: ProbeStep[] = [];

    const leg = async (name: string, content: unknown[]) => {
      const started = Date.now();
      try {
        const response = await netFetch(ENDPOINT, {
          method: 'POST',
          signal,
          headers: headers(apiKey),
          body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content }] }),
        });
        const body = await response.text().catch(() => '');
        steps.push({
          name,
          ok: response.ok,
          status: response.status,
          ms: Date.now() - started,
          detail: response.ok ? `${Math.round(body.length / 1024)} КБ ответа` : detailOf(body),
        });
        return response.ok;
      } catch (failure) {
        steps.push({ name, ok: false, status: 0, ms: Date.now() - started, detail: reasonOf(failure) || 'ответа нет' });
        return false;
      }
    };

    if (!(await leg('Короткий вопрос (POST, 0,1 КБ)', [{ type: 'text', text: 'Ответь одним словом: да' }]))) return steps;
    const base64 = sample.includes(',') ? sample.slice(sample.indexOf(',') + 1) : sample;
    await leg(`Снимок (POST, ${Math.round(sample.length / 1024)} КБ)`, [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
      { type: 'text', text: 'Что на снимке? Одно слово.' },
    ]);
    return steps;
  },

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
      noteAttempt({ at: Date.now(), provider: 'Claude', model: MODEL, what: 'ключ', ok: false, status: 0, detail: 'запрос не ушёл: нет сети или хост закрыт' });
      return { ok: false, reason: 'Нет связи с сервером. Проверьте интернет на телефоне.' };
    }
    if (!response.ok) {
      const detail = detailOf(await response.text().catch(() => ''));
      noteAttempt({ at: Date.now(), provider: 'Claude', model: MODEL, what: 'ключ', ok: false, status: response.status, detail });
      return { ok: false, reason: describeStatus(response.status) };
    }
    noteAttempt({ at: Date.now(), provider: 'Claude', model: MODEL, what: 'ключ', ok: true, status: 200, detail: '' });
    return { ok: true, model: MODEL };
  },

  async describe(apiKey, model, text, signal) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return { kind: 'error', reason: 'Напишите, что вы ели.' };
    const answer = await ask(apiKey, model, `${TEXT_PROMPT}\n\nЧто съели: ${trimmed}`, 'описание', signal);
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_TEXT } : { kind: 'ok', guesses };
  },

  async recognise(apiKey, model, dataUrl, context, signal, brief = false) {
    const image = parseDataUrl(dataUrl);
    if (!image) return { kind: 'error', reason: 'Снимок не удалось прочитать.' };
    const answer = await ask(
      apiKey,
      model,
      [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        { type: 'text', text: photoPrompt(context, brief) },
      ],
      'фото',
      signal,
    );
    if ('kind' in answer) return answer;
    const guesses = toGuesses(extractJson(answer.text));
    return guesses.length === 0 ? { kind: 'error', reason: NO_FOOD_IN_PHOTO } : { kind: 'ok', guesses };
  },
};
