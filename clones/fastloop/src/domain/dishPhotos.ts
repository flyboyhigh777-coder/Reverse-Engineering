/**
 * Where a photograph of each dish can be found.
 *
 * The cards used to carry drawn art only, because photography of food is
 * never ours to ship. Wikimedia Commons is the exception: everything there
 * is published under a free licence, and the API hands back the author and
 * the licence string along with the file, so a photo can be shown with its
 * credit attached rather than silently appropriated.
 *
 * Nothing here is a URL. Commons file names change, and a hard-coded one
 * turns into a hole in the card the day it does. What is stored instead is
 * the search a human would type, plus the words the file name must contain
 * for the result to be about this dish at all — the search alone will happily
 * return a photograph of a cabbage field for «Щи».
 */

export interface DishQuery {
  /** What to search Commons for, in English — its index is almost entirely English. */
  readonly q: string;
  /** At least one of these must appear in the file title, lowercased. */
  readonly must: readonly string[];
}

export const DISH_QUERIES: Readonly<Record<string, DishQuery>> = {
  'cottage-bowl': { q: 'cottage cheese bowl berries nuts', must: ['cottage', 'quark', 'curd', 'tvorog'] },
  'egg-veg-scramble': { q: 'scrambled eggs with vegetables plate', must: ['scrambled', 'egg'] },
  'oat-protein': { q: 'bowl of oatmeal porridge with berries', must: ['oatmeal', 'porridge', 'oat'] },
  'shakshuka': { q: 'shakshuka eggs tomato pan', must: ['shakshuka', 'shakshouka'] },
  'cottage-omelette': { q: 'omelette with herbs on plate', must: ['omelet', 'omelette'] },
  'kefir-bran': { q: 'glass of kefir with berries', must: ['kefir'] },
  'tuna-bean': { q: 'tuna and white bean salad', must: ['tuna', 'bean'] },
  'chicken-cabbage': { q: 'cabbage salad with chicken sesame', must: ['cabbage', 'coleslaw', 'salad'] },
  'greek-feta': { q: 'greek salad with feta cheese', must: ['greek salad', 'feta', 'horiatiki'] },
  'beet-walnut': { q: 'beetroot salad with walnuts', must: ['beet', 'beetroot'] },
  'tuna-egg': { q: 'tuna salad with egg plate', must: ['tuna'] },
  'lentil-soup': { q: 'lentil soup bowl tomato', must: ['lentil'] },
  'chicken-broth-veg': { q: 'chicken broth soup with vegetables bowl', must: ['broth', 'bouillon', 'chicken soup'] },
  'broccoli-cream': { q: 'broccoli cream soup bowl', must: ['broccoli'] },
  'baked-fish': { q: 'baked mackerel with vegetables', must: ['mackerel', 'baked fish', 'fish'] },
  'chicken-buckwheat': { q: 'buckwheat with chicken and mushrooms', must: ['buckwheat', 'grechka', 'kasha'] },
  'turkey-patties': { q: 'turkey cutlets patties plate', must: ['cutlet', 'patt', 'kotlet', 'meatball'] },
  'beef-stew': { q: 'beef stew with beans', must: ['stew', 'beef'] },
  'tofu-stirfry': { q: 'tofu stir fry with vegetables', must: ['tofu'] },
  'chicken-broccoli': { q: 'baked chicken breast with broccoli', must: ['chicken breast', 'broccoli', 'chicken'] },
  'yogurt-nuts': { q: 'greek yogurt with nuts bowl', must: ['yogurt', 'yoghurt'] },
  'hummus-veg': { q: 'hummus with vegetable sticks', must: ['hummus', 'houmous'] },
  'egg-avocado': { q: 'boiled eggs with avocado plate', must: ['avocado'] },
  'cottage-cucumber': { q: 'cottage cheese with cucumber herbs', must: ['cottage', 'quark', 'curd', 'tvorog'] },

  'uz-shurpa': { q: 'shurpa soup uzbek', must: ['shurpa', 'shorba', 'sorpa'] },
  'uz-chalop': { q: 'chalop cold soup uzbek', must: ['chalop', 'chalap', 'ayran soup'] },
  'uz-achichuk': { q: 'achichuk salad tomato onion uzbek', must: ['achichuk', 'achik', 'tomato salad'] },
  'uz-dimlama': { q: 'dimlama stew uzbek vegetables', must: ['dimlama', 'damlama'] },
  'uz-nohat': { q: 'boiled chickpeas with onion', must: ['chickpea', 'nohat', 'nokhat'] },
  'ru-shchi': { q: 'shchi cabbage soup bowl', must: ['shchi', 'cabbage soup'] },
  'ru-okroshka': { q: 'okroshka cold soup bowl', must: ['okroshka'] },
  'ru-grechka': { q: 'buckwheat kasha with mushrooms', must: ['buckwheat', 'grechka', 'kasha'] },
  'ru-beet-walnut': { q: 'beetroot salad garlic walnut', must: ['beet', 'beetroot'] },
  'kz-sorpa': { q: 'sorpa lamb broth kazakh', must: ['sorpa', 'shorpa', 'shurpa', 'broth'] },
  'kz-kuyrdak': { q: 'kuyrdak kazakh dish', must: ['kuyrdak', 'kuurdak', 'qwyrdaq'] },
  'kz-shalgam': { q: 'radish carrot salad', must: ['radish', 'shalgam', 'daikon'] },
  'cau-lobio': { q: 'lobio red beans georgian', must: ['lobio', 'bean'] },
  'cau-chakhokhbili': { q: 'chakhokhbili chicken georgian', must: ['chakhokhbili', 'chahohbili'] },
  'cau-walnut-salad': { q: 'tomato cucumber salad with walnuts georgian', must: ['tomato', 'cucumber', 'salad'] },
  'tat-tokmach': { q: 'tokmach noodle chicken soup tatar', must: ['tokmach', 'noodle soup', 'chicken soup'] },
  'tat-azu': { q: 'azu tatar beef dish', must: ['azu'] },
  'tat-katyk': { q: 'katyk fermented milk bowl', must: ['katyk', 'katik', 'ayran', 'yogurt'] },
};

/**
 * File names that look like a dish but are not one. A search for «лобио»
 * returns the restaurant sign as readily as the plate, and a sign makes a
 * poor card.
 */
export const TITLE_REJECT: readonly string[] = [
  'logo', 'map', 'diagram', 'chart', 'icon', 'sign', 'poster', 'label', 'packaging',
  'menu', 'coat of arms', 'flag', 'stamp', 'banknote', 'portrait', 'monument',
  'street', 'building', 'facade', 'interior', 'market', 'field', 'plant', 'farm',
  'seeds', 'raw ', 'uncooked', 'package', 'box of', 'can of', 'bottle of',
];
