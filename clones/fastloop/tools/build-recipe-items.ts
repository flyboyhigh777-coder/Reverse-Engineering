import { writeFileSync } from 'node:fs';
import { RECIPES } from '/home/user/Reverse-Engineering/clones/fastloop/src/domain/recipes';
import { parseIngredient } from '/home/user/Reverse-Engineering/clones/fastloop/src/domain/ingredients';
import { foodById } from '/home/user/Reverse-Engineering/clones/fastloop/src/domain/foods';

type Draft = { name: string; grams: number; food: string | null };

/** Lines the parser cannot resolve, decided by hand once. */
const OVERRIDE: Record<string, Draft[]> = {};
/** Spices and herbs: shown in the list, contributing nothing measurable. */
const trace = (...lines: string[]) => {
  for (const l of lines) OVERRIDE[l] = [{ name: l, grams: 0, food: null }];
};
const set = (line: string, ...items: [string, number, string | null][]) => {
  OVERRIDE[line] = items.map(([name, grams, food]) => ({ name, grams, food }));
};

trace(
  'Соль, перец', 'Соль, чёрный перец', 'Соль', 'Соль, перец, тимьян', 'Соль, перец, хлопья чили',
  'Соль, перец, зира', 'Зира, соль', 'Зира, паприка', 'Паприка, зира', 'Паприка, лавровый лист',
  'Лавровый лист, перец горошком', 'Хмели-сунели, кориандр, соль', 'Хмели-сунели, соль, перец',
  'Корица', 'Корица по вкусу', 'Ванилин, корица', 'Вода, 1,2 л', 'Подсластитель по желанию',
  'Зира, барбарис, соль', 'Соль, перец, зелень', 'Чеснок, зира, соль, перец',
);

set('Соль, перец, петрушка', ['Зелень', 15, 'greens']);
set('Соль, перец, кинза', ['Кинза', 15, 'greens']);
set('Соль, зелень', ['Зелень', 20, 'greens']);
set('Лавровый лист, перец горошком, соль, укроп', ['Укроп', 10, 'greens']);
set('Чеснок, паприка, соль', ['Чеснок', 8, 'garlic']);
set('Чеснок, зелень, соль, перец', ['Чеснок', 8, 'garlic'], ['Зелень', 15, 'greens']);
set('Чеснок, 1 зубчик', ['Чеснок', 4, 'garlic']);
set('Чеснок, 2 зубчика', ['Чеснок', 8, 'garlic']);
set('Базилик (райхон)', ['Базилик', 10, 'greens']);
set('Зелень', ['Зелень', 20, 'greens']);
set('Петрушка', ['Петрушка', 20, 'greens']);
set('Зелёный лук', ['Зелёный лук', 15, 'greens']);
set('Укроп, зелёный лук', ['Укроп и зелёный лук', 20, 'greens']);
set('Укроп, кинза, зелёный лук', ['Зелень', 25, 'greens']);
set('Кинза, базилик', ['Зелень', 20, 'greens']);
set('Кинза, базилик, петрушка', ['Зелень', 25, 'greens']);
set('Кинза, большой пучок', ['Кинза', 40, 'greens']);
set('Кинза, зира, соль, перец', ['Кинза', 20, 'greens']);
set('Зелень, оливковое масло', ['Зелень', 20, 'greens'], ['Оливковое масло', 15, 'olive-oil']);
set('Укроп, зелёный лук, соль, горчица', ['Зелень', 20, 'greens'], ['Горчица', 10, 'mustard']);
set('Оливковое масло', ['Оливковое масло', 15, 'olive-oil']);
set('Оливковое масло, лимон', ['Оливковое масло', 15, 'olive-oil'], ['Лимонный сок', 15, 'lemon-juice']);
set('Оливковое масло, орегано', ['Оливковое масло', 15, 'olive-oil']);
set('Масло растительное', ['Растительное масло', 15, 'sunflower-oil']);
set('Сливочное или оливковое масло', ['Масло', 10, 'olive-oil']);
set('Кунжутное масло', ['Кунжутное масло', 5, 'sesame-oil']);
set('Лимон, чеснок', ['Лимонный сок', 20, 'lemon-juice'], ['Чеснок', 8, 'garlic']);
set('Лимонный сок', ['Лимонный сок', 15, 'lemon-juice']);
set('Винный уксус, соль', ['Винный уксус', 15, 'vinegar']);
set('Картофель, 1 шт.', ['Картофель', 150, 'potato-boiled']);
set('Картофель, 2 шт.', ['Картофель', 300, 'potato-boiled']);
set('Картофель, 3 небольших', ['Картофель', 330, 'potato-boiled']);
set('Картофель, 4 шт.', ['Картофель', 600, 'potato-boiled']);
set('Фасоль белая, 1 банка', ['Фасоль белая', 240, 'beans']);
set('Фасоль красная, 1 банка', ['Фасоль красная', 240, 'beans']);
set('Скумбрия, 2 шт.', ['Скумбрия', 500, 'mackerel']);
set('Кабачок, болгарский перец', ['Кабачок', 200, 'zucchini'], ['Болгарский перец', 120, 'pepper']);
set('Кабачок, 1 небольшой', ['Кабачок', 200, 'zucchini']);
set('Лук, морковь', ['Лук', 90, 'onion'], ['Морковь', 80, 'carrot']);
set('Лук, морковь, чеснок', ['Лук', 90, 'onion'], ['Морковь', 80, 'carrot'], ['Чеснок', 8, 'garlic']);
set('Морковь, сельдерей, лук', ['Морковь', 80, 'carrot'], ['Сельдерей', 40, 'celery'], ['Лук', 90, 'onion']);
set('Морковь, огурец, сельдерей', ['Морковь', 80, 'carrot'], ['Огурец', 100, 'cucumber'], ['Сельдерей', 40, 'celery']);
set('Соевый соус, имбирь, чеснок', ['Соевый соус', 15, 'soy-sauce'], ['Имбирь', 10, 'ginger'], ['Чеснок', 8, 'garlic']);
set('Соевый соус, 1 ст. л.', ['Соевый соус', 15, 'soy-sauce']);
set('Тахини, 2 ст. л.', ['Паста тахини', 30, 'tahini']);
set('Редис, 4 шт.', ['Редис', 60, 'radish']);
set('Редис, 6 шт.', ['Редис', 90, 'radish']);
set('Острый перец, по желанию', ['Острый перец', 10, 'chili']);
set('Свёкла, 2 средних', ['Свёкла', 300, 'beet']);
set('Домашняя лапша, 120 г', ['Домашняя лапша', 120, 'pasta-dry']);
set('Солёные огурцы, 3 шт.', ['Солёные огурцы', 240, 'pickled-cucumber']);
set('Маслины', ['Маслины', 40, 'olives']);

