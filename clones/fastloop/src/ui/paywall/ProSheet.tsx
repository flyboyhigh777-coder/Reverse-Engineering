import { actions } from '../../state/store';
import { Sheet } from '../components/common';

const PERKS: readonly string[] = [
  'Полный разбор тренера: какая длина окна подходит вам по собственным оценкам',
  'Все схемы, включая 18:6, 20:4, OMAD и своё окно с точностью до получаса',
  'Расписание по дням недели — короткая схема на выходные вместо срыва',
  'Свободная правка времени старта и финиша',
  'Полная история голоданий и экспорт всех записей в CSV',
  'Подробный разбор фаз и статьи о тренировках, кето и плато',
];

export function ProSheet({ reason, onClose }: { reason: string; onClose: () => void }): JSX.Element {
  return (
    <Sheet title="Это функция PRO" onClose={onClose}>
      <p className="tiny muted">{reason}</p>
      <ul className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
        {PERKS.map((perk) => (
          <li key={perk} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <div className="col" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn block"
          onClick={() => {
            actions.unlockPremium();
            onClose();
          }}
        >
          Включить PRO
        </button>
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Демо: оплата не проводится, флаг включается локально.
        </p>
      </div>
    </Sheet>
  );
}
