import { RECIPES, recipeById } from './recipes';
import type { Macros } from './recipes';

/**
 * Week-long menus assembled from the recipe library.
 *
 * Each plan solves one obstacle the onboarding interview actually collects —
 * no time, no money, a vegetarian diet, a week after a slip — rather than
 * being a generic "summer slimming" card. The daily totals are computed from
 * the recipes, not written by hand, so they cannot drift out of sync.
 */

export type PlanGoal = 'Старт' | 'Белок' | 'Бюджет' | 'Без готовки' | 'Вегетарианское' | 'Возвращение';

export interface PlanDay {
  readonly label: string;
  readonly breakfast: string;
  readonly lunch: string;
  readonly dinner: string;
  readonly snack?: string;
  readonly note?: string;
}

export interface MealPlan {
  readonly id: string;
  readonly title: string;
  readonly goal: PlanGoal;
  readonly lede: string;
  readonly about: string;
  readonly art: 'sunrise' | 'protein' | 'coin' | 'clock' | 'sprout' | 'return';
  readonly days: readonly PlanDay[];
  readonly premium: boolean;
}

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function week(rows: readonly Omit<PlanDay, 'label'>[]): readonly PlanDay[] {
  return rows.map((row, index) => ({ label: DAYS[index], ...row }));
}

export const MEAL_PLANS: readonly MealPlan[] = [
  {
    id: 'first-week',
    title: 'Первая неделя',
    goal: 'Старт',
    lede: 'Мягкий вход: окно пока широкое, главное — привыкнуть есть по плану',
    about:
      'На этой неделе длину окна не трогаем. Задача одна: три приёма пищи вместо постоянных перекусов, и в каждом — источник белка. Это та часть, которая работает независимо от расписания.',
    art: 'sunrise',
    days: week([
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'chicken-buckwheat', snack: 'yogurt-nuts', note: 'Решите заранее, во сколько ужин — от него строится всё окно.' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'turkey-patties', snack: 'egg-avocado' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'baked-fish', snack: 'yogurt-nuts' },
      { breakfast: 'egg-veg-scramble', lunch: 'chicken-broth-veg', dinner: 'chicken-buckwheat', snack: 'hummus-veg' },
      { breakfast: 'oat-protein', lunch: 'greek-feta', dinner: 'turkey-patties', snack: 'cottage-cucumber', note: 'Пятница — проверьте, не уехал ли ужин на поздний вечер.' },
      { breakfast: 'cottage-bowl', lunch: 'tuna-bean', dinner: 'baked-fish', snack: 'yogurt-nuts' },
      { breakfast: 'egg-veg-scramble', lunch: 'lentil-soup', dinner: 'chicken-cabbage', snack: 'egg-avocado', note: 'Приготовьте чечевичный суп на два дня вперёд — понедельник станет проще.' },
    ]),
    premium: false,
  },
  {
    id: 'high-protein',
    title: 'Высокобелковая неделя',
    goal: 'Белок',
    lede: 'Чтобы вес уходил за счёт жира, а не мышц',
    about:
      'Ориентир — около 1,6 г белка на килограмм веса в сутки. В исследовании при одинаковом дефиците группа с высоким белком потеряла 0,3 кг тощей массы против 1,6 кг у группы с низким. Эта неделя собрана вокруг этой цифры.',
    art: 'protein',
    days: week([
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'beef-stew', snack: 'yogurt-nuts' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'chicken-buckwheat', snack: 'cottage-cucumber' },
      { breakfast: 'oat-protein', lunch: 'beef-stew', dinner: 'turkey-patties', snack: 'egg-avocado' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-broth-veg', dinner: 'baked-fish', snack: 'yogurt-nuts' },
      { breakfast: 'shakshuka', lunch: 'chicken-cabbage', dinner: 'chicken-buckwheat', snack: 'cottage-cucumber' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'turkey-patties', snack: 'egg-avocado' },
      { breakfast: 'cottage-bowl', lunch: 'beef-stew', dinner: 'baked-fish', snack: 'yogurt-nuts', note: 'Говядину готовьте в воскресенье на несколько дней.' },
    ]),
    premium: true,
  },
  {
    id: 'budget',
    title: 'Бюджетная неделя',
    goal: 'Бюджет',
    lede: 'Только недорогие продукты, которые есть в любом магазине',
    about:
      'Ни авокадо, ни тахини, ни лосося. Творог, яйца, курица, скумбрия, гречка, чечевица, капуста — всё, что стоит недорого и даёт белок с клетчаткой.',
    art: 'coin',
    days: week([
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'chicken-buckwheat' },
      { breakfast: 'egg-veg-scramble', lunch: 'chicken-cabbage', dinner: 'baked-fish', snack: 'cottage-cucumber' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'turkey-patties' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-broth-veg', dinner: 'chicken-buckwheat', snack: 'cottage-cucumber' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'baked-fish' },
      { breakfast: 'oat-protein', lunch: 'chicken-cabbage', dinner: 'beet-walnut', snack: 'cottage-cucumber' },
      { breakfast: 'egg-veg-scramble', lunch: 'lentil-soup', dinner: 'chicken-buckwheat', note: 'Закупка на неделю: творог, яйца, курица, скумбрия, гречка, чечевица, капуста, морковь.' },
    ]),
    premium: false,
  },
  {
    id: 'no-cook',
    title: 'Неделя без готовки',
    goal: 'Без готовки',
    lede: 'Каждое блюдо — пятнадцать минут или меньше',
    about: 'Для недель, когда готовить некогда. «Нет времени» — второй по частоте ответ на вопрос, что мешало раньше.',
    art: 'clock',
    days: week([
      { breakfast: 'cottage-bowl', lunch: 'tuna-bean', dinner: 'tofu-stirfry' },
      { breakfast: 'yogurt-nuts', lunch: 'greek-feta', dinner: 'egg-veg-scramble', snack: 'cottage-cucumber' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'tofu-stirfry' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'greek-feta', snack: 'egg-avocado' },
      { breakfast: 'cottage-bowl', lunch: 'hummus-veg', dinner: 'chicken-cabbage' },
      { breakfast: 'yogurt-nuts', lunch: 'greek-feta', dinner: 'tuna-bean', snack: 'cottage-cucumber' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'egg-veg-scramble' },
    ]),
    premium: true,
  },
  {
    id: 'vegetarian',
    title: 'Вегетарианская неделя',
    goal: 'Вегетарианское',
    lede: 'Без мяса, но с белком — это главная сложность и она решена',
    about:
      'Растительные схемы чаще всего проваливаются по белку. Здесь он набирается из творога, яиц, нута, чечевицы и тофу, а клетчатки получается больше, чем в любом другом плане.',
    art: 'sprout',
    days: week([
      { breakfast: 'cottage-bowl', lunch: 'lentil-soup', dinner: 'tofu-stirfry' },
      { breakfast: 'shakshuka', lunch: 'greek-feta', dinner: 'broccoli-cream', snack: 'hummus-veg' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'tofu-stirfry', snack: 'yogurt-nuts' },
      { breakfast: 'egg-veg-scramble', lunch: 'greek-feta', dinner: 'broccoli-cream', snack: 'egg-avocado' },
      { breakfast: 'cottage-bowl', lunch: 'beet-walnut', dinner: 'shakshuka', snack: 'hummus-veg' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'tofu-stirfry' },
      { breakfast: 'shakshuka', lunch: 'greek-feta', dinner: 'broccoli-cream', snack: 'yogurt-nuts' },
    ]),
    premium: true,
  },
  {
    id: 'comeback',
    title: 'Неделя возвращения',
    goal: 'Возвращение',
    lede: 'После срыва, болезни или отпуска — без попыток «отработать»',
    about:
      'Главная ошибка после перерыва — компенсировать его более длинным голоданием. Эта неделя делает обратное: возвращает регулярность еды, а окно оставляет мягким. Разница между теми, кто держится полгода, и теми, кто бросает, почти всегда в том, что происходит на следующий день после пропуска.',
    art: 'return',
    days: week([
      { breakfast: 'chicken-broth-veg', lunch: 'cottage-cucumber', dinner: 'turkey-patties', note: 'Первый день — только вернуть три приёма пищи. Окно не считаем.' },
      { breakfast: 'egg-veg-scramble', lunch: 'lentil-soup', dinner: 'baked-fish' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'chicken-buckwheat', note: 'Со среды возвращаем таймер, начиная с 12:12.' },
      { breakfast: 'oat-protein', lunch: 'tuna-bean', dinner: 'turkey-patties' },
      { breakfast: 'egg-veg-scramble', lunch: 'lentil-soup', dinner: 'baked-fish', snack: 'yogurt-nuts' },
      { breakfast: 'cottage-bowl', lunch: 'greek-feta', dinner: 'chicken-buckwheat' },
      { breakfast: 'egg-veg-scramble', lunch: 'chicken-broth-veg', dinner: 'turkey-patties', note: 'К воскресенью вы снова в прежнем режиме — без «отработки».' },
    ]),
    premium: false,
  },
];

