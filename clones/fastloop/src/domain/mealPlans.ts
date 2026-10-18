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

export type PlanGoal =
  | 'Старт' | 'Белок' | 'Бюджет' | 'Без готовки' | 'Вегетарианское' | 'Возвращение'
  | 'Мало углеводов' | 'Тренировки' | 'Раннее окно' | 'Смены' | 'Рамадан' | 'Клетчатка';

export type PlanSection = 'С чего начать' | 'Снижение веса' | 'Под ваш ритм' | 'Особые задачи';

export const PLAN_SECTIONS: readonly PlanSection[] = ['С чего начать', 'Снижение веса', 'Под ваш ритм', 'Особые задачи'];

/** Meal slot names, overridden where a day is not shaped like a normal one. */
export const DEFAULT_SLOTS = ['Завтрак', 'Обед', 'Ужин', 'Перекус'] as const;

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
  readonly section: PlanSection;
  readonly slots?: readonly [string, string, string, string];
  readonly lede: string;
  readonly about: string;
  readonly art:
    | 'sunrise' | 'protein' | 'coin' | 'clock' | 'sprout' | 'return'
    | 'sunset' | 'run' | 'lowcarb' | 'crescent' | 'night' | 'grain';
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
    section: 'С чего начать',
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
    section: 'Снижение веса',
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
    section: 'С чего начать',
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
    section: 'С чего начать',
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
    section: 'Особые задачи',
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
    section: 'Особые задачи',
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
  {
    id: 'low-carb',
    section: 'Снижение веса',
    title: 'Низкоуглеводная неделя',
    goal: 'Мало углеводов',
    lede: 'Без крупы и хлеба, но и без кето-крайностей',
    about:
      'Углеводы сокращены до овощей, не до нуля. Это не кетогенная диета: в неё не входят ни жёсткое ограничение до 20–50 г, ни её побочные эффекты. Если вам легче без гарниров — эта неделя для вас; если нет, принудительно себя в неё загонять незачем, в прямых сравнениях выигрыша у низкоуглеводных схем над обычным дефицитом не видно.',
    art: 'lowcarb',
    days: week([
      { breakfast: 'cottage-omelette', lunch: 'tuna-egg', dinner: 'chicken-broccoli', snack: 'cottage-cucumber' },
      { breakfast: 'egg-veg-scramble', lunch: 'chicken-cabbage', dinner: 'baked-fish', snack: 'egg-avocado' },
      { breakfast: 'cottage-omelette', lunch: 'tuna-egg', dinner: 'turkey-patties', snack: 'yogurt-nuts' },
      { breakfast: 'egg-veg-scramble', lunch: 'broccoli-cream', dinner: 'chicken-broccoli', snack: 'cottage-cucumber' },
      { breakfast: 'cottage-omelette', lunch: 'chicken-cabbage', dinner: 'baked-fish', snack: 'egg-avocado' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-egg', dinner: 'turkey-patties', snack: 'yogurt-nuts' },
      { breakfast: 'cottage-omelette', lunch: 'broccoli-cream', dinner: 'chicken-broccoli', snack: 'cottage-cucumber', note: 'Если появились головная боль и вялость — это обычно нехватка соли и воды, а не «очищение».' },
    ]),
    premium: true,
  },
  {
    id: 'training',
    section: 'Снижение веса',
    title: 'Неделя с силовыми',
    goal: 'Тренировки',
    lede: 'Два занятия в неделю и питание вокруг них',
    about:
      'Силовые не меняют цифру на весах, но меняют её состав: в мета-анализе они компенсировали около 93% потери тощей массы при дефиците. В дни тренировок здесь больше углеводов и белка, в остальные — спокойнее.',
    art: 'run',
    days: week([
      { breakfast: 'oat-protein', lunch: 'chicken-buckwheat', dinner: 'chicken-broccoli', snack: 'yogurt-nuts', note: 'День силовой: полный набор, углеводы не урезаем.' },
      { breakfast: 'cottage-omelette', lunch: 'tuna-egg', dinner: 'turkey-patties', snack: 'cottage-cucumber' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-cabbage', dinner: 'baked-fish', snack: 'egg-avocado' },
      { breakfast: 'oat-protein', lunch: 'chicken-buckwheat', dinner: 'beef-stew', snack: 'yogurt-nuts', note: 'Вторая силовая. Белок в приёме после тренировки — приоритет.' },
      { breakfast: 'egg-veg-scramble', lunch: 'tuna-bean', dinner: 'chicken-broccoli', snack: 'cottage-cucumber' },
      { breakfast: 'cottage-bowl', lunch: 'greek-feta', dinner: 'turkey-patties', snack: 'hummus-veg' },
      { breakfast: 'shakshuka', lunch: 'lentil-soup', dinner: 'baked-fish', snack: 'yogurt-nuts', note: 'День прогулки, а не зала. Ходьба после ужина — тоже тренировка.' },
    ]),
    premium: true,
  },
  {
    id: 'early-window',
    section: 'Под ваш ритм',
    title: 'Неделя раннего окна',
    goal: 'Раннее окно',
    lede: 'Основная еда до вечера — для тех, кому мешает поздний ужин',
    about:
      'Последний приём пищи близко ко сну — правдоподобный, хотя и спорный фактор. В исследовании на рефлюкс еда за два часа до сна давала достоверно больше симптомов, чем за шесть. Эта неделя смещает объём на первую половину дня: плотный завтрак, нормальный обед, лёгкий ранний ужин.',
    art: 'sunset',
    days: week([
      { breakfast: 'shakshuka', lunch: 'chicken-buckwheat', dinner: 'cottage-cucumber', note: 'Ужин ставим за три часа до отбоя и больше не двигаем.' },
      { breakfast: 'oat-protein', lunch: 'beef-stew', dinner: 'greek-feta' },
      { breakfast: 'cottage-omelette', lunch: 'chicken-broccoli', dinner: 'broccoli-cream' },
      { breakfast: 'shakshuka', lunch: 'tuna-bean', dinner: 'cottage-cucumber' },
      { breakfast: 'oat-protein', lunch: 'chicken-buckwheat', dinner: 'greek-feta' },
      { breakfast: 'cottage-bowl', lunch: 'beef-stew', dinner: 'broccoli-cream' },
      { breakfast: 'shakshuka', lunch: 'chicken-cabbage', dinner: 'cottage-cucumber', note: 'Если к ночи тянет на кухню — смотрите не на вечер, а на объём обеда.' },
    ]),
    premium: true,
  },
  {
    id: 'shift-work',
    section: 'Под ваш ритм',
    title: 'Неделя для сменного графика',
    goal: 'Смены',
    lede: 'Окно привязано к смене, а не к часам на стене',
    about:
      'Связь сменной работы с нарушениями обмена установлена, а готовых схем окна для неё нет. Принцип один: окно привязывают к рабочему циклу. Здесь «завтрак» — первый приём после пробуждения, когда бы оно ни случилось, а «ужин» — последний перед сном.',
    art: 'night',
    slots: ['После пробуждения', 'Середина смены', 'Перед сном', 'В смену'],
    days: week([
      { breakfast: 'cottage-omelette', lunch: 'chicken-broccoli', dinner: 'cottage-cucumber', snack: 'yogurt-nuts', note: 'Главное правило смен: не есть плотно прямо перед сном, в какое бы время он ни начинался.' },
      { breakfast: 'oat-protein', lunch: 'tuna-egg', dinner: 'broccoli-cream', snack: 'egg-avocado' },
      { breakfast: 'egg-veg-scramble', lunch: 'chicken-buckwheat', dinner: 'cottage-cucumber', snack: 'hummus-veg' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-broccoli', dinner: 'greek-feta', snack: 'yogurt-nuts' },
      { breakfast: 'cottage-omelette', lunch: 'tuna-bean', dinner: 'broccoli-cream', snack: 'cottage-cucumber' },
      { breakfast: 'oat-protein', lunch: 'turkey-patties', dinner: 'chicken-cabbage', snack: 'egg-avocado' },
      { breakfast: 'kefir-bran', lunch: 'lentil-soup', dinner: 'baked-fish', snack: 'yogurt-nuts', note: 'В ночные смены кофе — до середины смены, иначе он съест дневной сон.' },
    ]),
    premium: true,
  },
  {
    id: 'ramadan',
    section: 'Под ваш ритм',
    title: 'Рамадан',
    goal: 'Рамадан',
    lede: 'Сухур и ифтар так, чтобы хватило белка и воды',
    about:
      'Дневной пост с ограничением воды — это не 16:8, и как способ похудеть он не работает: потеря около килограмма в исследованиях возвращалась через две-пять недель. Задача недели другая — не потерять мышцы и не проводить день обезвоженным. Белок в сухуре, вода между ифтаром и сухуром, разговение без сахара первым блюдом.',
    art: 'crescent',
    slots: ['Сухур', 'Ифтар', 'Поздний приём', 'После ифтара'],
    days: week([
      { breakfast: 'cottage-bowl', lunch: 'chicken-broth-veg', dinner: 'chicken-buckwheat', snack: 'yogurt-nuts', note: 'Разговение начинайте с жидкого и белкового, а не со сладкого.' },
      { breakfast: 'cottage-omelette', lunch: 'lentil-soup', dinner: 'turkey-patties', snack: 'kefir-bran' },
      { breakfast: 'oat-protein', lunch: 'chicken-broth-veg', dinner: 'baked-fish', snack: 'yogurt-nuts' },
      { breakfast: 'cottage-bowl', lunch: 'lentil-soup', dinner: 'chicken-broccoli', snack: 'kefir-bran' },
      { breakfast: 'cottage-omelette', lunch: 'chicken-broth-veg', dinner: 'beef-stew', snack: 'yogurt-nuts' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'chicken-buckwheat', snack: 'kefir-bran' },
      { breakfast: 'cottage-bowl', lunch: 'chicken-broth-veg', dinner: 'turkey-patties', snack: 'yogurt-nuts', note: 'При диабете пост обсуждают с врачом до начала месяца — есть калькулятор риска IDF-DAR.' },
    ]),
    premium: false,
  },
  {
    id: 'high-fiber',
    section: 'Особые задачи',
    title: 'Неделя высокой клетчатки',
    goal: 'Клетчатка',
    lede: 'Когда окно даётся тяжело и к вечеру сносит',
    about:
      'Клетчатка даёт объём почти без калорий — это самый дешёвый способ сделать короткое окно переносимым. Увеличивайте постепенно: вздутие в первые дни обычное дело, и воды нужно больше.',
    art: 'grain',
    days: week([
      { breakfast: 'kefir-bran', lunch: 'lentil-soup', dinner: 'beef-stew', snack: 'hummus-veg' },
      { breakfast: 'oat-protein', lunch: 'tuna-bean', dinner: 'chicken-broccoli', snack: 'hummus-veg' },
      { breakfast: 'kefir-bran', lunch: 'lentil-soup', dinner: 'tofu-stirfry', snack: 'egg-avocado' },
      { breakfast: 'shakshuka', lunch: 'greek-feta', dinner: 'beef-stew', snack: 'hummus-veg' },
      { breakfast: 'kefir-bran', lunch: 'tuna-bean', dinner: 'chicken-buckwheat', snack: 'hummus-veg' },
      { breakfast: 'oat-protein', lunch: 'lentil-soup', dinner: 'tofu-stirfry', snack: 'egg-avocado' },
      { breakfast: 'shakshuka', lunch: 'beet-walnut', dinner: 'chicken-broccoli', snack: 'hummus-veg', note: 'Если тяжесть не проходит за неделю — снижайте объём клетчатки, это не всем подходит.' },
    ]),
    premium: true,
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
