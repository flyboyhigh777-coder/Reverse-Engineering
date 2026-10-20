import { isoDate } from './fasting';
import type { AppState } from './types';

/**
 * The first week, written as instructions rather than as an article.
 *
 * The library explains why things work; this says what to do today. The ramp
 * is deliberately slow — 12:12 before 14:10 before 16:8 — because the common
 * failure is not weak will, it is starting three steps too high and quitting
 * on day three.
 */

export interface BeginnerDay {
  readonly day: number;
  readonly title: string;
  /** The one thing to do. */
  readonly task: string;
  /** What the body usually does on this day, so it is not a surprise. */
  readonly expect: string;
  /** The mistake that ends most first weeks at this point. */
  readonly mistake: string;
}

export const BEGINNER_WEEK: readonly BeginnerDay[] = [
  {
    day: 1,
    title: 'Посчитайте, как вы едите сейчас',
    task: 'Ничего не меняйте. Запишите время первого и последнего приёма пищи за день — это и есть ваше текущее окно.',
    expect: 'У большинства выходит 13–15 часов еды в сутки. Это не провал, это точка отсчёта.',
    mistake: 'Начать сразу с 16:8 «с понедельника». Организм отвечает срывом, а вы делаете вывод, что метод не ваш.',
  },
  {
    day: 2,
    title: 'Сдвиньте ужин на час раньше',
    task: 'Закончите есть на час раньше, чем вчера. Завтрак оставьте прежним.',
    expect: 'Вечером будет хотеться перекусить по привычке, а не от голода. Разница заметна: привычный голод проходит за 15 минут с чашкой чая.',
    mistake: 'Компенсировать ранний ужин плотным поздним перекусом «последний раз».',
  },
  {
    day: 3,
    title: 'Окно 12:12',
    task: 'Двенадцать часов без еды, двенадцать — с едой. Например, еда с 8:00 до 20:00.',
    expect: 'Почти ничего не чувствуется: большая часть окна приходится на сон.',
    mistake: 'Считать это слишком лёгким и перепрыгнуть на 16:8. Лестница работает именно потому, что ступени низкие.',
  },
  {
    day: 4,
    title: 'Вода и кофе внутри окна',
    task: 'Проверьте, что пьёте достаточно: вода, чёрный кофе, чай без сахара. Молоко в кофе — уже калории.',
    expect: 'Головная боль в первые дни — это обычно кофеин и обезвоживание, а не «очищение организма».',
    mistake: 'Пить «ноль калорий» всё подряд. Сладкий вкус без калорий усиливает тягу у многих людей.',
  },
  {
    day: 5,
    title: 'Белок в первый приём',
    task: 'Первое, что вы едите после окна, должно содержать 25–35 г белка: творог, яйца, рыба, курица, бобовые.',
    expect: 'Вечерний перебор станет заметно слабее — это самый воспроизводимый эффект за всю первую неделю.',
    mistake: 'Начинать окно со сладкого или выпечки. Через полтора часа голод возвращается сильнее, чем был.',
  },
  {
    day: 6,
    title: 'Окно 14:10',
    task: 'Четырнадцать часов без еды. Проще всего убрать завтрак на час позже, а не ужин ещё раньше.',
    expect: 'Голод приходит волнами по 20–30 минут и уходит сам, даже если ничего не съесть.',
    mistake: 'Терпеть до слабости и головокружения. Это не выдержка, а сигнал закончить окно и поесть.',
  },
  {
    day: 7,
    title: 'Решите, что дальше',
    task: 'Если 14:10 далось без усилий — держите его ещё неделю. Если было тяжело — вернитесь на 12:12. К 16:8 переходят те, у кого 14:10 стало незаметным.',
    expect: 'Вес на весах за неделю почти ничего не скажет: колебания воды больше любого реального изменения.',
    mistake: 'Оценивать результат по весам на седьмой день и бросать. Смотреть имеет смысл минимум через три недели.',
  },
];

/** Plain rules that hold through the whole first month. */
export const BEGINNER_RULES: readonly string[] = [
  'Окно подстраивают под жизнь, а не жизнь под окно. Если ужин с семьёй в девять — значит, окно заканчивается в девять.',
  'Пропущенный день не отменяет прогресс. Отменяет его только решение «раз сорвался, то всё».',
  'Голод и слабость — разные вещи. Голод терпят, слабость, дрожь и потемнение в глазах — нет: это сигнал поесть.',
  'Вес смотрят по линии за две недели, а не по сегодняшней цифре: суточные колебания воды доходят до полутора килограммов.',
  'Больше килограмма в неделю — не быстрее, а рискованнее: при резком снижении веса растёт вероятность камней в жёлчном пузыре.',
  'Если принимаете лекарства, привязанные к еде, порядок окна обсуждают с врачом до начала, а не после.',
];

/**
 * Which day of the guide the person is on, by their own records.
 * Counted from the first day with any record, capped at the last day — the
 * guide does not reset and does not nag.
 */
export function beginnerDay(state: AppState, now: number): number {
  const stamps: number[] = [];
  for (const session of state.history) stamps.push(session.startedAt);
  if (state.current) stamps.push(state.current.startedAt);
  for (const entry of state.weights) stamps.push(new Date(`${entry.date}T12:00:00`).getTime());
  if (stamps.length === 0) return 1;
  const first = new Date(`${isoDate(Math.min(...stamps))}T12:00:00`).getTime();
  const today = new Date(`${isoDate(now)}T12:00:00`).getTime();
  const days = Math.floor((today - first) / 86_400_000) + 1;
  return Math.min(BEGINNER_WEEK.length, Math.max(1, days));
}
