import { ARTICLES } from './articles';
import type { Article } from './articles';
import { elapsedMs, formatHoursShort, goalMs, isoDate, reachedGoal, startOfDay } from './fasting';
import { stepsTarget, waterTargetMl } from './metrics';
import { isRated } from './wellbeing';
import type { AppState } from './types';

/**
 * The day's checklist and the day's reading.
 *
 * Everything here is derived from records the person actually made — there is
 * no task that completes itself by opening the app, and no streak that counts
 * taps. The point of the list is to make "what is left today" answerable in
 * one glance, not to manufacture activity.
 */

export type TaskId = 'fast' | 'water' | 'steps' | 'weight' | 'rate';

export type TaskTone = 'fast' | 'water' | 'steps' | 'weight' | 'rate';

export interface DailyTask {
  readonly id: TaskId;
  readonly title: string;
  /** What finishing it means, in one line. */
  readonly hint: string;
  readonly current: number;
  readonly target: number;
  readonly unit: string;
  readonly done: boolean;
  readonly tone: TaskTone;
  /** Shown instead of the bare count when a number would say less. */
  readonly note?: string;
}

export function dailyTasks(state: AppState, now: number): readonly DailyTask[] {
  const today = isoDate(now);
  const day = state.days.find((d) => d.date === today);
  const waterGoal = waterTargetMl(state.profile.sex, state.profile.activity);
  const stepGoal = stepsTarget(state.profile.activity);

  const tasks: DailyTask[] = [];

  if (!state.observationMode) {
    const finishedToday = state.history.filter((s) => s.endedAt !== null && isoDate(s.endedAt) === today);
    const hitToday = finishedToday.some(reachedGoal);
    const running = state.current;
    const note = running
      ? `идёт · ${formatHoursShort(elapsedMs(running, now))} из ${formatHoursShort(goalMs(running))}`
      : finishedToday.length > 0
        ? formatHoursShort(Math.max(...finishedToday.map((session) => elapsedMs(session, now))))
        : 'не начато';
    tasks.push({
      id: 'fast',
      title: 'Голодание',
      note,
      hint: hitToday
        ? 'Окно закрыто по плану.'
        : finishedToday.length > 0
          ? 'Голодание завершено раньше цели — это тоже запись.'
          : running
            ? 'Таймер идёт.'
            : 'Запустите таймер, когда закончите есть.',
      current: hitToday || finishedToday.length > 0 ? 1 : running ? 0 : 0,
      target: 1,
      unit: '',
      done: finishedToday.length > 0,
      tone: 'fast',
    });
  }

  tasks.push({
    id: 'water',
    title: 'Вода',
    hint: 'Ориентир на день, а не норма.',
    current: day?.waterMl ?? 0,
    target: waterGoal,
    unit: 'мл',
    done: (day?.waterMl ?? 0) >= waterGoal,
    tone: 'water',
  });

  tasks.push({
    id: 'steps',
    title: 'Шаги',
    hint: 'Движение держит мышцы, пока вес снижается.',
    current: day?.steps ?? 0,
    target: stepGoal,
    unit: '',
    done: (day?.steps ?? 0) >= stepGoal,
    tone: 'steps',
  });

  const weighedToday = state.weights.some((w) => w.date === today);
  tasks.push({
    id: 'weight',
    title: 'Вес',
    hint: weighedToday ? 'Записано сегодня.' : 'Утром, после туалета, до еды — так сравнимо.',
    current: weighedToday ? 1 : 0,
    target: 1,
    unit: '',
    done: weighedToday,
    tone: 'weight',
  });

  if (!state.observationMode) {
    const pending = state.pendingRatingId !== null;
    const ratedToday = state.history.some(
      (s) => s.endedAt !== null && isoDate(s.endedAt) === today && isRated(s),
    );
    if (pending || ratedToday) {
      tasks.push({
        id: 'rate',
        title: 'Самочувствие',
        hint: ratedToday ? 'Оценка записана.' : 'Тренер сравнивает окна только по вашим оценкам.',
        current: ratedToday ? 1 : 0,
        target: 1,
        unit: '',
        done: ratedToday,
        tone: 'rate',
      });
    }
  }

  return tasks;
}

export interface DailyProgress {
  readonly done: number;
  readonly total: number;
  readonly ratio: number;
}

