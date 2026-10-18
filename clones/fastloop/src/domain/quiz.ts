/**
 * The onboarding interview.
 *
 * Three things separate it from the funnel it was reconstructed from. It is
 * grouped into named sections so a long interview stays navigable instead of
 * reading as an endless counter. It branches, so nobody is asked about
 * pregnancy or gym access when the answer cannot apply. And it screens for
 * the conditions under which fasting is not a good idea, before selling
 * anyone a plan — see `screening.ts`.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
  readonly sub?: string;
}

export type Answers = Readonly<Record<string, string | readonly string[]>>;

interface Common {
  readonly id: string;
  readonly section: string;
  /** Omitted when the step cannot apply to this person. */
  readonly showIf?: (answers: Answers) => boolean;
}

export type QuizStep = Common &
  (
    | { readonly kind: 'single'; readonly question: string; readonly hint?: string; readonly options: readonly Option[] }
    | { readonly kind: 'multi'; readonly question: string; readonly hint?: string; readonly options: readonly Option[]; readonly exclusive?: string }
    | {
        readonly kind: 'number';
        readonly question: string;
        readonly unit: string;
        readonly min: number;
        readonly max: number;
        readonly initial: number;
        readonly step?: number;
        readonly labelEvery?: number;
        /** Second scale along the other edge of the tape. */
        readonly secondary?: 'height' | 'weight';
      }
    | { readonly kind: 'time'; readonly question: string; readonly hint?: string; readonly initial: string }
    | { readonly kind: 'scale'; readonly question: string; readonly low: string; readonly high: string }
    | { readonly kind: 'date'; readonly question: string; readonly hint?: string }
    | { readonly kind: 'text'; readonly question: string; readonly placeholder: string; readonly optional: boolean }
    | { readonly kind: 'info'; readonly title: string; readonly body: string; readonly stat?: string; readonly statLabel?: string }
  );

export const SECTIONS: readonly string[] = [
  'Цель',
  'О себе',
  'Здоровье',
  'Сон и ритм',
  'Еда',
  'Движение',
  'Настрой',
  'План',
];

const YES_NO: readonly Option[] = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

const str = (answers: Answers, key: string): string => (typeof answers[key] === 'string' ? (answers[key] as string) : '');
const list = (answers: Answers, key: string): readonly string[] =>
  Array.isArray(answers[key]) ? (answers[key] as readonly string[]) : [];

