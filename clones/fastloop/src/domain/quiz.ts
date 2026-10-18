/**
 * The onboarding funnel, reconstructed from the public teardown.
 *
 * The original is reported to run ~30 questions before revealing that the
 * core controls are paid. The structure matters more than the exact wording:
 * profile facts first, then habits, then an interstitial that builds
 * commitment, then a dated personal goal the paywall can quote back.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
  readonly sub?: string;
}

export type QuizStep =
  | { readonly kind: 'single'; readonly id: string; readonly question: string; readonly hint?: string; readonly options: readonly Option[] }
  | { readonly kind: 'multi'; readonly id: string; readonly question: string; readonly hint?: string; readonly options: readonly Option[] }
  | { readonly kind: 'number'; readonly id: string; readonly question: string; readonly unit: string; readonly min: number; readonly max: number; readonly initial: number; readonly step?: number }
  | { readonly kind: 'scale'; readonly id: string; readonly question: string; readonly low: string; readonly high: string }
  | { readonly kind: 'date'; readonly id: string; readonly question: string; readonly hint?: string }
  | { readonly kind: 'text'; readonly id: string; readonly question: string; readonly placeholder: string; readonly optional: boolean }
  | { readonly kind: 'info'; readonly id: string; readonly title: string; readonly body: string; readonly stat?: string; readonly statLabel?: string };

const yesNo: readonly Option[] = [
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

export const QUIZ: readonly QuizStep[] = [
  { kind: 'single', id: 'sex', question: 'Ваш пол', hint: 'Нужен, чтобы оценить расход энергии', options: [
    { value: 'female', label: 'Женский' },
    { value: 'male', label: 'Мужской' },
    { value: 'other', label: 'Не хочу указывать' },
  ] },
  { kind: 'number', id: 'age', question: 'Сколько вам лет?', unit: 'лет', min: 14, max: 99, initial: 32 },
  { kind: 'number', id: 'height', question: 'Ваш рост', unit: 'см', min: 120, max: 220, initial: 170 },
  { kind: 'number', id: 'weight', question: 'Текущий вес', unit: 'кг', min: 35, max: 250, initial: 78, step: 0.5 },
  { kind: 'number', id: 'goalWeight', question: 'Какой вес вы хотите?', unit: 'кг', min: 35, max: 250, initial: 68, step: 0.5 },
  { kind: 'single', id: 'goal', question: 'Главная цель', options: [
    { value: 'lose', label: 'Снизить вес' },
    { value: 'maintain', label: 'Удержать вес' },
    { value: 'energy', label: 'Больше энергии' },
    { value: 'health', label: 'Здоровье и привычки' },
    { value: 'clarity', label: 'Ясность в голове' },
  ] },
  { kind: 'info', id: 'info-fit', title: 'Интервальное голодание хорошо ложится на такую цель', body: 'Вы не меняете состав еды — вы сдвигаете её во времени. Для большинства людей это проще, чем считать калории, потому что решение принимается один раз в день, а не за каждым приёмом пищи.' },
  { kind: 'single', id: 'experience', question: 'Был опыт голодания?', options: [
    { value: 'none', label: 'Никогда не пробовал(а)' },
    { value: 'tried', label: 'Пробовал(а), но бросил(а)' },
    { value: 'regular', label: 'Практикую регулярно' },
  ] },
  { kind: 'single', id: 'breakfast', question: 'Как часто вы завтракаете?', options: [
    { value: 'daily', label: 'Каждый день' },
    { value: 'sometimes', label: 'Через день' },
    { value: 'rare', label: 'Почти никогда' },
  ] },
  { kind: 'single', id: 'firstMeal', question: 'Во сколько первый приём пищи?', options: [
    { value: '6-8', label: 'С 6:00 до 8:00' },
    { value: '8-10', label: 'С 8:00 до 10:00' },
    { value: '10-12', label: 'С 10:00 до 12:00' },
    { value: '12+', label: 'После 12:00' },
  ] },
  { kind: 'single', id: 'lastMeal', question: 'Во сколько последний приём пищи?', options: [
    { value: '-18', label: 'До 18:00' },
    { value: '18-20', label: 'С 18:00 до 20:00' },
    { value: '20-22', label: 'С 20:00 до 22:00' },
    { value: '22+', label: 'После 22:00' },
  ] },
  { kind: 'single', id: 'nightSnack', question: 'Перекусываете вечером у экрана?', options: [
    { value: 'often', label: 'Почти каждый вечер' },
    { value: 'sometimes', label: 'Пару раз в неделю' },
    { value: 'never', label: 'Нет' },
  ] },
  { kind: 'multi', id: 'drinks', question: 'Что пьёте в обычный день?', hint: 'Можно выбрать несколько', options: [
    { value: 'coffee', label: 'Кофе' },
    { value: 'tea', label: 'Чай' },
    { value: 'soda', label: 'Газировка' },
    { value: 'juice', label: 'Соки' },
    { value: 'alcohol', label: 'Алкоголь' },
    { value: 'water', label: 'Только воду' },
  ] },
  { kind: 'single', id: 'sweets', question: 'Сладкое в течение дня', options: [
    { value: 'high', label: 'Каждый день' },
    { value: 'mid', label: 'Несколько раз в неделю' },
    { value: 'low', label: 'Редко' },
  ] },
  { kind: 'single', id: 'fastfood', question: 'Как часто фастфуд или доставка?', options: [
    { value: 'high', label: 'Чаще трёх раз в неделю' },
    { value: 'mid', label: 'Раз или два в неделю' },
    { value: 'low', label: 'Реже раза в неделю' },
  ] },
  { kind: 'single', id: 'water', question: 'Сколько воды выпиваете за день?', options: [
    { value: 'low', label: 'Меньше литра' },
    { value: 'mid', label: 'Около полутора литров' },
    { value: 'high', label: 'Два литра и больше' },
  ] },
  { kind: 'single', id: 'activity', question: 'Уровень активности', options: [
    { value: 'sedentary', label: 'Сидячий', sub: 'Работа за столом, спорт редко' },
    { value: 'light', label: 'Лёгкий', sub: 'Прогулки, тренировки 1–2 раза в неделю' },
    { value: 'moderate', label: 'Средний', sub: 'Тренировки 3–4 раза в неделю' },
    { value: 'high', label: 'Высокий', sub: 'Почти каждый день' },
  ] },
  { kind: 'single', id: 'steps', question: 'Сколько примерно проходите в день?', options: [
    { value: 'low', label: 'Меньше 4 000 шагов' },
    { value: 'mid', label: '4 000 – 8 000' },
    { value: 'high', label: 'Больше 8 000' },
  ] },
  { kind: 'single', id: 'sleep', question: 'Сколько часов спите?', options: [
    { value: 'low', label: 'Меньше 6 часов' },
    { value: 'mid', label: '6–7 часов' },
    { value: 'ok', label: '7–8 часов' },
    { value: 'high', label: 'Больше 8 часов' },
  ] },
  { kind: 'scale', id: 'stress', question: 'Насколько напряжённые у вас дни?', low: 'Спокойные', high: 'На пределе' },
  { kind: 'info', id: 'info-sleep', title: 'Сон и стресс влияют на голод сильнее, чем кажется', body: 'Недосып поднимает тягу к быстрым углеводам уже на следующий день. Поэтому FastLoop не ставит вам жёсткое окно сразу — начнём с мягкой схемы и посмотрим на данные.' },
  { kind: 'multi', id: 'zones', question: 'Что хотели бы изменить в первую очередь?', hint: 'Можно выбрать несколько', options: [
    { value: 'belly', label: 'Живот' },
    { value: 'hips', label: 'Бёдра' },
    { value: 'arms', label: 'Руки' },
    { value: 'face', label: 'Лицо' },
    { value: 'overall', label: 'Общий объём' },
  ] },
  { kind: 'multi', id: 'blockers', question: 'Что мешало раньше?', hint: 'Можно выбрать несколько', options: [
    { value: 'hunger', label: 'Сильный голод' },
    { value: 'time', label: 'Нет времени' },
    { value: 'breaks', label: 'Срывы по выходным' },
    { value: 'motivation', label: 'Заканчивается мотивация' },
    { value: 'social', label: 'Застолья и встречи' },
    { value: 'none', label: 'Ничего, первый заход' },
  ] },
  { kind: 'info', id: 'info-social', title: 'Срывы — это не провал плана', body: 'В разборах привычек люди, которые возвращаются к схеме после пропуска, держатся заметно дольше тех, кто считает пропуск концом попытки. Поэтому в FastLoop серия не обнуляется мгновенно: вчерашний день ещё считается.', stat: '1 из 3', statLabel: 'попыток бросают на первой же неделе' },
  { kind: 'single', id: 'event', question: 'Есть событие, к которому хотите прийти в форме?', options: [
    { value: 'vacation', label: 'Отпуск' },
    { value: 'wedding', label: 'Свадьба' },
    { value: 'reunion', label: 'Встреча с друзьями' },
    { value: 'summer', label: 'Лето' },
    { value: 'photo', label: 'Съёмка или важное фото' },
    { value: 'none', label: 'Без конкретного повода' },
  ] },
  { kind: 'date', id: 'eventDate', question: 'Когда это будет?', hint: 'Покажем, где вы будете к этой дате' },
  { kind: 'scale', id: 'importance', question: 'Насколько для вас важно дойти до цели?', low: 'Было бы неплохо', high: 'Очень важно' },
  { kind: 'single', id: 'commit', question: 'Готовы уделять приложению 2 минуты в день?', hint: 'Отметить старт, завершение и вес', options: yesNo },
  { kind: 'single', id: 'reminders', question: 'Присылать напоминания о старте и окончании?', options: yesNo },
  { kind: 'single', id: 'units', question: 'Единицы измерения', options: [
    { value: 'metric', label: 'Килограммы и сантиметры' },
    { value: 'imperial', label: 'Фунты и дюймы' },
  ] },
  { kind: 'text', id: 'name', question: 'Как к вам обращаться?', placeholder: 'Имя', optional: true },
];

export const ANALYSIS_STEPS: readonly string[] = [
  'Считаем ИМТ и базовый расход',
  'Подбираем длину окна голодания',
  'Сверяем с режимом сна и активностью',
  'Учитываем прошлые срывы',
  'Собираем личный план',
];
