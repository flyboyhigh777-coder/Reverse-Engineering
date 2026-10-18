import type { PlanId } from './types';

export interface Plan {
  readonly id: PlanId;
  readonly fastHours: number;
  readonly eatHours: number;
  readonly title: string;
  readonly blurb: string;
  readonly level: 'Начальный' | 'Средний' | 'Продвинутый';
  /** Mirrors the original: only the three gentlest windows are free. */
  readonly premium: boolean;
}

export const PLANS: readonly Plan[] = [
  { id: '12:12', fastHours: 12, eatHours: 12, title: '12:12', blurb: 'Мягкий вход. Ужин раньше, завтрак позже.', level: 'Начальный', premium: false },
  { id: '14:10', fastHours: 14, eatHours: 10, title: '14:10', blurb: 'Следующий шаг после 12:12.', level: 'Начальный', premium: false },
  { id: '16:8', fastHours: 16, eatHours: 8, title: '16:8', blurb: 'Самая распространённая схема.', level: 'Средний', premium: false },
  { id: '18:6', fastHours: 18, eatHours: 6, title: '18:6', blurb: 'Окно питания сжимается до шести часов.', level: 'Средний', premium: true },
  { id: '20:4', fastHours: 20, eatHours: 4, title: '20:4', blurb: 'Схема «воина»: один-два приёма пищи.', level: 'Продвинутый', premium: true },
  { id: '21:3', fastHours: 21, eatHours: 3, title: '21:3', blurb: 'Узкое окно, требует подготовки.', level: 'Продвинутый', premium: true },
  { id: '23:1', fastHours: 23, eatHours: 1, title: 'OMAD 23:1', blurb: 'Один приём пищи в сутки.', level: 'Продвинутый', premium: true },
  { id: 'custom', fastHours: 16, eatHours: 8, title: 'Своё окно', blurb: 'Любая длительность с шагом в полчаса.', level: 'Средний', premium: true },
];

const BY_ID = new Map(PLANS.map((p) => [p.id, p]));

export function planById(id: PlanId): Plan {
  const plan = BY_ID.get(id);
  if (!plan) throw new Error(`Неизвестный план: ${id}`);
  return plan;
}

export const CUSTOM_MIN_HOURS = 8;
export const CUSTOM_MAX_HOURS = 23.5;

/** Resolves 'custom' against the stored hour count; other plans pass through. */
export function resolvePlan(id: PlanId, customFastHours: number): Plan {
  const plan = planById(id);
  if (plan.id !== 'custom') return plan;
  const fastHours = Math.min(CUSTOM_MAX_HOURS, Math.max(CUSTOM_MIN_HOURS, customFastHours));
  const eatHours = Number((24 - fastHours).toFixed(1));
  return { ...plan, fastHours, eatHours, title: `${fastHours}:${eatHours}` };
}

export const WEEKDAYS: readonly { readonly key: string; readonly short: string }[] = [
  { key: '1', short: 'Пн' },
  { key: '2', short: 'Вт' },
  { key: '3', short: 'Ср' },
  { key: '4', short: 'Чт' },
  { key: '5', short: 'Пт' },
  { key: '6', short: 'Сб' },
  { key: '0', short: 'Вс' },
];