// Water and broth: "Вода" matched vodka, which put 1067 kcal in a chicken broth.
set('Вода, 1,2 л', ['Вода', 1200, 'water']);
set('Холодная вода, 150 мл', ['Холодная вода', 150, 'water']);
set('Бульон или вода, 700 мл', ['Бульон', 700, 'broth']);
set('Вода, 1,5 л', ['Вода', 1500, 'water']);

// Dry weights, stated as such in the recipe.
set('Чечевица красная, 250 г', ['Чечевица красная, сухая', 250, 'lentils-dry']);
set('Нут сухой, 250 г', ['Нут сухой', 250, 'chickpeas-dry']);
set('Нут сухой, 200 г (замочить с вечера)', ['Нут сухой', 200, 'chickpeas-dry']);
set('Нут сухой, 120 г (замочить с вечера)', ['Нут сухой', 120, 'chickpeas-dry']);
set('Фасоль красная сухая, 300 г', ['Фасоль красная, сухая', 300, 'beans-dry']);
set('Гречка, 140 г', ['Гречка сухая', 140, 'buckwheat-dry']);
set('Гречка, 150 г', ['Гречка сухая', 150, 'buckwheat-dry']);
set('Рис девзира или лазер, 200 г', ['Рис сухой', 200, 'rice-dry']);
set('Рис, 200 г', ['Рис сухой', 200, 'rice-dry']);
set('Перловка, 100 г', ['Перловка сухая', 100, 'barley-dry']);
set('Растительное масло, 1 ст. л.', ['Растительное масло', 15, 'sunflower-oil']);
set('Растительное масло, 1 ч. л.', ['Растительное масло', 5, 'sunflower-oil']);
set('Катык или кефир 2,5%, 600 мл', ['Катык', 600, 'katyk']);
set('Кефир 1%, 600 мл', ['Кефир 1%', 600, 'kefir-1']);

const out: string[] = [];
const report: string[] = [];
let unresolved = 0;

for (const recipe of RECIPES) {
  const items: Draft[] = [];
  for (const line of recipe.ingredients) {
    if (line in OVERRIDE) {
      items.push(...OVERRIDE[line]);
      continue;
    }
    const parsed = parseIngredient(line);
    if (parsed.food && parsed.grams !== null) {
      items.push({ name: parsed.name, grams: Math.round(parsed.grams), food: parsed.food.id });
    } else {
      unresolved += 1;
      report.push(`  НЕ РАЗОБРАНО  ${recipe.id}: ${line}`);
    }
  }

  const total = items.reduce(
    (sum, item) => {
      const food = item.food ? foodById(item.food) : undefined;
      if (!food) return sum;
      const k = item.grams / 100;
      return {
        kcal: sum.kcal + food.per100g.kcal * k,
        protein: sum.protein + food.per100g.protein * k,
        fat: sum.fat + food.per100g.fat * k,
        carbs: sum.carbs + food.per100g.carbs * k,
        fiber: sum.fiber + food.per100g.fiber * k,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
  );
  const per = (v: number) => v / recipe.servings;
  const computed = {
    kcal: Math.round(per(total.kcal)),
    protein: Math.round(per(total.protein)),
    fat: Math.round(per(total.fat)),
    carbs: Math.round(per(total.carbs)),
    fiber: Math.round(per(total.fiber) * 10) / 10,
  };
  const drift = recipe.macros.kcal === 0 ? 0 : Math.round(((computed.kcal - recipe.macros.kcal) / recipe.macros.kcal) * 100);
  report.push(
    `${String(drift).padStart(5)}%  ${recipe.id.padEnd(20)} было ${String(recipe.macros.kcal).padStart(4)} → стало ${String(computed.kcal).padStart(4)} ккал  (Б${computed.protein} Ж${computed.fat} У${computed.carbs})`,
  );

  out.push(`  '${recipe.id}': {
    items: [
${items.map((i) => `      { name: '${i.name.replace(/'/g, "\\'")}', grams: ${i.grams}, food: ${i.food ? `'${i.food}'` : 'null'} },`).join('\n')}
    ],
    macros: { kcal: ${computed.kcal}, protein: ${computed.protein}, fat: ${computed.fat}, carbs: ${computed.carbs}, fiber: ${computed.fiber} },
  },`);
}

console.log(report.join('\n'));
console.log(`\nнеразобранных строк осталось: ${unresolved}`);
writeFileSync('/tmp/bt/items.txt', out.join('\n'));
