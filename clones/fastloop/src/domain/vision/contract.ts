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

/**
 * One thing inside a dish.
 *
 * Where it came from matters as much as what it is. A model naming cumin in
 * a shakshuka has not seen cumin — it knows what shakshuka usually contains,
 * and that is a different kind of statement from «there are two eggs here».
 * Both are useful; presenting them as the same thing is how a breakdown
 * turns into theatre. So each part says which it is, and the ones that were
 * only inferred can be struck out in one tap by anyone who did not use them.
 */
export interface Component {
  readonly name: string;
  /** 0 for things used in amounts too small to weigh, like spices. */
  readonly grams: number;
  readonly macros: Macros;
  /** 'видно' — visible in the frame. 'по рецепту' — assumed from the dish. */
  readonly kind: 'видно' | 'по рецепту';
}

export interface Guess {
  readonly name: string;
  /** Estimated portion on the plate. */
  readonly grams: number;
  readonly macros: Macros;
  /** What the model saw and what it had to assume. */
  readonly note: string;
  readonly confidence: 'high' | 'medium' | 'low';
  /** Other names the model considered, best first. Usually one or two. */
  readonly alternatives: readonly string[];
  /** What the dish is made of. Empty when the model gave no breakdown. */
  readonly parts: readonly Component[];
  /**
   * True when the parts add up to the totals, within rounding. When they do
   * not, the totals are kept and the breakdown is shown as indicative only —
   * a list that does not sum is worse than no list, because people subtract
   * from it.
   */
  readonly partsAddUp: boolean;
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

/** One leg of the journey, with what it cost and what came back. */
export interface ProbeStep {
  readonly name: string;
  readonly ok: boolean;
  /** HTTP status, or 0 when nothing came back at all. */
  readonly status: number;
  readonly ms: number;
  /** The server's or the shell's own words. */
  readonly detail: string;
}

export interface VisionProvider {
  readonly id: ProviderId;
  readonly title: string;
  /** What the key looks like, for the field's placeholder. */
  readonly keyHint: string;
  /** Whether a key can be had without giving anyone a card. */
  readonly free: boolean;
  /**
   * The page that issues the key. Opened in the browser rather than typed:
   * the key is 39 random characters and nobody types that on a phone, and
   * Google refuses to sign anyone in inside a WebView.
   */
  readonly url: string;
  /** How to get one, in order, each step short enough to follow one-handed. */
  readonly steps: readonly string[];
  /** What it costs, honestly. */
  readonly cost: string;
  /** The default model; a check may replace it with one the key can reach. */
  readonly model: string;
  check(apiKey: string, signal?: AbortSignal): Promise<KeyCheck>;
  /**
   * The same journey a photograph makes, in separable steps.
   *
   * A key that checks out and a photograph that will not send are the same
   * request to the same host, differing only in method, payload and how long
   * the server takes — so "проверьте интернет" is the one answer that cannot
   * be right. Running the steps apart says which of those three it is,
   * without anyone having to cook first.
   */
  probe(apiKey: string, model: string, sample: string, signal?: AbortSignal): Promise<readonly ProbeStep[]>;
  describe(apiKey: string, model: string, text: string, signal?: AbortSignal): Promise<VisionResult>;
  /** `brief` drops the ingredient breakdown: a shorter answer, sooner. */
  recognise(apiKey: string, model: string, dataUrl: string, context?: ShotContext, signal?: AbortSignal, brief?: boolean): Promise<VisionResult>;
}

/**
 * What the app already knows at the moment of the shot.
 *
 * None of it costs the person a tap: the meal was chosen before the camera
 * opened, the clock is on the phone, and the app is a fasting tracker, so it
 * knows how long the pause was. Context measurably narrows the guess — a
 * porridge at eight in the morning and the same porridge at eleven at night
 * are different portions — and it is phrased as fact rather than as an
 * expectation, so it informs the estimate instead of anchoring it.
 */
export interface ShotContext {
  /** «завтрак», «ужин» … */
  readonly meal: string;
  /** Local time, as the phone shows it. */
  readonly time: string;
  /** Hours since the last meal, when a fast is running. */
  readonly fastedHours: number | null;
  /** Whatever the person typed beside the photograph. */
  readonly hint: string;
}

/**
 * The rule that fights the one error this whole category makes.
 *
 * Independent tests keep finding the same bias, and always in one direction:
 * roughly a third of the fat is missed, which is a few hundred calories a
 * meal — a whole day's deficit for someone counting. The reason is physical:
 * the oil a thing was fried in is not visible in the finished dish. Asking
 * the model to name its assumption was not enough, because it was free to
 * assume nothing; now it has to assume something and say what.
 */
const FAT_RULE = `- Жир приготовления. Если блюдо выглядит жареным, тушёным, запечённым или заправленным, включи масло или жир в расчёт, даже если его не видно, и назови в note принятое количество («масло принято 1 ст. л.»). При сомнении бери верхнюю границу обычного, а не нижнюю: такие оценки почти всегда занижают жир. Варёному, приготовленному на пару и сырому жира не приписывай.`;

const SHARED_RULES = `- Отдельная запись на каждое блюдо или продукт, которые логично считать отдельно. Если это одно блюдо (например плов), не разбивай его на крупу, мясо и морковь.
- Значения kcal, protein, fat, carbs, fiber — для указанной порции целиком, НЕ на 100 г.
- name — по-русски, коротко, как назвал бы человек.
${FAT_RULE}
- note — одной фразой: что ты видишь и какие допущения сделал.
- confidence — low, если состав, способ приготовления или количество понять трудно.
- parts — из чего состоит блюдо. Отдельная строка на каждый продукт, включая масло, соус, заправку и специи. У специй и соли ставь grams и все макросы в 0: их называть нужно, а калорий в них нет.
- kind у части: "seen", если ты действительно видишь этот продукт в кадре, и "assumed", если ты его не видишь, а знаешь, что в таком блюде он обычно есть. Не выдавай второе за первое.
- Сумма parts по каждому макросу должна совпадать с числами блюда. Человек вычёркивает лишнее из списка, и вычитание должно сходиться.
- alternatives — одно-два других названия, которыми это блюдо могло бы быть, если ты не уверен. Если уверен, верни пустой список.`;

export const TEXT_PROMPT = `Ты оцениваешь по описанию, что человек съел, для дневника питания.

Верни ТОЛЬКО JSON, без markdown и без пояснений вокруг, в таком виде:
{"items":[{"name":"","alternatives":[""],"grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"note":"","confidence":"high|medium|low","parts":[{"name":"","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"kind":"seen|assumed"}]}]}

Правила:
- Если человек перечислил состав одного блюда, верни ОДНУ запись с названием блюда целиком, а не отдельные записи на каждый ингредиент.
- Если перечислены разные блюда или продукты, которые едят отдельно, верни запись на каждое.
- name — по-русски, коротко, как назвал бы человек. Если блюдо названо, используй это название.
- grams — оценка веса готовой порции целиком, в граммах.
- Значения kcal, protein, fat, carbs, fiber — для всей порции, НЕ на 100 г.
- Когда количество не указано, бери обычную домашнюю порцию и скажи об этом в note.
${FAT_RULE}
- note — одной фразой: какие допущения сделаны (например «масло взято 1 ст. л.», «порция принята за 300 г»).
- confidence — low, если состав или количество по описанию понять трудно.
- parts — из чего состоит блюдо. Отдельная строка на каждый продукт, включая масло, соус, заправку и специи. У специй и соли ставь grams и все макросы в 0: их называть нужно, а калорий в них нет.
- kind у части: "seen", если продукт назван в описании человека, и "assumed", если он его не называл, а ты знаешь, что в таком блюде он обычно есть. Не выдавай второе за первое.
- Сумма parts по каждому макросу должна совпадать с числами блюда. Человек вычёркивает лишнее из списка, и вычитание должно сходиться.
- alternatives — одно-два других названия, которыми это блюдо могло бы быть, если ты не уверен. Если уверен, верни пустой список.
- Если в тексте нет еды, верни {"items":[]}.`;

/**
 * The photograph prompt, built around the one measurement people can give
 * the model for free: a unit.
 *
 * Told to judge size «by the plate and the cutlery» a model falls back on
 * its own idea of an average portion. Told to measure in plate diameters,
 * fork lengths and finger widths it does far better — in a study of 67
 * people the finger-width method put about 80% of estimates inside ±25%
 * against 29% for household measures. The instruction not to read text in
 * the frame is there because a price tag or a menu behind the plate pulls
 * the answer away from what is actually on it.
 */
export function photoPrompt(context?: ShotContext, brief = false): string {
  const facts: string[] = [];
  if (context) {
    const when = context.time === '' ? '' : ` в ${context.time}`;
    facts.push(`Снимок сделан для приёма пищи «${context.meal}»${when}.`);
    if (context.fastedHours !== null && context.fastedHours >= 1) {
      facts.push(`Это первый приём после паузы примерно в ${Math.round(context.fastedHours)} ч без еды — порция может быть крупнее обычной, но может и не быть.`);
    }
  }
  const said = context && context.hint.trim() !== ''
    ? `

Человек добавил про это блюдо: «${context.hint.trim()}». Его словам о составе и способе приготовления верь больше, чем виду на снимке: он это готовил, ты — нет.`
    : '';
  const where = facts.length > 0 ? `

Что известно помимо снимка: ${facts.join(' ')}` : '';

  // The breakdown is most of the answer's length, and length is most of the
  // wait: a plate of several dishes, each itemised by ingredient, is what
  // ran past the old ceiling. Dropping it is the difference between a slow
  // answer and none, so it stays available as the shorter question.
  const shape = brief
    ? '{"items":[{"name":"","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"note":"","confidence":"high|medium|low"}]}'
    : '{"items":[{"name":"","alternatives":[""],"grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"note":"","confidence":"high|medium|low","parts":[{"name":"","grams":0,"kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"kind":"seen|assumed"}]}]}';
  const short = brief ? '\n- Не разбирай блюдо по ингредиентам и не предлагай других названий: только итог по каждому блюду.' : '';

  return `Ты оцениваешь еду на фотографии для дневника питания.

Верни ТОЛЬКО JSON, без markdown и без пояснений вокруг, в таком виде:
${shape}

Правила:
${SHARED_RULES}
- grams — оценка веса порции на фото. Меряй размер не на глаз, а относительно видимых предметов: в диаметрах тарелки, длинах вилки или ложки, ширинах пальца. Сначала прикинь объём порции в этих единицах, потом переведи в граммы.
- Не читай надписи, ценники, меню и цифры, попавшие в кадр: они относятся не к этой тарелке. Оценивай только то, что видно глазами.
- Если еды на фото нет, верни {"items":[]}.${short}${where}${said}`;
}

/** Kept for the rare caller that needs the plain text with no context. */
export const PHOTO_PROMPT = photoPrompt();

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

function macrosOf(item: Record<string, unknown>): Macros {
  return {
    kcal: Math.round(num(item.kcal)),
    protein: Math.round(num(item.protein)),
    fat: Math.round(num(item.fat)),
    carbs: Math.round(num(item.carbs)),
    fiber: Math.round(num(item.fiber) * 10) / 10,
  };
}

function toComponents(raw: unknown): Component[] {
  if (!Array.isArray(raw)) return [];
  const out: Component[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const part = entry as Record<string, unknown>;
    const name = typeof part.name === 'string' ? part.name.trim() : '';
    if (name === '') continue;
    out.push({
      name,
      grams: Math.round(num(part.grams)),
      macros: macrosOf(part),
      // Both spellings are accepted: the wire format is ASCII, because a
      // non-ASCII enum value is a plausible way to get a schema rejected,
      // but a model told to answer in Russian often answers in Russian.
      kind: part.kind === 'seen' || part.kind === 'видно' ? 'видно' : 'по рецепту',
    });
  }
  return out;
}

/**
 * Does the breakdown add up to the dish?
 *
 * Asked because a list that does not sum is worse than no list: the whole
 * point of showing parts is that striking one out subtracts it, and that is
 * only true when the parts were the totals in the first place. A tenth of
 * slack covers rounding on each line; beyond that the breakdown is shown as
 * indicative and nothing can be struck from it.
 */
function addsUp(total: Macros, parts: readonly Component[]): boolean {
  if (parts.length === 0) return false;
  const sum = parts.reduce((acc, part) => acc + part.macros.kcal, 0);
  if (total.kcal <= 0) return sum <= 0;
  return Math.abs(sum - total.kcal) <= Math.max(25, total.kcal * 0.1);
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
      const macros = macrosOf(item);
      const parts = toComponents(item.parts);
      const alternatives = Array.isArray(item.alternatives)
        ? item.alternatives
            .filter((alt): alt is string => typeof alt === 'string' && alt.trim() !== '')
            .map((alt) => alt.trim())
            .filter((alt) => alt.toLowerCase() !== name.toLowerCase())
            .slice(0, 3)
        : [];
      return {
        name,
        grams: Math.round(num(item.grams)),
        macros,
        note: typeof item.note === 'string' ? item.note : '',
        confidence,
        alternatives,
        parts,
        partsAddUp: addsUp(macros, parts),
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
 * written down, and the macros — and the breakdown — have to follow it.
 *
 * Scaling is always from the model's own figures, never from the previous
 * edit, so dragging a portion up and back down lands exactly where it began.
 */
export function scaleGuess(guess: Guess, grams: number): Guess {
  const target = Math.max(0, Math.round(grams));
  if (guess.grams <= 0 || target === guess.grams) return { ...guess, grams: target };
  const k = target / guess.grams;
  const scale = (macros: Macros): Macros => ({
    kcal: Math.round(macros.kcal * k),
    protein: Math.round(macros.protein * k),
    fat: Math.round(macros.fat * k),
    carbs: Math.round(macros.carbs * k),
    fiber: Math.round(macros.fiber * k * 10) / 10,
  });
  return {
    ...guess,
    grams: target,
    macros: scale(guess.macros),
    parts: guess.parts.map((part) => ({ ...part, grams: Math.round(part.grams * k), macros: scale(part.macros) })),
  };
}

/** The dish with one of its parts taken out — «я без нута». */
export function withoutPart(guess: Guess, index: number): Guess {
  const part = guess.parts[index];
  if (!part || !guess.partsAddUp) return guess;
  const parts = guess.parts.filter((_, i) => i !== index);
  const left = (a: number, b: number): number => Math.max(0, Math.round(a - b));
  return {
    ...guess,
    grams: Math.max(0, guess.grams - part.grams),
    macros: {
      kcal: left(guess.macros.kcal, part.macros.kcal),
      protein: left(guess.macros.protein, part.macros.protein),
      fat: left(guess.macros.fat, part.macros.fat),
      carbs: left(guess.macros.carbs, part.macros.carbs),
      fiber: Math.max(0, Math.round((guess.macros.fiber - part.macros.fiber) * 10) / 10),
    },
    parts,
    partsAddUp: parts.length > 0,
  };
}

export const NO_FOOD_IN_PHOTO =
  'На снимке не удалось разобрать еду. Снимите ближе и при свете или введите вручную.';
export const NO_FOOD_IN_TEXT =
  'Не удалось разобрать описание. Напишите подробнее — что за блюдо и примерно сколько.';
export const NO_NETWORK = 'Не получилось связаться с сервером. Проверьте интернет.';

/**
 * What actually went wrong, kept rather than translated away.
 *
 * A request that never reaches the server fails for reasons that look
 * nothing alike — no route, a refused handshake, a reset mid-upload, a
 * server that stops answering — and this is the one place that knows which.
 * Replacing all of them with "проверьте интернет" on a phone whose internet
 * plainly works sends the owner looking in the wrong place, and leaves me
 * guessing from a screenshot.
 */
export function reasonOf(failure: unknown): string {
  const said = failure instanceof Error ? failure.message.trim() : String(failure ?? '').trim();
  if (said === '' || said === 'network' || said === 'bridge') return '';
  return said;
}

/**
 * Whether the server was simply still writing when the clock ran out.
 *
 * Android's SocketTimeoutException says "timeout" and nothing else, and
 * the page's own backstop says so in its own words. Both mean the opposite
 * of a missing connection: the request arrived, the server took it, and the
 * answer was still coming.
 */
export function ranOutOfTime(failure: unknown): boolean {
  const said = reasonOf(failure).toLowerCase();
  return said.includes('timeout') || said.includes('timed out') || said.includes('перестало ждать');
}

export const TOO_SLOW =
  'Сервер не успел ответить. Так бывает со сложными блюдами: чем больше на тарелке, тем длиннее ответ.';

/** The transport failure, said once, with its own words kept. */
export function transportFailed(failure: unknown): string {
  const said = reasonOf(failure);
  if (ranOutOfTime(failure)) return TOO_SLOW;
  return said === '' ? NO_NETWORK : `${NO_NETWORK}\n${said}`;
}
export const UNREADABLE = 'Ответ сервера не читается.';

/**
 * What a photograph cannot do, however good the model gets.
 *
 * Three of these are physics rather than engineering: what is dissolved in
 * the dish is not in the frame, depth is not in a single view, and a model
 * is not deterministic. Saying so is not modesty — it is the difference
 * between a number someone sanity-checks and a number they believe.
 */
export const VISION_NOTE =
  'Камера видит поверхность, а не состав. Масло, ушедшее в сковороду, жирность молока или творога, сахар в компоте — ' +
  'этого в кадре нет физически, поэтому по снимку почти всегда выходит меньше, чем было, и промахивается в первую ' +
  'очередь жир. Одна фраза о том, как вы готовили, помогает здесь больше, чем смена модели. Глубину по одному кадру ' +
  'тоже не видно: горка риса и тонкий слой на той же тарелке выглядят одинаково. И одно и то же блюдо в разные дни ' +
  'даст разные числа — это свойство метода, а не признак того, что вы съели больше. Поэтому отдельной записи верить ' +
  'как измерению нельзя; смотреть стоит на среднее за неделю. Когда точность нужна по-настоящему — нужны весы и ' +
  'этикетка, а не камера.';
