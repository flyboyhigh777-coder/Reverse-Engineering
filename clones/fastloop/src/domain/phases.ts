/**
 * The "what your body is doing" timeline that fasting apps show around the ring.
 *
 * Hour boundaries are approximate and sources disagree: ketosis is quoted
 * anywhere from 12 to 18 hours, autophagy from 16 to 24, and the switch moves
 * with the last meal, activity and metabolic health. Human evidence for the
 * autophagy window in particular is thin. The app says so rather than
 * presenting these as measurements — see DISCLAIMER.
 */
export interface FastPhase {
  readonly id: string;
  readonly fromHour: number;
  /** Exclusive upper bound; Infinity for the last phase. */
  readonly toHour: number;
  readonly title: string;
  readonly short: string;
  readonly body: string;
  /** Hue token name used by the ring and the phase rail. */
  readonly tone: 'fed' | 'early' | 'switch' | 'burn' | 'deep';
}

export const PHASES: readonly FastPhase[] = [
  {
    id: 'digest',
    fromHour: 0,
    toHour: 4,
    title: 'Пищеварение',
    short: 'Организм усваивает последний приём пищи',
    body: 'Глюкоза из еды поступает в кровь, инсулин повышен, тело работает на только что полученном топливе. Запасы пока не расходуются.',
    tone: 'fed',
  },
  {
    id: 'insulin',
    fromHour: 4,
    toHour: 12,
    title: 'Снижение инсулина',
    short: 'Расходуется гликоген печени',
    body: 'Инсулин постепенно падает, и тело переключается на гликоген — запас углеводов в печени и мышцах. Это ещё не жиросжигание, но подготовка к нему.',
    tone: 'early',
  },
  {
    id: 'switch',
    fromHour: 12,
    toHour: 16,
    title: 'Метаболический переход',
    short: 'Гликоген на исходе',
    body: 'Запасы гликогена истощаются, и печень начинает производить кетоны из жирных кислот. Момент перехода сильно зависит от того, насколько углеводным был последний приём пищи.',
    tone: 'switch',
  },
  {
    id: 'ketosis',
    fromHour: 16,
    toHour: 18,
    title: 'Кетоз',
    short: 'Жир становится основным топливом',
    body: 'Уровень кетонов в крови заметно растёт. Многие описывают на этом этапе ровную энергию и ясность в голове, но ощущения индивидуальны.',
    tone: 'burn',
  },
  {
    id: 'autophagy',
    fromHour: 18,
    toHour: 24,
    title: 'Аутофагия (предположительно)',
    short: 'Клеточная «уборка» усиливается',
    body: 'На этом отрезке обычно говорят о запуске аутофагии — переработки повреждённых клеточных структур. Данных по людям мало, а оценки начала расходятся от 16 до 24 часов, поэтому это ориентир, а не факт.',
    tone: 'deep',
  },
  {
    id: 'deep',
    fromHour: 24,
    toHour: Number.POSITIVE_INFINITY,
    title: 'Глубокое голодание',
    short: 'Кетоз углубляется',
    body: 'Длительные голодания дольше суток — отдельная практика. Их стоит обсуждать с врачом, особенно при хронических заболеваниях, приёме лекарств, беременности или расстройствах пищевого поведения.',
    tone: 'deep',
  },
];

export const DISCLAIMER =
  'FastLoop — трекер, а не медицинский сервис. Границы фаз приблизительны: источники расходятся, а реальные сроки зависят от последнего приёма пищи, активности и обмена веществ. Приложение ничего не диагностирует и не лечит. При беременности, диабете, приёме лекарств или расстройствах пищевого поведения сначала поговорите с врачом.';

export function phaseAtHours(hours: number): FastPhase {
  const found = PHASES.find((p) => hours >= p.fromHour && hours < p.toHour);
  return found ?? PHASES[PHASES.length - 1];
}

export function nextPhaseAfter(hours: number): FastPhase | null {
  const index = PHASES.findIndex((p) => hours >= p.fromHour && hours < p.toHour);
  if (index < 0 || index === PHASES.length - 1) return null;
  return PHASES[index + 1];
}
