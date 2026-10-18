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
];

const BY_ID = new Map(PLANS.map((p) => [p.id, p]));

export function planById(id: PlanId): Plan {
  const plan = BY_ID.get(id);
  if (!plan) throw new Error(`Неизвестный план: ${id}`);
  return plan;
}
