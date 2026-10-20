import type { PlanId } from './types';

export type PlanTier = 'Базовые' | 'Промежуточные' | 'Расширенные' | 'Длительные';

export const PLAN_TIERS: readonly PlanTier[] = ['Базовые', 'Промежуточные', 'Расширенные', 'Длительные'];

export const TIER_HINT: Readonly<Record<PlanTier, string>> = {
  'Базовые': 'Начать легко, сдвиг небольшой',
  'Промежуточные': 'Выбор большинства',
  'Расширенные': 'Нужен опыт и ровный режим',
  'Длительные': 'Не чаще раза в неделю и не всем',
};

export interface Plan {
  readonly id: PlanId;
  readonly fastHours: number;
  readonly eatHours: number;
  readonly title: string;
  readonly blurb: string;
  readonly level: 'Начальный' | 'Средний' | 'Продвинутый';
  readonly tier: PlanTier;
  /** Shown before the window is selected, where it needs saying. */
  readonly caution?: string;
  /** Who this window is for, in practical terms rather than marketing. */
  readonly suits: string;
  /** Mirrors the original: only the three gentlest windows are free. */
  readonly premium: boolean;
}

export const PLANS: readonly Plan[] = [
  // ───────────── Базовые
  { id: '12:12', fastHours: 12, eatHours: 12, title: '12:12', tier: 'Базовые', blurb: 'Мягкий вход. Ужин раньше, завтрак позже.', level: 'Начальный', suits: 'Если вы никогда не пропускали завтрак. По сути это ужин до 20:00 и завтрак после 8:00 — привычный день без ночных перекусов.', premium: false },
  { id: '13:11', fastHours: 13, eatHours: 11, title: '13:11', tier: 'Базовые', blurb: 'Полшага от 12:12.', level: 'Начальный', suits: 'Когда 12:12 держится, но 14:10 пока кажется резким. Сдвиг всего на час.', premium: false },
  { id: '14:10', fastHours: 14, eatHours: 10, title: '14:10', tier: 'Базовые', blurb: 'Следующий шаг после 12:12.', level: 'Начальный', suits: 'Когда 12:12 держится без усилий примерно неделю. Обычно на этом шаге вечерний голод и начинает отступать.', premium: false },
  { id: '15:9', fastHours: 15, eatHours: 9, title: '15:9', tier: 'Базовые', blurb: 'Подход к 16:8 без рывка.', level: 'Начальный', suits: 'Промежуточная ступень для тех, кому важнее не сорваться, чем дойти быстрее.', premium: true },

  // ───────────── Промежуточные
  { id: '16:8', fastHours: 16, eatHours: 8, title: '16:8', tier: 'Промежуточные', blurb: 'Самая распространённая схема.', level: 'Средний', suits: 'Разумная цель на третью-четвёртую неделю. На практике означает либо отказ от завтрака, либо ранний ужин — выберите то, что не ломает совместную еду.', premium: false },
  { id: '17:7', fastHours: 17, eatHours: 7, title: '17:7', tier: 'Промежуточные', blurb: 'Час сверх привычной схемы.', level: 'Средний', suits: 'Если 16:8 стало совсем лёгким, но 18:6 ломает обед или ужин.', premium: true },
  { id: '18:6', fastHours: 18, eatHours: 6, title: '18:6', tier: 'Промежуточные', blurb: 'Окно питания сжимается до шести часов.', level: 'Средний', suits: 'Для тех, кто держит 16:8 спокойно хотя бы пару недель. Как правило, это два приёма пищи вместо трёх.', premium: true },
  { id: '19:5', fastHours: 19, eatHours: 5, title: '19:5', tier: 'Промежуточные', blurb: 'Пять часов на всю дневную норму.', level: 'Средний', suits: 'Переход к продвинутым схемам. Следите, чтобы белок не проседал.', premium: true },

  // ───────────── Расширенные
  { id: '20:4', fastHours: 20, eatHours: 4, title: '20:4', tier: 'Расширенные', blurb: 'Схема «воина»: один-два приёма пищи.', level: 'Продвинутый', suits: 'Нужен опыт: за четыре часа придётся съесть дневную норму целиком, иначе дефицит становится слишком резким, а срыв — вопросом времени.', premium: true },
  { id: '21:3', fastHours: 21, eatHours: 3, title: '21:3', tier: 'Расширенные', blurb: 'Узкое окно, требует подготовки.', level: 'Продвинутый', suits: 'Редко подходит как ежедневный режим. Обычно его чередуют с более мягкими днями, а не держат неделями подряд.', caution: 'На таких окнах легко недобрать белок и микроэлементы. Не держите схему неделями подряд.', premium: true },
  { id: '22:2', fastHours: 22, eatHours: 2, title: '22:2', tier: 'Расширенные', blurb: 'Почти один приём пищи.', level: 'Продвинутый', suits: 'Фактически OMAD с запасом времени. Те же оговорки по питательности.', caution: 'На таких окнах легко недобрать белок и микроэлементы. Не держите схему неделями подряд.', premium: true },
  { id: '23:1', fastHours: 23, eatHours: 1, title: 'OMAD 23:1', tier: 'Расширенные', blurb: 'Один приём пищи в сутки.', level: 'Продвинутый', suits: 'За один приём трудно набрать белок и микроэлементы, поэтому как постоянный режим подходит немногим. Хорош как разовый эксперимент.', caution: 'Доказательная база слабая, а риск недобрать железо, B12, витамин D и кальций — реальный. Мы это не рекомендуем, но и не скрываем причины.', premium: true },

  // ───────────── Длительные
  { id: '24h', fastHours: 24, eatHours: 0, title: '24 часа', tier: 'Длительные', blurb: 'Сутки без еды, не чаще раза в неделю.', level: 'Продвинутый', suits: 'Разовый формат, а не режим. Делают при ровном сне, без болезни и без тяжёлых тренировок в этот день.', caution: 'Это верхняя граница, которую приложение поддерживает. Всё, что дольше суток, выстраивают с врачом, а не по приложению: у длительного голодания своя логика рисков, включая электролиты и рефидинг.', premium: true },

  { id: 'custom', fastHours: 16, eatHours: 8, title: 'Своё окно', tier: 'Промежуточные', blurb: 'Любая длительность с шагом в полчаса.', level: 'Средний', suits: 'Когда ни одна готовая схема не ложится на ваш график — например, при сменной работе.', premium: true },
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

export const LEVEL_ORDER: readonly Plan['level'][] = ['Начальный', 'Средний', 'Продвинутый'];

export const LEVEL_HINT: Readonly<Record<Plan['level'], string>> = {
  Начальный: 'С чего начать, если голодания раньше не было',
  Средний: 'Когда начальная схема держится без усилий',
  Продвинутый: 'Только с опытом и не каждый день',
};

export const WEEKDAYS: readonly { readonly key: string; readonly short: string }[] = [
  { key: '1', short: 'Пн' },
  { key: '2', short: 'Вт' },
  { key: '3', short: 'Ср' },
  { key: '4', short: 'Чт' },
  { key: '5', short: 'Пт' },
  { key: '6', short: 'Сб' },
  { key: '0', short: 'Вс' },
];
