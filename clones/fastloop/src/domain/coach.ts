import { elapsedMs, isoDate, reachedGoal, startOfDay } from './fasting';
import { fastStats, stepsTarget, waterTargetMl, weightSeries } from './metrics';
import { resolvePlan } from './plans';
import { byWindowLength, isRated } from './wellbeing';
import type { AppState, FastSession } from './types';

/**
 * Advice from the person's own records, computed on device.
 *
 * Deliberately not a chat bot: every line here can name the rows it came
 * from, which a generated answer cannot. Anything the data does not support
 * simply is not shown — an empty coach is better than a confident guess.
 */

export type Tone = 'good' | 'info' | 'warn';

export interface Insight {
  readonly id: string;
  readonly tone: Tone;
  readonly title: string;
  readonly body: string;
  /** Rough importance; the home screen shows the strongest few. */
  readonly weight: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const WEEKDAY = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

function finished(state: AppState): readonly FastSession[] {
  return state.history.filter((s) => s.endedAt !== null);
}

function within(sessions: readonly FastSession[], now: number, days: number): readonly FastSession[] {
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  return sessions.filter((s) => (s.endedAt ?? 0) >= from);
}

export function coachInsights(state: AppState, now: number): readonly Insight[] {
  const out: Insight[] = [];
  const done = finished(state);
  const week = within(done, now, 7);
  const stats = fastStats(state.history, now);
  const plan = resolvePlan(state.planId, state.customFastHours);
  const goalMs = plan.fastHours * HOUR_MS;

  // ── Streak
  if (stats.streak >= 3) {
    out.push({
      id: 'streak',
      tone: 'good',
      title: `Серия: ${stats.streak} дн.`,
      body: 'Регулярность важнее длины отдельного окна — именно она двигает вес.',
      weight: 40,
    });
  }

  // ── Average against the goal
  if (week.length >= 3) {
    const mean = week.reduce((sum, s) => sum + elapsedMs(s, now), 0) / week.length;
    const diff = (mean - goalMs) / HOUR_MS;
    if (diff <= -1) {
      out.push({
        id: 'short',
        tone: 'warn',
        title: `В среднем на ${Math.abs(diff).toFixed(1)} ч короче цели`,
        body: `За неделю выходит ${(mean / HOUR_MS).toFixed(1)} ч при цели ${plan.fastHours}. Это не провал — возможно, окно просто выбрано длиннее, чем подходит сейчас.`,
        weight: 80,
      });
    } else if (diff >= 0) {
      out.push({
        id: 'ontrack',
        tone: 'good',
        title: 'Неделя идёт по плану',
        body: `Средняя длительность ${(mean / HOUR_MS).toFixed(1)} ч при цели ${plan.fastHours} ч.`,
        weight: 30,
      });
    }
  }

  // ── The weekday that keeps breaking
  if (done.length >= 6) {
    const missesByDay = new Map<number, { miss: number; total: number }>();
    for (const session of done) {
      const day = new Date(session.startedAt).getDay();
      const entry = missesByDay.get(day) ?? { miss: 0, total: 0 };
      entry.total += 1;
      if (!reachedGoal(session)) entry.miss += 1;
      missesByDay.set(day, entry);
    }
    const worst = [...missesByDay.entries()]
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => b[1].miss / b[1].total - a[1].miss / a[1].total)[0];
    if (worst && worst[1].miss / worst[1].total >= 0.5) {
      out.push({
        id: 'weekday',
        tone: 'info',
        title: `Чаще всего срывается в ${WEEKDAY[worst[0]]}`,
        body: 'Поставьте на этот день схему покороче в расписании — короткое окно лучше пропущенного дня.',
        weight: 70,
      });
    }
  }

  // ── What the ratings actually say about window length
  const energy = byWindowLength(done, (w) => w.energy).filter((row) => row.count >= 2);
  if (energy.length >= 2) {
    const best = [...energy].sort((a, b) => b.mean - a.mean)[0];
    const worst = [...energy].sort((a, b) => a.mean - b.mean)[0];
    if (best.mean - worst.mean >= 0.8) {
      out.push({
        id: 'energy-window',
        tone: 'info',
        title: `Лучше всего вы себя чувствуете на ${best.hours} ч`,
        body: `Средняя оценка энергии ${best.mean.toFixed(1)} из 5 против ${worst.mean.toFixed(1)} на ${worst.hours} ч. Это ваши собственные отметки, а не общая рекомендация.`,
        weight: 90,
      });
    }
  }

