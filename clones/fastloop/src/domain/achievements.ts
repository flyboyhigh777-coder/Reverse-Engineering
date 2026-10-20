import { elapsedMs, isoDate, reachedGoal, startOfDay } from './fasting';
import { stepsTarget, waterTargetMl, weightSeries } from './metrics';
import { isRated } from './wellbeing';
import type { AppState, FastSession } from './types';

/**
 * Badges computed from the person's own records.
 *
 * Every one of them counts something that actually happened, so nothing here
 * can be unlocked by opening the app or by waiting. Progress is shown even
 * while locked, because a bar at 7/14 motivates and an opaque grey hexagon
 * does not.
 */

export type AchievementGroup = 'Серии' | 'Голодания' | 'Длительность' | 'Вес' | 'Привычки';

export const ACHIEVEMENT_GROUPS: readonly AchievementGroup[] = [
  'Серии',
  'Голодания',
  'Длительность',
  'Вес',
  'Привычки',
];

export interface Achievement {
  readonly id: string;
  readonly group: AchievementGroup;
  readonly title: string;
  readonly detail: string;
  readonly target: number;
  readonly current: number;
  readonly unit: string;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** The longest run of consecutive days that contain a finished fast. */
function bestStreak(done: readonly FastSession[]): number {
  const days = [...new Set(done.map((s) => isoDate(s.endedAt ?? s.startedAt)))].sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    const ts = startOfDay(new Date(`${day}T12:00:00`).getTime());
    run = previous !== null && ts - previous === DAY_MS ? run + 1 : 1;
    previous = ts;
    best = Math.max(best, run);
  }
  return best;
}

export function achievements(state: AppState, now: number): readonly Achievement[] {
  const done = state.history.filter((s) => s.endedAt !== null);
  const streak = bestStreak(done);
  const longestHours = done.reduce((max, s) => Math.max(max, elapsedMs(s, now) / HOUR_MS), 0);
  const goalsHit = done.filter(reachedGoal).length;
  const rated = done.filter(isRated).length;

  const series = weightSeries(state.weights);
  const lost = series.length >= 2 ? Math.max(0, series[0].kg - series[series.length - 1].kg) : 0;

  const waterGoal = waterTargetMl(state.profile.sex, state.profile.activity);
  const waterDays = state.days.filter((d) => d.waterMl >= waterGoal).length;
  const stepGoal = stepsTarget(state.profile.activity);
  const stepDays = state.days.filter((d) => d.steps >= stepGoal).length;

  const make = (
    id: string,
    group: AchievementGroup,
    title: string,
    detail: string,
    current: number,
    target: number,
    unit: string,
  ): Achievement => ({ id, group, title, detail, current: Math.floor(current), target, unit });

  return [
    make('streak-3', 'Серии', 'Три дня подряд', 'Самая трудная часть — начало.', streak, 3, 'дн.'),
    make('streak-7', 'Серии', 'Неделя', 'Семь дней подряд с завершённым голоданием.', streak, 7, 'дн.'),
    make('streak-14', 'Серии', 'Две недели', 'На этом сроке схема обычно перестаёт требовать усилий.', streak, 14, 'дн.'),
    make('streak-30', 'Серии', 'Месяц', 'Тридцать дней подряд.', streak, 30, 'дн.'),
    make('streak-60', 'Серии', 'Два месяца', 'Редкий результат: столько доходит меньшинство.', streak, 60, 'дн.'),

    make('count-1', 'Голодания', 'Первое', 'Одно завершённое голодание.', done.length, 1, 'шт.'),
    make('count-5', 'Голодания', 'Пятое', 'Пять завершённых.', done.length, 5, 'шт.'),
    make('count-20', 'Голодания', 'Двадцатое', 'Двадцать завершённых.', done.length, 20, 'шт.'),
    make('count-50', 'Голодания', 'Полсотни', 'Пятьдесят завершённых.', done.length, 50, 'шт.'),
    make('count-100', 'Голодания', 'Сотня', 'Сто завершённых голоданий.', done.length, 100, 'шт.'),
    make('goals-10', 'Голодания', 'Точно по плану', 'Десять раз дошли до цели, а не завершили раньше.', goalsHit, 10, 'раз'),
    make('goals-30', 'Голодания', 'Тридцать в цель', 'Тридцать голоданий доведены до конца.', goalsHit, 30, 'раз'),

    make('long-14', 'Длительность', '14 часов', 'Первое окно в четырнадцать часов.', longestHours, 14, 'ч'),
    make('long-16', 'Длительность', '16 часов', 'Самая изученная схема взята.', longestHours, 16, 'ч'),
    make('long-18', 'Длительность', '18 часов', 'Восемнадцать часов без еды.', longestHours, 18, 'ч'),
    make('long-20', 'Длительность', '20 часов', 'Двадцать часов. Дальше — осторожно.', longestHours, 20, 'ч'),
    make('long-24', 'Длительность', 'Сутки', 'Двадцать четыре часа — верхняя граница, которую ведёт приложение.', longestHours, 24, 'ч'),

    make('weight-first', 'Вес', 'Первое взвешивание', 'Одна запись ничего не значит, но с неё начинается линия.', state.weights.length, 1, 'зап.'),
    make('weight-10', 'Вес', 'Десять записей', 'Линия за несколько недель — вот что показывает правду.', state.weights.length, 10, 'зап.'),
    make('weight-30', 'Вес', 'Тридцать записей', 'Регулярность взвешиваний важнее их точности.', state.weights.length, 30, 'зап.'),
    make('lost-1', 'Вес', 'Минус килограмм', 'От первой записи.', lost, 1, 'кг'),
    make('lost-3', 'Вес', 'Минус три', 'От первой записи.', lost, 3, 'кг'),
    make('lost-5', 'Вес', 'Минус пять', 'От первой записи.', lost, 5, 'кг'),

    make('water-1', 'Привычки', 'Норма воды', 'Один день, когда вода набрана.', waterDays, 1, 'дн.'),
    make('water-7', 'Привычки', 'Неделя с водой', 'Семь дней с набранной нормой.', waterDays, 7, 'дн.'),
    make('water-30', 'Привычки', 'Месяц с водой', 'Тридцать таких дней.', waterDays, 30, 'дн.'),
    make('steps-1', 'Привычки', 'Дневная норма шагов', 'Один день с выполненной целью по шагам.', stepDays, 1, 'дн.'),
    make('steps-7', 'Привычки', 'Неделя на ногах', 'Семь дней с нормой шагов.', stepDays, 7, 'дн.'),
    make('steps-30', 'Привычки', 'Месяц на ногах', 'Тридцать дней с нормой шагов.', stepDays, 30, 'дн.'),
    make('rated-1', 'Привычки', 'Первая оценка', 'Отметили, как прошло голодание.', rated, 1, 'шт.'),
    make('rated-10', 'Привычки', 'Десять оценок', 'С этого места тренер начинает сравнивать окна между собой.', rated, 10, 'шт.'),
    make('rated-30', 'Привычки', 'Тридцать оценок', 'Достаточно данных, чтобы выводы были не случайными.', rated, 30, 'шт.'),
  ];
}

export function isUnlocked(item: Achievement): boolean {
  return item.current >= item.target;
}

export function unlockedCount(list: readonly Achievement[]): number {
  return list.filter(isUnlocked).length;
}

/** The closest few that are not yet unlocked — what to show as "next". */
export function nextUp(list: readonly Achievement[], count = 3): readonly Achievement[] {
  return list
    .filter((item) => !isUnlocked(item) && item.current > 0)
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, count);
}
