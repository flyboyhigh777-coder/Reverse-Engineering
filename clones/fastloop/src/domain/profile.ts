import { answerOf } from './quiz';
import type { Answers } from './quiz';

/** Minutes since midnight from "HH:MM"; null when absent or malformed. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function formatClockMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Forward distance from a to b on a 24-hour clock. */
export function forwardMinutes(from: number, to: number): number {
  return ((to - from) % 1440 + 1440) % 1440;
}

export type Chronotype = 'lark' | 'mid' | 'owl';
export type EatingPattern = 'late' | 'grazing' | 'skipper' | 'regular';

export interface SleepProfile {
  readonly bedtime: number | null;
  readonly wakeWeekday: number | null;
  readonly wakeWeekend: number | null;
  /** Estimated sleep on a work night, in minutes. */
  readonly sleepMinutes: number | null;
  /** How far the weekend wake-up drifts — the usual marker of a mismatched schedule. */
  readonly socialJetlagMinutes: number | null;
  readonly chronotype: Chronotype;
  /** 0 = strongly morning, 100 = strongly evening. */
  readonly eveningness: number;
}

export interface PersonProfile {
  readonly sleep: SleepProfile;
  readonly eating: EatingPattern;
  /** Current eating window from the answers, in minutes since midnight. */
  readonly currentEatStart: number | null;
  readonly currentEatEnd: number | null;
  readonly currentFastHours: number | null;
  readonly typeName: string;
  readonly typeSummary: string;
  /** Two or three concrete things to change first, specific to this person. */
  readonly levers: readonly string[];
}

const BED_EARLY = 21 * 60 + 30;
const BED_LATE = 26 * 60 + 30; // 02:30 the next day