/** Daily totals, summed from the recipes so the numbers cannot drift. */
export function dayMacros(day: PlanDay): Macros {
  const ids = [day.breakfast, day.lunch, day.dinner, day.snack].filter((id): id is string => Boolean(id));
  return ids.reduce<Macros>(
    (total, id) => {
      const recipe = recipeById(id);
      if (!recipe) return total;
      return {
        kcal: total.kcal + recipe.macros.kcal,
        protein: total.protein + recipe.macros.protein,
        fat: total.fat + recipe.macros.fat,
        carbs: total.carbs + recipe.macros.carbs,
        fiber: total.fiber + recipe.macros.fiber,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );
}

export function planAverage(plan: MealPlan): Macros {
  const totals = plan.days.map(dayMacros);
  const n = totals.length || 1;
  const sum = totals.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      fat: a.fat + b.fat,
      carbs: a.carbs + b.carbs,
      fiber: a.fiber + b.fiber,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );
  return {
    kcal: Math.round(sum.kcal / n),
    protein: Math.round(sum.protein / n),
    fat: Math.round(sum.fat / n),
    carbs: Math.round(sum.carbs / n),
    fiber: Math.round(sum.fiber / n),
  };
}

/** Every recipe a plan uses, for the shopping-minded. */
export function planRecipes(plan: MealPlan): readonly string[] {
  const seen = new Set<string>();
  for (const day of plan.days) {
    for (const id of [day.breakfast, day.lunch, day.dinner, day.snack]) {
      if (id) seen.add(id);
    }
  }
  return [...seen].filter((id) => RECIPES.some((recipe) => recipe.id === id));
}
