import { FOODS } from './foods';
import type { Food } from './foods';
import type { Macros, Recipe } from './recipes';

/**
 * Turning a recipe's ingredient lines into something that can be switched off.
 *
 * Recipes are written for people to read — "Нут сухой, 200 г (замочить с
 * вечера)" — not as structured data. To let someone say "I made this without
 * the chickpeas", each line is parsed for an amount and matched against the
 * food table, which is where composition lives.
 *
 * What a removed ingredient costs is subtracted from the recipe's own
 * stated macros rather than recomputing the dish from its parts. The stated
 * figures were worked out for the finished dish, including what cooking does
 * to it; a sum of raw lines would quietly disagree with them and there would
 * be no way to tell which number was the real one.
 *
 * Lines that cannot be measured — "Соль, перец, зира", "Кинза, большой
 * пучок" — stay in the list and say so. Nearly all of them are herbs and
 * spices whose contribution is a rounding error, and inventing a figure for
 * them would be worse than admitting the gap.
 */

export interface Ingredient {
  readonly line: string;
  readonly name: string;
  /** Portion in grams for the whole recipe, when the line states one. */
  readonly grams: number | null;
  readonly food: Food | null;
  /** Macros this line contributes to the whole recipe, null when unknown. */
  readonly macros: Macros | null;
}

const FOLD = (text: string): string => text.toLowerCase().replace(/ё/g, 'е').trim();

/** Spoons and pieces, in grams. A tablespoon of oil is about 14; 15 is close enough. */
const SPOON: Readonly<Record<string, number>> = {
  'ст. л.': 15,
  'ст.л.': 15,
  'столовая ложка': 15,
  'ч. л.': 5,
  'ч.л.': 5,
  'чайная ложка': 5,
};

/**
 * A crude Russian stem: enough to see that «яйца» and «яйцо» are the same
 * word, and that «помидоры» is «помидор». Four or five leading letters do
 * that for nearly every food name without pulling in a morphology library
 * this app has no other use for.
 */
function stem(word: string): string {
  return word.slice(0, Math.max(3, Math.min(5, word.length - 2)));
}

function words(name: string): readonly string[] {
  return FOLD(name)
    .split(/[^а-яa-z0-9]+/)
    .filter((word) => word.length >= 3);
}

function sameWord(a: string, b: string): boolean {
  // Without a length guard «соль» and «солянка» share a stem, and the salt
  // in a recipe becomes a bowl of soup.
  if (Math.abs(a.length - b.length) > 2) return false;
  const left = stem(a);
  const right = stem(b);
  return left.startsWith(right) || right.startsWith(left);
}

/** Weight of one piece, when the matched food names one in its portions. */
function pieceWeight(food: Food | null): number | null {
  if (!food) return null;
  for (const portion of food.portions) {
    const match = /(\d+(?:[.,]\d+)?)\s*(?:шт\.?)?\s*(\d+)?\s*г/.exec(portion.label);
    if (/шт/.test(portion.label) && match) {
      const grams = Number(match[2] ?? match[1]);
      if (Number.isFinite(grams) && grams > 0) return grams;
    }
  }
  return null;
}

/**
 * A portion the table already names — «банка», «горсть», «половина».
 * The food table spells these out in grams, so a line that uses the same
 * word can borrow the figure instead of guessing one.
 */