function eveningnessScore(answers: Answers, bedtime: number | null): number {
  const parts: number[] = [];

  if (bedtime !== null) {
    // Treat an after-midnight bedtime as belonging to the previous evening.
    const linear = bedtime < 12 * 60 ? bedtime + 1440 : bedtime;
    const ratio = (linear - BED_EARLY) / (BED_LATE - BED_EARLY);
    parts.push(Math.max(0, Math.min(1, ratio)) * 100);
  }

  const morning: Record<string, number> = { fresh: 0, ok: 33, slow: 66, awful: 100 };
  const feel = morning[answerOf(answers, 'morningFeel')];
  if (feel !== undefined) parts.push(feel);

  const peak: Record<string, number> = { morning: 0, midday: 35, evening: 70, night: 100 };
  const energy = peak[answerOf(answers, 'energyPeak')];
  if (energy !== undefined) parts.push(energy);

  if (parts.length === 0) return 50;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function eatingPattern(answers: Answers, eatStart: number | null, eatEnd: number | null): EatingPattern {
  if (answerOf(answers, 'mealsPerDay') === 'grazing') return 'grazing';
  if (eatEnd !== null && (eatEnd >= 21 * 60 + 30 || eatEnd < 4 * 60)) return 'late';
  if (answerOf(answers, 'nightSnack') === 'often') return 'late';
  if (eatStart !== null && eatStart >= 11 * 60) return 'skipper';
  return 'regular';
}

const CHRONO_LABEL: Record<Chronotype, string> = {
  lark: 'Жаворонок',
  mid: 'Промежуточный тип',
  owl: 'Сова',
};

const PATTERN_LABEL: Record<EatingPattern, string> = {
  late: 'поздний ужин',
  grazing: 'постоянные перекусы',
  skipper: 'пропущенный завтрак',
  regular: 'ровный режим',
};

export function buildProfile(answers: Answers): PersonProfile {
  const bedtime = parseClock(answerOf(answers, 'bedtime'));
  const wakeWeekday = parseClock(answerOf(answers, 'wakeWeekday'));
  const wakeWeekend = parseClock(answerOf(answers, 'wakeWeekend'));
  const eatStart = parseClock(answerOf(answers, 'firstMeal'));
  const eatEnd = parseClock(answerOf(answers, 'lastMeal'));

  const sleepMinutes = bedtime !== null && wakeWeekday !== null ? forwardMinutes(bedtime, wakeWeekday) : null;
  const socialJetlagMinutes =
    wakeWeekday !== null && wakeWeekend !== null ? Math.max(0, wakeWeekend - wakeWeekday) : null;

  const eveningness = eveningnessScore(answers, bedtime);
  const chronotype: Chronotype = eveningness < 34 ? 'lark' : eveningness < 67 ? 'mid' : 'owl';
  const eating = eatingPattern(answers, eatStart, eatEnd);

  const currentFastHours =
    eatStart !== null && eatEnd !== null ? Number(((1440 - forwardMinutes(eatStart, eatEnd)) / 60).toFixed(1)) : null;

  return {
    sleep: { bedtime, wakeWeekday, wakeWeekend, sleepMinutes, socialJetlagMinutes, chronotype, eveningness },
    eating,
    currentEatStart: eatStart,
    currentEatEnd: eatEnd,
    currentFastHours,
    typeName: `${CHRONO_LABEL[chronotype]}, ${PATTERN_LABEL[eating]}`,
    typeSummary: summarise(chronotype, eating, sleepMinutes, socialJetlagMinutes),
    levers: levers(answers, chronotype, eating, sleepMinutes, socialJetlagMinutes),
  };
}

function summarise(
  chronotype: Chronotype,
  eating: EatingPattern,
  sleepMinutes: number | null,
  jetlag: number | null,
): string {
  const parts: string[] = [];

  if (chronotype === 'owl') {
    parts.push(
      'Вы поздно ложитесь и тяжело встаёте, поэтому стандартный совет «не ешьте после шести» вам не подходит: между ужином и сном останется слишком много часов, и вечерний голод победит.',
    );
  } else if (chronotype === 'lark') {
    parts.push('Вы рано встаёте и рано выдыхаетесь к вечеру — для вас естественно сдвинуть всю еду на первую половину дня.');
  } else {
    parts.push('Ваш ритм посередине: окно можно двигать в обе стороны, отталкиваясь от того, когда реально удаётся поесть.');
  }

  if (eating === 'late') parts.push('Сейчас последний приём пищи приходится близко ко сну — это первое, что стоит сдвинуть.');
  if (eating === 'grazing') parts.push('Еда размазана по всему дню, поэтому окно само по себе уже даст заметный эффект.');
  if (eating === 'skipper') parts.push('Завтрак вы и так пропускаете — значит, половина пути к окну уже пройдена.');

  if (sleepMinutes !== null && sleepMinutes < 390) {
    parts.push('Сна меньше шести с половиной часов: недосып поднимает тягу к быстрым углеводам уже на следующий день.');
  }
  if (jetlag !== null && jetlag >= 120) {
    parts.push('В выходные вы встаёте на два с лишним часа позже — организм каждую неделю переживает смену пояса.');
  }

  return parts.join(' ');
}

function levers(
  answers: Answers,
  chronotype: Chronotype,
  eating: EatingPattern,
  sleepMinutes: number | null,
  jetlag: number | null,
): readonly string[] {
  const out: string[] = [];

  if (eating === 'late') out.push('Сдвигать ужин на 30 минут раньше каждую неделю, пока не наберётся три часа до сна');
  if (eating === 'grazing') out.push('Свести еду к трём приёмам без перекусов между ними — это важнее длины окна');
  if (answerOf(answers, 'protein') === 'rare' || answerOf(answers, 'protein') === 'veg') {
    out.push('Добавить источник белка в каждый приём пищи: при снижении веса он удерживает мышцы');
  }
  if (answerOf(answers, 'sweetDrinks') === 'daily') out.push('Убрать сладкие напитки — это самый дешёвый способ срезать калории');
  if (sleepMinutes !== null && sleepMinutes < 390) out.push('Добавить 30–45 минут сна: это влияет на аппетит сильнее, чем кажется');
  if (jetlag !== null && jetlag >= 120) out.push('Подтянуть подъём в выходные ближе к будням хотя бы на час');
  if (chronotype === 'owl' && answerOf(answers, 'caffeine') === 'evening') {
    out.push('Последний кофе — до 16:00: вечерний кофеин сдвигает засыпание ещё позже');
  }
  if (answerOf(answers, 'strength') === 'never') out.push('Две короткие силовые в неделю — чтобы вес уходил за счёт жира, а не мышц');

  return out.slice(0, 4);
}