export function dailyProgress(tasks: readonly DailyTask[]): DailyProgress {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, ratio: tasks.length === 0 ? 0 : done / tasks.length };
}

/** 0…1 for the task's own bar. Binary tasks jump; counted ones fill. */
export function taskRatio(task: DailyTask): number {
  if (task.target <= 0) return task.done ? 1 : 0;
  return Math.min(1, task.current / task.target);
}

/* ───────────────────────────── the day's reading ───────────────────────── */

/**
 * A stable per-day index. The same day always gives the same card, so the
 * screen does not reshuffle when the app is reopened, and consecutive days
 * do not repeat until the whole deck has been through.
 */
function dayIndex(now: number, length: number): number {
  const days = Math.floor(startOfDay(now) / 86_400_000);
  return length === 0 ? 0 : ((days % length) + length) % length;
}

export interface DailyNote {
  readonly text: string;
  readonly source: string;
}

/**
 * Short practice notes. Each one is a statement the library already defends
 * at length — this is the same knowledge cut to a size that fits a morning.
 */
const NOTES: readonly DailyNote[] = [
  {
    text: 'Первые выходы из голодания решают больше, чем сам голод: начните с супа, овощей или кефира, а не с жирного и сладкого.',
    source: 'Как выходить из голодания',
  },
  {
    text: 'Чёрный кофе, чай без сахара и вода окно не ломают. Ломает всё, в чём есть калории, — включая молоко в кофе.',
    source: 'Что можно пить в окне',
  },
  {
    text: 'Белок в первый приём пищи после окна снижает вечерний перебор лучше, чем любое волевое усилие.',
    source: 'Белок и мышцы',
  },
  {
    text: 'Голод приходит волнами по 20–30 минут и уходит сам. Это не сигнал о дефиците, а привычка организма к расписанию.',
    source: 'Почему голод волнами',
  },
  {
    text: 'Схема, которую вы держите месяц, лучше схемы, которую бросаете на третий день. Поднимайте ступень только когда текущая даётся легко.',
    source: 'Лестница схем',
  },
  {
    text: 'Вес прыгает на ±1,5 кг за сутки от воды и соли. Смотрите на линию за две недели, а не на сегодняшнюю цифру.',
    source: 'Как читать свой вес',
  },
  {
    text: 'Силовая нагрузка 2 раза в неделю сохраняет мышцы при снижении веса. Без неё часть потерянного — мышцы, а не жир.',
    source: 'Тренировки и голодание',
  },
  {
    text: 'Последний приём пищи за 3 часа до сна: поздний ужин ухудшает глубину сна, а короткий сон усиливает голод назавтра.',
    source: 'Сон и окно',
  },
  {
    text: 'Больше 1 кг в неделю — это не успех, а риск: при быстром снижении веса растёт вероятность камней в жёлчном пузыре.',
    source: 'Безопасная скорость',
  },
  {
    text: 'Свежевыжатый овощной сок — мягкий способ начать есть после долгого окна, но это всё ещё еда: окно он закрывает.',
    source: 'Соки и выход',
  },
  {
    text: 'Соль в окне голодания нужна не всем, но при слабости и головной боли щепотка в воде часто снимает их за 15 минут.',
    source: 'Электролиты',
  },
  {
    text: 'Головная боль в первые дни — обычно кофеин и обезвоживание, а не «очищение». Вода и привычная доза кофе решают.',
    source: 'Первая неделя',
  },
  {
    text: 'Шаги работают там, где тренировки не успевают: 8–10 тысяч в день дают больше суточного расхода, чем час в зале.',
    source: 'Движение каждый день',
  },
  {
    text: 'Если окно срывается на одном и том же часе — двигайте его, а не терпите. Расписание под жизнь, а не наоборот.',
    source: 'Как выбрать своё окно',
  },
];

export interface DailyBrief {
  readonly note: DailyNote;
  readonly article: Article;
  readonly date: string;
}

export function dailyBrief(now: number, premium: boolean): DailyBrief {
  const pool = premium ? ARTICLES : ARTICLES.filter((a) => !a.premium);
  const articles = pool.length > 0 ? pool : ARTICLES;
  return {
    note: NOTES[dayIndex(now, NOTES.length)],
    article: articles[dayIndex(now + 86_400_000, articles.length)],
    date: isoDate(now),
  };
}