function namedPortion(line: string, food: Food | null): number | null {
  if (!food) return null;
  const text = FOLD(line);
  for (const portion of food.portions) {
    const keyword = FOLD(portion.label).split(/[\s,]/)[0];
    if (keyword.length < 5 || /^\d/.test(keyword)) continue;
    if (!text.includes(keyword)) continue;
    const count = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${keyword}`).exec(text);
    const times = count ? Number(count[1].replace(',', '.')) : 1;
    return Number.isFinite(times) ? times * portion.grams : portion.grams;
  }
  return null;
}

function amountOf(line: string, food: Food | null): number | null {
  const text = line.toLowerCase();

  for (const [token, grams] of Object.entries(SPOON)) {
    const spoon = new RegExp(`(\\d+(?:[.,]\\d+)?)?\\s*${token.replace(/[.\\]/g, '\\$&')}`).exec(text);
    if (spoon) {
      const count = spoon[1] ? Number(spoon[1].replace(',', '.')) : 1;
      return Number.isFinite(count) ? count * grams : grams;
    }
  }

  const weight = /(\d+(?:[.,]\d+)?)\s*(кг|г|гр|мл|л)(?![а-яa-z])/.exec(text);
  if (weight) {
    const value = Number(weight[1].replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    const unit = weight[2];
    return unit === 'кг' || unit === 'л' ? value * 1000 : value;
  }

  const pieces = /(\d+(?:[.,]\d+)?)\s*шт/.exec(text);
  if (pieces) {
    const count = Number(pieces[1].replace(',', '.'));
    const one = pieceWeight(food);
    return Number.isFinite(count) && one !== null ? count * one : null;
  }

  // \b is ASCII-only in JavaScript, so no word boundary exists around a
  // Cyrillic word and the half-an-apple case fell through.
  if (/половин/.test(text)) {
    const one = pieceWeight(food);
    if (one !== null) return one / 2;
  }

  return namedPortion(line, food);
}

/**
 * Finds the table entry a line is talking about.
 *
 * Deliberately strict: a loose match would silently subtract the calories of
 * something the person never had. The first word has to agree, which is
 * enough for "Помидоры" → "Помидор" and refuses "Хмели-сунели".
 */
function matchFood(name: string): Food | null {
  const needle = words(name);
  if (needle.length === 0) return null;
  const first = needle[0];
  const last = needle[needle.length - 1];

  let best: { food: Food; score: number } | null = null;
  for (const food of FOODS) {
    const named = words(food.name);
    const alias = (food.also ?? []).flatMap(words);
    // A synonym counts for half: «зелёный лук» is listed under greens, but a
    // line that says «лук» means the onion, not the herbs.
    const weight = (word: string) =>
      named.some((other) => sameWord(word, other)) ? 1 : alias.some((other) => sameWord(word, other)) ? 0.5 : 0;

    // The head noun carries the meaning, and in these lines it is the first
    // word ("Фасоль белая") or the last ("Оливковое масло"). A match on a
    // middle word alone is how "Фасоль белая" became "Хлеб белый".
    let score = weight(first) * 300;
    if (last !== first) score += weight(last) * 150;
    if (score === 0) continue;
    score += needle.filter((word) => word !== first && word !== last).reduce((sum, word) => sum + weight(word) * 50, 0);
    score -= food.name.length;

    if (!best || score > best.score) best = { food, score };
  }
  return best ? best.food : null;
}

export function parseIngredient(line: string): Ingredient {
  const name = line.split(',')[0].trim();
  const food = matchFood(name);
  const grams = amountOf(line, food);
  const macros =
    food && grams !== null
      ? {
          kcal: Math.round((food.per100g.kcal * grams) / 100),
          protein: Math.round((food.per100g.protein * grams) / 100),
          fat: Math.round((food.per100g.fat * grams) / 100),
          carbs: Math.round((food.per100g.carbs * grams) / 100),
          fiber: Math.round((food.per100g.fiber * grams) / 10) / 10,
        }
      : null;
  return { line, name, grams, food, macros };
}

export function parseRecipe(recipe: Recipe): readonly Ingredient[] {
  return recipe.ingredients.map(parseIngredient);
}

/**
 * The recipe's own macros per serving, less whatever was left out.
 *
 * Two figures bound the answer. The recipe's stated macros are the upper
 * one: they were worked out for the finished dish. The ingredients still in
 * it are the lower one — whatever else is true, the dish contains at least
 * those. Subtracting without that floor drove the carbohydrates of a
 * shakshuka to zero while its tomatoes and onion were still in the pan,
 * because the two sets of numbers were never derived from each other and do
 * not have to agree.
 */
export function adjusted(
  recipe: Recipe,
  all: readonly Ingredient[],
  removedLines: readonly string[],
  servings: number,
): Macros {
  const removed = all.filter((item) => removedLines.includes(item.line));
  const kept = all.filter((item) => !removedLines.includes(item.line));
  const per = Math.max(1, recipe.servings);

  const one = (pick: (m: Macros) => number): number => {
    const taken = removed.reduce((sum, item) => sum + (item.macros ? pick(item.macros) : 0), 0) / per;
    const floor = kept.reduce((sum, item) => sum + (item.macros ? pick(item.macros) : 0), 0) / per;
    return Math.max(0, Math.min(pick(recipe.macros), Math.max(pick(recipe.macros) - taken, floor)));
  };

  return {
    kcal: Math.round(one((m) => m.kcal) * servings),
    protein: Math.round(one((m) => m.protein) * servings),
    fat: Math.round(one((m) => m.fat) * servings),
    carbs: Math.round(one((m) => m.carbs) * servings),
    fiber: Math.round(one((m) => m.fiber) * servings * 10) / 10,
  };
}
