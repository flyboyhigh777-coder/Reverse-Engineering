import { searchFoods } from './foods';
import type { Food } from './foods';
import type { Recipe } from './recipes';

/**
 * One search across everything the app already knows.
 *
 * The table holds ingredients and simple dishes; the recipe library holds
 * cooked meals. Keeping them behind separate tabs meant that typing
 * "шакшука" — a dish this app has written out in full, with macros per
 * serving — returned nothing at all. The split was an artefact of how the
 * data is stored, and the person searching has no reason to know about it.
 */

export type Hit =
  | { readonly kind: 'food'; readonly food: Food }
  | { readonly kind: 'recipe'; readonly recipe: Recipe };

const FOLD = (text: string): string => text.toLowerCase().replace(/ё/g, 'е').trim();

function matchesRecipe(recipe: Recipe, words: readonly string[]): boolean {
  const hay = FOLD(`${recipe.title} ${recipe.tags.join(' ')} ${recipe.region ?? ''}`);
  return words.every((word) => hay.includes(word));
}

export function searchLibrary(query: string, recipes: readonly Recipe[], limit = 40): readonly Hit[] {
  const needle = FOLD(query);
  const words = needle.split(/\s+/).filter(Boolean);

  const foods: Hit[] = searchFoods(query, limit).map((food) => ({ kind: 'food', food }));
  if (words.length === 0) return foods;

  // A cooked dish that matches by name is what someone typing a dish name
  // wanted, so those come first.
  const matched: Hit[] = recipes
    .filter((recipe) => matchesRecipe(recipe, words))
    .map((recipe) => ({ kind: 'recipe', recipe }));

  const exact = matched.filter((hit) => FOLD(hit.kind === 'recipe' ? hit.recipe.title : '').startsWith(needle));
  const rest = matched.filter((hit) => !exact.includes(hit));
  return [...exact, ...rest, ...foods].slice(0, limit);
}
