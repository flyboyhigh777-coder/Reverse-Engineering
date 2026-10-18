/**
 * What to do when a fast starts going wrong.
 *
 * The clinical review put this first: it is the one screen that has to be
 * reachable in a single tap from the timer, and it is the screen the apps in
 * this category tend not to have at all. Content follows guidance from Mayo
 * Clinic, Cleveland Clinic and Cedars-Sinai; the 15–15 rule is the standard
 * first response to hypoglycaemia.
 */

export interface SafetyBlock {
  readonly id: string;
  readonly tone: 'stop' | 'emergency' | 'doctor' | 'normal';
  readonly title: string;
  readonly lead?: string;
  readonly items: readonly string[];
  readonly action?: string;
}

export const SAFETY: readonly SafetyBlock[] = [
  {
    id: 'stop',
    tone: 'stop',
    title: 'Прервать голодание и поесть',
    lead: 'Возможные признаки низкого сахара в крови:',
    items: [
      'дрожь в руках, тремор',
      'холодный пот',
      'головокружение, предобморочное состояние',
      'учащённое сердцебиение в покое',
      'резкий, «неправильный» голод',
      'бледность',
      'тревога, раздражительность',
      'спутанность сознания, трудно собрать мысли',
    ],
    action:
      'Если есть дрожь и хотя бы один из остальных признаков — правило 15–15: съесть около 15 г быстрых углеводов (сок, сахар, глюкоза), через 15 минут оценить состояние и при необходимости повторить. Лёгкая дрожь бывает и от кофеина, обезвоживания или нехватки электролитов, но проверять это на себе во время голодания не стоит.',
  },
  {
    id: 'emergency',
    tone: 'emergency',
    title: 'Вызывать скорую — 103 или 112',
    items: [
      'потеря сознания, обморок',
      'судороги',
      'спутанность сознания, которая не проходит после еды',
      'невозможность глотать',
      'сильная слабость или сонливость, не проходящая после первой помощи',
    ],
  },
  {
    id: 'doctor',
    tone: 'doctor',
    title: 'Обратиться к врачу — не срочно, но обязательно',
    items: [
      'признаки низкого сахара у человека без диабета — это само по себе повод обследоваться',
      'эпизоды повторяются',
      'прекратились менструации',
      'постоянная слабость, зябкость, выпадение волос, нарушения сна — признаки слишком жёсткого дефицита',
    ],
  },
  {
    id: 'normal',
    tone: 'normal',
    title: 'Обычно проходит само',
    lead: 'Эти ощущения в первые недели типичны и чаще всего слабеют:',
    items: ['голод волнами по 15–20 минут', 'утомляемость', 'головная боль', 'раздражительность', 'лёгкая тошнота'],
    action:
      'Если через две-три недели легче не становится — окно выбрано слишком длинным. Это не вопрос силы воли, а вопрос настройки.',
  },
];
