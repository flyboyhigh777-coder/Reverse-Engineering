import { answerList, answerOf } from './quiz';
import type { Answers } from './quiz';

/**
 * Safety screening, run on the quiz answers before any plan is offered.
 *
 * The app it was modelled on sells a window to everyone who finishes the
 * questionnaire. Some people should not be given one: fasting changes how
 * several medications act, and for a few conditions it is plainly unsafe.
 * This is deliberately conservative — it steers toward a doctor, it does not
 * diagnose, and it never claims a condition the person did not report.
 */

export type Severity = 'stop' | 'care';

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
}

export interface Screening {
  readonly findings: readonly Finding[];
  /** No fasting plan is offered; the app runs in observation mode. */
  readonly blocked: boolean;
  /** A plan is offered, but capped and with a standing note. */
  readonly cautious: boolean;
  /** Hard ceiling on the recommended window, in hours. */
  readonly maxFastHours: number;
}

const STOP: Record<string, Omit<Finding, 'id' | 'severity'>> = {
  pregnancy: {
    title: 'Беременность или кормление',
    detail:
      'В эти периоды потребность в энергии и питательных веществах повышена, а ограничение времени еды не рекомендуется. План голодания не предлагаем.',
  },
  minor: {
    title: 'Возраст до 18 лет',
    detail: 'Организм ещё растёт, и ограничительные схемы питания в этом возрасте не рекомендуются без наблюдения врача.',
  },
  underweight: {
    title: 'Индекс массы тела ниже 18,5',
    detail: 'При недостаточном весе снижать его дальше опасно. Если вес снижается сам по себе — это повод показаться врачу.',
  },
  adrenal: {
    title: 'Надпочечниковая недостаточность или длительный приём гормонов',
    detail:
      'При этих состояниях пропуск приёмов пищи может спровоцировать тяжёлое ухудшение. Любые изменения режима питания — только через лечащего врача.',
  },
  diabetes1: {
    title: 'Диабет 1 типа',
    detail:
      'Голодание напрямую меняет потребность в инсулине и риск гипогликемии. Такую схему выстраивают только вместе с лечащим врачом, а не по приложению.',
  },
  edCurrent: {
    title: 'Сложные отношения с едой сейчас',
    detail:
      'Схема «есть можно только в окне» легко становится частью расстройства и усиливает его. Здесь нужен специалист, а не трекер.',
  },
};

const CARE: Record<string, Omit<Finding, 'id' | 'severity'>> = {
  diabetes2: {
    title: 'Диабет 2 типа',
    detail:
      'Если вы принимаете препараты, снижающие сахар, режим их приёма нужно согласовать с врачом до изменения графика еды. Начинаем с самого мягкого окна.',
  },
  lowsugar: {
    title: 'Эпизоды гипогликемии',
    detail: 'Длинные окна повышают риск. Держим короткое окно и завершаем голодание при первых симптомах.',
  },
  meds: {
    title: 'Лекарства, которые пьют с едой',
    detail:
      'Сдвиг окна питания сдвигает и приём лекарств. Уточните у врача или в инструкции, можно ли менять время — это не формальность.',
  },
  gi: {
    title: 'Гастрит, язва или рефлюкс',
    detail:
      'Окно стоит сдвинуть на раннее: в исследовании приём пищи за два часа до сна давал достоверно больше рефлюкса лёжа, чем за шесть. Если симптомы усиливаются — окно укорачивают.',
  },
  gallstones: {
    title: 'Камни в жёлчном пузыре',
    detail:
      'Быстрое снижение веса — задокументированный фактор риска: на очень низкокалорийных рационах новые камни находят у заметной доли участников за пару месяцев. Держим темп не быстрее 0,5 кг в неделю.',
  },
  thyroid: {
    title: 'Заболевание щитовидной железы',
    detail:
      'Левотироксин принимают натощак за 30–60 минут до еды. Сдвиг окна сдвигает и этот интервал — проверьте схему приёма с врачом.',
  },
  edPast: {
    title: 'Сложные отношения с едой в прошлом',
    detail:
      'Будьте внимательны к себе: если счёт часов начнёт вызывать тревогу или захочется «отработать» съеденное, схему стоит остановить.',
  },
  senior: {
    title: 'Возраст 65 лет и старше',
    detail:
      'В этом возрасте приоритет — сохранить мышцы, а не быстро снизить вес. Ориентир по белку 1,0–1,2 г на кг, силовые становятся обязательной частью, а не дополнением.',
  },
  nights: {
    title: 'Ночные смены',
    detail:
      'При сменном графике окно питания привязывают к рабочему циклу, а не к часам на стене. Готовых схем здесь нет, настраивайте вручную.',
  },
};

export function screen(answers: Answers, bmi: number | null): Screening {
  const conditions = answerList(answers, 'conditions');
  const pregnancy = answerOf(answers, 'pregnancy');
  const ed = answerOf(answers, 'ed');
  const meds = answerOf(answers, 'meds');
  const shift = answerOf(answers, 'shift');
  const age = Number.parseFloat(answerOf(answers, 'age'));

  const findings: Finding[] = [];
  const add = (id: string, severity: Severity) => {
    const source = severity === 'stop' ? STOP[id] : CARE[id];
    if (source) findings.push({ id, severity, ...source });
  };

  if (pregnancy === 'pregnant' || pregnancy === 'feeding') add('pregnancy', 'stop');
  if (Number.isFinite(age) && age < 18) add('minor', 'stop');
  if (bmi !== null && bmi < 18.5) add('underweight', 'stop');
  if (conditions.includes('diabetes1')) add('diabetes1', 'stop');
  if (conditions.includes('adrenal')) add('adrenal', 'stop');
  if (ed === 'current') add('edCurrent', 'stop');

  if (conditions.includes('diabetes2')) add('diabetes2', 'care');
  if (conditions.includes('lowsugar')) add('lowsugar', 'care');
  if (meds === 'yes' || meds === 'unsure') add('meds', 'care');
  if (conditions.includes('gi')) add('gi', 'care');
  if (conditions.includes('gallstones')) add('gallstones', 'care');
  if (conditions.includes('thyroid')) add('thyroid', 'care');
  if (ed === 'past') add('edPast', 'care');
  if (Number.isFinite(age) && age >= 65) add('senior', 'care');
  if (shift === 'shifts' || shift === 'nights') add('nights', 'care');

  const blocked = findings.some((f) => f.severity === 'stop');
  const cautious = !blocked && findings.length > 0;
  return {
    findings,
    blocked,
    cautious,
    maxFastHours: blocked ? 0 : cautious ? 14 : 23.5,
  };
}

export const STOP_SIGNS: readonly string[] = [
  'головокружение, потемнение в глазах, холодный пот',
  'дрожь в руках и спутанность мыслей',
  'сильное сердцебиение в покое',
  'тошнота, которая не проходит',
];
