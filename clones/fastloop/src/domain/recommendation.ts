import { answerOf } from './quiz';
import type { Answers } from './quiz';
import { formatClockMinutes } from './profile';
import type { PersonProfile } from './profile';
import type { Screening } from './screening';
import type { PlanId } from './types';

/**
 * Turns the interview into a window with actual clock times, and a ramp that
 * gets there from where the person eats today.
 *
 * The thing most fasting apps skip: they hand everyone "16:8" and leave the
 * placement to the user. Placement is the part that decides whether the
 * schedule survives contact with a real evening, so it is computed here from
 * bedtime and chronotype, and the last meal is kept about three hours clear
 * of sleep.
 */

const MEAL_TO_SLEEP_GAP = 180;

export interface WindowPlan {
  readonly fastHours: number;
  /** Minutes since midnight. */
  readonly eatStart: number;
  readonly eatEnd: number;
}

export interface RampWeek {
  readonly week: number;
  readonly plan: WindowPlan;
  readonly note: string;
}

export interface Recommendation {
  readonly target: WindowPlan;
  readonly planId: PlanId;
  readonly ramp: readonly RampWeek[];
  readonly rationale: readonly string[];
  /** Shift work: the clock placement has to be set by hand. */
  readonly manual: boolean;
}

const STANDARD: readonly { id: PlanId; hours: number }[] = [
  { id: '12:12', hours: 12 },
  { id: '14:10', hours: 14 },
  { id: '16:8', hours: 16 },
  { id: '18:6', hours: 18 },
  { id: '20:4', hours: 20 },
  { id: '21:3', hours: 21 },
  { id: '23:1', hours: 23 },
];

function nearestPlan(hours: number): PlanId {
  const exact = STANDARD.find((plan) => Math.abs(plan.hours - hours) < 0.01);
  return exact ? exact.id : 'custom';
}

function round30(hours: number): number {
  return Math.round(hours * 2) / 2;
}

function targetHours(answers: Answers, screening: Screening): number {
  const experience = answerOf(answers, 'experience');
  const pace = answerOf(answers, 'pace');
  const goal = answerOf(answers, 'goal');

  let hours = experience === 'regular' ? 16 : experience === 'tried' ? 16 : 14;
  if (pace === 'gentle') hours -= 2;
  if (pace === 'fast') hours += 2;
  if (goal === 'maintain' || goal === 'health') hours = Math.min(hours, 14);

  return Math.min(screening.maxFastHours, Math.max(12, round30(hours)));
}

function placeWindow(fastHours: number, profile: PersonProfile): { eatStart: number; eatEnd: number } {
  const eatMinutes = (24 - fastHours) * 60;
  const bedtime = profile.sleep.bedtime;
  // Without a bedtime there is nothing to anchor to, so keep the current end.
  const anchor = bedtime !== null ? bedtime - MEAL_TO_SLEEP_GAP : (profile.currentEatEnd ?? 20 * 60);
  const eatEnd = ((anchor % 1440) + 1440) % 1440;
  const eatStart = ((eatEnd - eatMinutes) % 1440 + 1440) % 1440;
  return { eatStart, eatEnd };
}

function weeksFor(pace: string, gap: number): number {
  if (gap <= 0.5) return 1;
  if (pace === 'fast') return 2;
  if (pace === 'gentle') return 5;
  return 4;
}

export function recommend(answers: Answers, profile: PersonProfile, screening: Screening): Recommendation | null {
  if (screening.blocked) return null;

  const fastHours = targetHours(answers, screening);
  const placed = placeWindow(fastHours, profile);
  const target: WindowPlan = { fastHours, ...placed };
  const manual = answerOf(answers, 'shift') === 'shifts' || answerOf(answers, 'shift') === 'nights';

  const current = profile.currentFastHours ?? 12;
  const gap = fastHours - current;
  const pace = answerOf(answers, 'pace');
  const weeks = weeksFor(pace, gap);

  const ramp: RampWeek[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    const hours = weeks === 1 ? fastHours : round30(current + (gap * week) / weeks);
    const clamped = Math.max(12, Math.min(fastHours, hours));
    const stepPlan: WindowPlan = { fastHours: clamped, ...placeWindow(clamped, profile) };
    ramp.push({ week, plan: stepPlan, note: weekNote(week, weeks, clamped, profile) });
  }

  return { target, planId: nearestPlan(fastHours), ramp, rationale: rationale(answers, profile, target, manual), manual };
}

function weekNote(week: number, weeks: number, hours: number, profile: PersonProfile): string {
  if (weeks === 1) return 'Вы уже близко к этому окну — начинаем сразу с целевого.';
  if (week === 1) {
    return profile.eating === 'late'
      ? 'Первая неделя — только про ужин раньше. Длину окна пока не трогаем.'
      : 'Первая неделя самая мягкая: задача — привыкнуть отмечать старт и финиш.';
  }
  if (week === weeks) return `Целевое окно ${hours} ч. Если держится без усилий неделю — можно обсуждать следующий шаг.`;
  return `Добавляем полчаса-час. Если тяжело — останьтесь на этой неделе ещё на одну, это не откат.`;
}

function rationale(answers: Answers, profile: PersonProfile, target: WindowPlan, manual: boolean): readonly string[] {
  const out: string[] = [];
  const bedtime = profile.sleep.bedtime;

  if (manual) {
    out.push('При сменном графике окно привязывают к рабочему циклу, а не к часам на стене, поэтому время задайте вручную.');
  } else if (bedtime !== null) {
    out.push(
      `Окно заканчивается в ${formatClockMinutes(target.eatEnd)} — примерно за три часа до вашего отбоя в ${formatClockMinutes(bedtime)}.`,
    );
  }

  if (profile.sleep.chronotype === 'owl') {
    out.push('Как у совы, окно сдвинуто на вторую половину дня: ранний завтрак вам всё равно не даётся.');
  } else if (profile.sleep.chronotype === 'lark') {
    out.push('Как у жаворонка, основная еда приходится на первую половину дня, когда у вас пик энергии.');
  }

  if (profile.currentFastHours !== null) {
    out.push(`Сейчас у вас выходит около ${profile.currentFastHours} ч без еды — мы идём от этого, а не с нуля.`);
  }

  const pace = answerOf(answers, 'pace');
  if (pace === 'gentle') out.push('Вы выбрали мягкий темп, поэтому прибавляем медленнее и за пять недель.');
  if (pace === 'fast') out.push('Вы выбрали быстрый темп — выходим на цель за две недели, но следите за самочувствием.');

  return out;
}

export function describeWindow(plan: WindowPlan): string {
  return `${formatClockMinutes(plan.eatStart)} – ${formatClockMinutes(plan.eatEnd)}`;
}