export const QUIZ: readonly QuizStep[] = [
  // ─────────────────────────────── Цель
  {
    kind: 'single',
    section: 'Цель',
    id: 'goal',
    question: 'С чего начнём?',
    hint: 'От этого зависит и схема, и советы',
    options: [
      { value: 'lose', label: 'Снизить вес', sub: 'Основной сценарий для интервального голодания' },
      { value: 'maintain', label: 'Удержать вес', sub: 'Вес устраивает, нужна система' },
      { value: 'energy', label: 'Больше энергии', sub: 'Убрать дневную сонливость и тяжесть' },
      { value: 'health', label: 'Привычки и здоровье', sub: 'Наладить режим, меньше перекусов' },
      { value: 'clarity', label: 'Ясность в голове', sub: 'Сосредоточенность в рабочие часы' },
    ],
  },
  {
    kind: 'single',
    section: 'Цель',
    id: 'goalAge',
    question: 'Как давно это вас беспокоит?',
    options: [
      { value: 'recent', label: 'Несколько месяцев' },
      { value: 'year', label: 'Около года' },
      { value: 'years', label: 'Несколько лет' },
      { value: 'always', label: 'Сколько себя помню' },
    ],
  },

  // ─────────────────────────────── О себе
  {
    kind: 'single',
    section: 'О себе',
    id: 'sex',
    question: 'Ваш пол',
    hint: 'Влияет на расчёт расхода энергии и на пару вопросов дальше',
    options: [
      { value: 'female', label: 'Женский' },
      { value: 'male', label: 'Мужской' },
      { value: 'other', label: 'Не хочу указывать' },
    ],
  },
  { kind: 'number', section: 'О себе', id: 'age', question: 'Сколько вам лет?', unit: 'лет', min: 14, max: 99, initial: 32, labelEvery: 5 },
  { kind: 'number', section: 'О себе', id: 'height', question: 'Ваш рост', unit: 'см', min: 120, max: 220, initial: 170, labelEvery: 10, secondary: 'height' },
  { kind: 'number', section: 'О себе', id: 'weight', question: 'Текущий вес', unit: 'кг', min: 35, max: 250, initial: 78, step: 0.5, labelEvery: 5, secondary: 'weight' },
  { kind: 'number', section: 'О себе', id: 'goalWeight', question: 'Какой вес вы хотите?', unit: 'кг', min: 35, max: 250, initial: 68, step: 0.5, labelEvery: 5, secondary: 'weight' },
  {
    kind: 'single',
    section: 'О себе',
    id: 'weightTrend',
    question: 'Что происходило с весом за последний год?',
    options: [
      { value: 'up', label: 'Заметно прибавил(а)' },
      { value: 'stable', label: 'Держится на месте' },
      { value: 'yoyo', label: 'То вниз, то обратно' },
      { value: 'down', label: 'Медленно снижается' },
    ],
  },

  // ─────────────────────────────── Здоровье (скрининг)
  {
    kind: 'info',
    section: 'Здоровье',
    id: 'info-safety',
    title: 'Несколько вопросов про здоровье',
    body: 'Интервальное голодание подходит не всем, и это не формальность: при некоторых состояниях оно меняет действие лекарств или просто опасно. Ответы никуда не уходят — они остаются в телефоне и нужны только для того, чтобы не предложить вам схему, которая вам не подходит.',
  },
  {
    kind: 'multi',
    section: 'Здоровье',
    id: 'conditions',
    question: 'Есть ли что-то из этого?',
    hint: 'Можно выбрать несколько',
    exclusive: 'none',
    options: [
      { value: 'diabetes1', label: 'Диабет 1 типа' },
      { value: 'diabetes2', label: 'Диабет 2 типа' },
      { value: 'lowsugar', label: 'Бывают гипогликемии', sub: 'Резкие падения сахара' },
      { value: 'gi', label: 'Гастрит, язва, рефлюкс' },
      { value: 'gallstones', label: 'Камни в жёлчном' },
      { value: 'thyroid', label: 'Заболевание щитовидной железы' },
      { value: 'pressure', label: 'Гипертония' },
      { value: 'adrenal', label: 'Надпочечниковая недостаточность', sub: 'Или длительный приём гормональных препаратов' },
      { value: 'none', label: 'Ничего из перечисленного' },
    ],
  },
  {
    kind: 'single',
    section: 'Здоровье',
    id: 'pregnancy',
    question: 'Беременность или грудное вскармливание?',
    showIf: (a) => str(a, 'sex') !== 'male',
    options: [
      { value: 'pregnant', label: 'Беременность' },
      { value: 'feeding', label: 'Кормлю грудью' },
      { value: 'planning', label: 'Планирую беременность' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    kind: 'single',
    section: 'Здоровье',
    id: 'meds',
    question: 'Принимаете лекарства, которые нужно пить с едой?',
    hint: 'Например, метформин, препараты железа, некоторые обезболивающие',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'unsure', label: 'Не уверен(а)' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    kind: 'single',
    section: 'Здоровье',
    id: 'ed',
    question: 'Были ли сложные отношения с едой?',
    hint: 'Переедание, ограничения до истощения, циклы срывов. Вопрос без осуждения — он влияет на то, что мы вам предложим',
    options: [
      { value: 'current', label: 'Да, сейчас' },
      { value: 'past', label: 'Было в прошлом' },
      { value: 'no', label: 'Нет' },
      { value: 'skip', label: 'Не хочу отвечать' },
    ],
  },

  // ─────────────────────────────── Сон и ритм
  {
    kind: 'time',
    section: 'Сон и ритм',
    id: 'bedtime',
    question: 'Во сколько обычно ложитесь спать?',
    hint: 'В обычный рабочий день',
    initial: '23:30',
  },
  { kind: 'time', section: 'Сон и ритм', id: 'wakeWeekday', question: 'Во сколько встаёте в будни?', initial: '07:00' },
  {
    kind: 'time',
    section: 'Сон и ритм',
    id: 'wakeWeekend',
    question: 'А в выходные?',
    hint: 'Разница между буднями и выходными говорит о вашем ритме больше, чем любой вопрос про «сову»',
    initial: '09:30',
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'sleepLatency',
    question: 'Сколько времени обычно засыпаете?',
    options: [
      { value: 'fast', label: 'Меньше 15 минут' },
      { value: 'mid', label: '15–30 минут' },
      { value: 'slow', label: 'Полчаса и больше' },
      { value: 'varies', label: 'По-разному' },
    ],
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'nightWake',
    question: 'Просыпаетесь ночью?',
    options: [
      { value: 'never', label: 'Почти никогда' },
      { value: 'sometimes', label: 'Пару раз в неделю' },
      { value: 'often', label: 'Почти каждую ночь' },
      { value: 'hungry', label: 'Да, и иногда от голода' },
    ],
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'morningFeel',
    question: 'Как вы себя чувствуете в первый час после подъёма?',
    hint: 'Этот вопрос взят из опросников хронотипа',
    options: [
      { value: 'fresh', label: 'Бодро, готов(а) к делам' },
      { value: 'ok', label: 'Нормально, через полчаса раскачиваюсь' },
      { value: 'slow', label: 'Тяжело, нужен кофе' },
      { value: 'awful', label: 'Очень тяжело, первый час как в тумане' },
    ],
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'energyPeak',
    question: 'Когда у вас пик энергии?',
    options: [
      { value: 'morning', label: 'Утро, до полудня' },
      { value: 'midday', label: 'Середина дня' },
      { value: 'evening', label: 'Вечер' },
      { value: 'night', label: 'Поздний вечер и ночь' },
    ],
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'shift',
    question: 'График работы',
    hint: 'Сменный график меняет всю логику окна питания',
    options: [
      { value: 'day', label: 'Обычный дневной' },
      { value: 'flex', label: 'Свободный' },
      { value: 'shifts', label: 'Сменный, включая ночные' },
      { value: 'nights', label: 'Преимущественно ночные' },
    ],
  },
  {
    kind: 'single',
    section: 'Сон и ритм',
    id: 'caffeine',
    question: 'Последний кофе или энергетик — во сколько?',
    options: [
      { value: 'morning', label: 'До полудня' },
      { value: 'afternoon', label: 'До 16:00' },
      { value: 'evening', label: 'Вечером' },
      { value: 'none', label: 'Не пью' },
    ],
  },

  // ─────────────────────────────── Еда
  { kind: 'time', section: 'Еда', id: 'firstMeal', question: 'Во сколько сейчас первый приём пищи?', initial: '08:30' },
  { kind: 'time', section: 'Еда', id: 'lastMeal', question: 'А последний?', hint: 'Считая вечерний чай с печеньем', initial: '21:30' },
  {
    kind: 'single',
    section: 'Еда',
    id: 'mealsPerDay',
    question: 'Сколько раз в день едите?',
    options: [
      { value: '1-2', label: 'Один-два раза' },
      { value: '3', label: 'Три раза' },
      { value: '4-5', label: 'Четыре-пять' },
      { value: 'grazing', label: 'Постоянно что-то жую' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'nightSnack',
    question: 'Перекусываете вечером у экрана?',
    options: [
      { value: 'often', label: 'Почти каждый вечер' },
      { value: 'sometimes', label: 'Пару раз в неделю' },
      { value: 'never', label: 'Нет' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'craving',
    question: 'Что тянет съесть вечером?',
    showIf: (a) => str(a, 'nightSnack') !== 'never',
    options: [
      { value: 'sweet', label: 'Сладкое' },
      { value: 'salty', label: 'Солёное и чипсы' },
      { value: 'carbs', label: 'Хлеб, макароны, выпечка' },
      { value: 'anything', label: 'Что попадётся' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'protein',
    question: 'Как часто едите мясо, рыбу, яйца, творог?',
    hint: 'Белок решает, уйдёт вес за счёт жира или мышц',
    options: [
      { value: 'every', label: 'Каждый приём пищи' },
      { value: 'daily', label: 'Раз в день' },
      { value: 'rare', label: 'Несколько раз в неделю' },
      { value: 'veg', label: 'Не ем животный белок' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'veggies',
    question: 'Овощи и зелень в рационе',
    options: [
      { value: 'every', label: 'Каждый день' },
      { value: 'often', label: 'Несколько раз в неделю' },
      { value: 'rare', label: 'Редко' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'cooking',
    question: 'Кто готовит?',
    options: [
      { value: 'self', label: 'Готовлю сам(а)' },
      { value: 'family', label: 'Готовят дома' },
      { value: 'mixed', label: 'Пополам с доставкой' },
      { value: 'delivery', label: 'В основном доставка и кафе' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'sweetDrinks',
    question: 'Сладкие напитки и соки',
    options: [
      { value: 'daily', label: 'Каждый день' },
      { value: 'weekly', label: 'Несколько раз в неделю' },
      { value: 'rare', label: 'Почти не пью' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'alcohol',
    question: 'Алкоголь',
    options: [
      { value: 'often', label: 'Несколько раз в неделю' },
      { value: 'weekend', label: 'По выходным' },
      { value: 'rare', label: 'Редко' },
      { value: 'never', label: 'Не употребляю' },
    ],
  },
  {
    kind: 'single',
    section: 'Еда',
    id: 'water',
    question: 'Сколько воды выпиваете за день?',
    options: [
      { value: 'low', label: 'Меньше литра' },
      { value: 'mid', label: 'Около полутора литров' },
      { value: 'high', label: 'Два литра и больше' },
      { value: 'unknown', label: 'Никогда не считал(а)' },
    ],
  },

  // ─────────────────────────────── Движение
  {
    kind: 'single',
    section: 'Движение',
    id: 'activity',
    question: 'Уровень активности',
    options: [
      { value: 'sedentary', label: 'Сидячий', sub: 'Работа за столом, спорт редко' },
      { value: 'light', label: 'Лёгкий', sub: 'Прогулки, тренировки 1–2 раза в неделю' },
      { value: 'moderate', label: 'Средний', sub: 'Тренировки 3–4 раза в неделю' },
      { value: 'high', label: 'Высокий', sub: 'Почти каждый день' },
    ],
  },
  {
    kind: 'single',
    section: 'Движение',
    id: 'steps',
    question: 'Сколько примерно проходите в день?',
    options: [
      { value: 'low', label: 'Меньше 4 000 шагов' },
      { value: 'mid', label: '4 000 – 8 000' },
      { value: 'high', label: 'Больше 8 000' },
      { value: 'unknown', label: 'Не знаю' },
    ],
  },
  {
    kind: 'single',
    section: 'Движение',
    id: 'strength',
    question: 'Опыт силовых тренировок',
    hint: 'При снижении веса силовые удерживают мышцы — это важнее, чем кажется',
    options: [
      { value: 'never', label: 'Никогда не занимался(ась)' },
      { value: 'tried', label: 'Пробовал(а), бросил(а)' },
      { value: 'past', label: 'Занимался(ась) раньше' },
      { value: 'now', label: 'Занимаюсь сейчас' },
    ],
  },
  {
    kind: 'multi',
    section: 'Движение',
    id: 'equipment',
    question: 'Что доступно для тренировок?',
    hint: 'Можно выбрать несколько',
    showIf: (a) => str(a, 'strength') !== 'now',
    exclusive: 'nothing',
    options: [
      { value: 'gym', label: 'Зал' },
      { value: 'home', label: 'Дома есть гантели или резинки' },
      { value: 'bodyweight', label: 'Только свой вес' },
      { value: 'outdoor', label: 'Улица, турники' },
      { value: 'nothing', label: 'Пока ничего' },
    ],
  },
  {
    kind: 'single',
    section: 'Движение',
    id: 'trainTime',
    question: 'Сколько времени готовы уделять тренировкам?',
    showIf: (a) => str(a, 'strength') !== 'now',
    options: [
      { value: 'none', label: 'Пока нисколько' },
      { value: '20', label: '20 минут, два раза в неделю' },
      { value: '30', label: 'Полчаса, три раза в неделю' },
      { value: '45', label: '45 минут и больше' },
    ],
  },

  // ─────────────────────────────── Настрой
  {
    kind: 'single',
    section: 'Настрой',
    id: 'experience',
    question: 'Был опыт голодания?',
    options: [
      { value: 'none', label: 'Никогда не пробовал(а)' },
      { value: 'tried', label: 'Пробовал(а), но бросил(а)' },
      { value: 'regular', label: 'Практикую регулярно' },
    ],
  },
  { kind: 'scale', section: 'Настрой', id: 'stress', question: 'Насколько напряжённые у вас дни?', low: 'Спокойные', high: 'На пределе' },
  {
    kind: 'multi',
    section: 'Настрой',
    id: 'blockers',
    question: 'Что мешало раньше?',
    hint: 'Можно выбрать несколько',
    exclusive: 'none',
    options: [
      { value: 'hunger', label: 'Сильный голод' },
      { value: 'time', label: 'Нет времени' },
      { value: 'breaks', label: 'Срывы по выходным' },
      { value: 'motivation', label: 'Заканчивается мотивация' },
      { value: 'social', label: 'Застолья и встречи' },
      { value: 'work', label: 'Рабочий график' },
      { value: 'none', label: 'Ничего, первый заход' },
    ],
  },
  {
    kind: 'single',
    section: 'Настрой',
    id: 'afterSlip',
    question: 'Что обычно происходит после срыва?',
    options: [
      { value: 'resume', label: 'Возвращаюсь на следующий день' },
      { value: 'guilt', label: 'Долго корю себя' },
      { value: 'quit', label: 'Бросаю всю затею' },
      { value: 'compensate', label: 'Пытаюсь «отработать» голоданием подольше' },
    ],
  },
  {
    kind: 'info',
    section: 'Настрой',
    id: 'info-slip',
    title: 'Срыв — это не конец попытки',
    body: 'Разница между теми, кто держится полгода, и теми, кто бросает на второй неделе, почти никогда не в силе воли. Она в том, что происходит на следующий день после пропуска. Поэтому серия в FastLoop не обнуляется мгновенно: вчерашний день ещё считается.',
    stat: '1 из 3',
    statLabel: 'попыток заканчивается на первой неделе',
  },

  // ─────────────────────────────── План
  {
    kind: 'single',
    section: 'План',
    id: 'event',
    question: 'Есть событие, к которому хотите прийти в форме?',
    options: [
      { value: 'vacation', label: 'Отпуск' },
      { value: 'wedding', label: 'Свадьба' },
      { value: 'reunion', label: 'Встреча с друзьями' },
      { value: 'summer', label: 'Лето' },
      { value: 'photo', label: 'Съёмка или важное фото' },
      { value: 'health', label: 'Приём у врача' },
      { value: 'none', label: 'Без конкретного повода' },
    ],
  },
  {
    kind: 'date',
    section: 'План',
    id: 'eventDate',
    question: 'Когда это будет?',
    hint: 'Покажем, где вы будете к этой дате',
    showIf: (a) => str(a, 'event') !== 'none',
  },
  { kind: 'scale', section: 'План', id: 'importance', question: 'Насколько важно дойти до цели?', low: 'Было бы неплохо', high: 'Очень важно' },
  {
    kind: 'single',
    section: 'План',
    id: 'pace',
    question: 'Какой темп вам ближе?',
    options: [
      { value: 'gentle', label: 'Мягкий', sub: 'Дольше, но почти без дискомфорта' },
      { value: 'steady', label: 'Ровный', sub: 'Разумный компромисс' },
      { value: 'fast', label: 'Быстрый', sub: 'Заметный результат быстрее, тяжелее держать' },
    ],
  },
  { kind: 'single', section: 'План', id: 'reminders', question: 'Присылать напоминания о старте и окончании?', options: YES_NO },
  {
    kind: 'single',
    section: 'План',
    id: 'units',
    question: 'Единицы измерения',
    options: [
      { value: 'metric', label: 'Килограммы и сантиметры' },
      { value: 'imperial', label: 'Фунты и дюймы' },
    ],
  },
  { kind: 'text', section: 'План', id: 'name', question: 'Как к вам обращаться?', placeholder: 'Имя', optional: true },
];

/** The steps that apply to this person, in order. */
export function visibleSteps(answers: Answers): readonly QuizStep[] {
  return QUIZ.filter((step) => !step.showIf || step.showIf(answers));
}

export { str as answerOf, list as answerList };

export const ANALYSIS_STEPS: readonly string[] = [
  'Считаем ИМТ и базовый расход',
  'Определяем хронотип по режиму сна',
  'Проверяем ограничения по здоровью',
  'Подбираем окно под ваш день',
  'Строим план на четыре недели',
];