  const hunger = byWindowLength(done, (w) => w.hunger).filter((row) => row.count >= 2);
  const hardest = [...hunger].sort((a, b) => b.mean - a.mean)[0];
  if (hardest && hardest.mean >= 4 && hardest.hours >= plan.fastHours) {
    out.push({
      id: 'hunger',
      tone: 'warn',
      title: `На ${hardest.hours} ч голод даётся тяжело`,
      body: 'Проверьте белок в первом приёме пищи: он держит сытость дольше всего. Если не помогает — окно стоит укоротить.',
      weight: 75,
    });
  }

  // ── Water
  const days = state.days.filter((d) => d.date >= isoDate(startOfDay(now) - 6 * DAY_MS));
  const target = waterTargetMl(state.profile.sex, state.profile.activity);
  const dry = days.filter((d) => d.waterMl < target * 0.7).length;
  if (days.length >= 4 && dry >= 3) {
    out.push({
      id: 'water',
      tone: 'warn',
      title: `Воды не хватает ${dry} дн. из ${days.length}`,
      body: `Норма по вашему весу — около ${target} мл. В окне голодания вода ещё и притупляет чувство голода.`,
      weight: 60,
    });
  }

  // ── Steps
  const stepGoal = stepsTarget(state.profile.activity);
  const active = days.filter((d) => d.steps >= stepGoal * 0.8).length;
  if (days.length >= 4 && active === 0) {
    out.push({
      id: 'steps',
      tone: 'info',
      title: 'Шагов стабильно мало',
      body: `Цель — ${stepGoal.toLocaleString('ru-RU')}. Прогулка после последнего приёма пищи заодно сглаживает сахар.`,
      weight: 45,
    });
  }

  // ── Weight trend
  const series = weightSeries(state.weights);
  if (series.length >= 3) {
    const first = series[0];
    const last = series[series.length - 1];
    const spanDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / DAY_MS;
    if (spanDays >= 14) {
      const perWeek = ((last.kg - first.kg) / spanDays) * 7;
      if (perWeek <= -1.5) {
        out.push({
          id: 'too-fast-loss',
          tone: 'warn',
          title: `Темп ${Math.abs(perWeek).toFixed(1)} кг в неделю — слишком быстро`,
          body: 'Скорость выше 1,5 кг в неделю названа фактором риска образования камней в жёлчном пузыре. Стоит ослабить дефицит и показаться врачу.',
          weight: 95,
        });
      } else if (perWeek <= -1.0) {
        out.push({
          id: 'fast-loss',
          tone: 'warn',
          title: `Темп ${Math.abs(perWeek).toFixed(1)} кг в неделю — выше коридора`,
          body: 'Рекомендуемый диапазон — 0,5–1 кг в неделю. Выше обычно означает потерю мышц и воды, а не только жира: добавьте белок и силовые.',
          weight: 85,
        });
      } else if (perWeek <= -0.2) {
        out.push({
          id: 'good-loss',
          tone: 'good',
          title: `Минус ${Math.abs(perWeek).toFixed(2)} кг в неделю`,
          body: 'Темп в разумном коридоре. На таком вес уходит за счёт жира, а не мышц.',
          weight: 50,
        });
      } else if (perWeek >= 0.1) {
        out.push({
          id: 'plateau',
          tone: 'info',
          title: 'Вес за две недели не снижается',
          body: 'Окно ограничивает время, а не объём. Чаще всего дело в том, что калории вернулись внутрь окна.',
          weight: 65,
        });
      }
    }
  } else if (series.length > 0) {
    const lastDate = new Date(series[series.length - 1].date).getTime();
    if (now - lastDate > 7 * DAY_MS) {
      out.push({
        id: 'no-weight',
        tone: 'info',
        title: 'Больше недели без взвешиваний',
        body: 'Одна запись ничего не значит, а линия за три недели показывает правду. Взвешивайтесь в одно время.',
        weight: 55,
      });
    }
  }

  // ── Nothing rated yet
  if (done.length >= 3 && done.filter(isRated).length === 0) {
    out.push({
      id: 'rate',
      tone: 'info',
      title: 'Оцените пару голоданий',
      body: 'Три ползунка после финиша — и тренер сможет сказать, какая длина окна подходит именно вам.',
      weight: 68,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
