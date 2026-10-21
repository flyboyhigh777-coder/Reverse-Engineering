import type { Answers } from './quiz';
import { bmi, bmiBand } from './metrics';

/**
 * Something the interview can tell you back, the moment it can.
 *
 * A long questionnaire that only takes feels like paperwork. Showing the
 * consequence of an answer as soon as it is known — the BMI, how long a goal
 * will take, how much sleep the stated hours actually add up to — turns the
 * same questions into a conversation. Every figure here is computed from the
 * answers already given; nothing is invented to seem clever.
 */

export interface Insight {
  readonly headline: string;
  readonly detail: string;
}

function num(answers: Answers, key: string): number | null {
  const raw = answers[key];
  if (typeof raw !== 'string') return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutes(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function insightFor(stepId: string, answers: Answers): Insight | null {
  if (stepId === 'weight') {
    const kg = num(answers, 'weight');
    const cm = num(answers, 'height');
    const value = kg !== null && cm !== null ? bmi(kg, cm) : null;
    if (value === null) return null;
    return {
      headline: `ИМТ ${value.toFixed(1)} — ${bmiBand(value).label.toLowerCase()}`,
      detail:
        'Показатель для групп людей, а не диагноз: он не различает мышцы и жир. Но как точка отсчёта годится.',
    };
  }

  if (stepId === 'goalWeight') {
    const from = num(answers, 'weight');
    const to = num(answers, 'goalWeight');
    if (from === null || to === null || to >= from) return null;
    const diff = from - to;
    const fast = Math.ceil(diff / 1);
    const slow = Math.ceil(diff / 0.5);
    return {
      headline: `Минус ${diff.toFixed(1)} кг`,
      detail: `В безопасном темпе 0,5–1 кг в неделю это ${fast}–${slow} недель. Быстрее — не лучше: при резком снижении веса растёт риск камней в жёлчном пузыре.`,
    };
  }

  if (stepId === 'wakeWeekday') {
    const bed = minutes(answers.bedtime as string | undefined);
    const wake = minutes(answers.wakeWeekday as string | undefined);
    if (bed === null || wake === null) return null;
    const span = (wake - bed + 1440) % 1440;
    const hours = Math.floor(span / 60);
    const rest = span % 60;
    const enough = span >= 420;
    return {
      headline: `Сон ${hours} ч${rest > 0 ? ` ${rest} мин` : ''}`,
      detail: enough
        ? 'Этого обычно хватает. Короткий сон усиливает голод назавтра — это измеряемый эффект, а не ощущение.'
        : 'Меньше семи часов. Недосып повышает голод и тягу к сладкому назавтра, и это помешает любой схеме питания сильнее, чем выбор окна.',
    };
  }

  return null;
}
