import { useState } from 'react';
import { DISCLAIMER } from '../../domain/phases';
import { planById } from '../../domain/plans';
import { formatWeight, waterTargetMl } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { Card, Sheet } from '../components/common';

export function Profile({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const { profile } = state;

  return (
    <>
      <h1 style={{ fontSize: 21 }}>Профиль</h1>

      <Card>
        <div className="row between">
          <span className="eyebrow">Подписка</span>
          <span className={state.premium ? 'pill accent' : 'pill'}>{state.premium ? 'PRO включён' : 'Бесплатный режим'}</span>
        </div>
        {state.premium ? (
          <p className="tiny muted">Все схемы и история открыты. Это демо-флаг, никакой оплаты не было.</p>
        ) : (
          <button type="button" className="btn block" onClick={() => onRequestPro('Полный доступ к схемам, истории и фазам.')}>
            Посмотреть PRO
          </button>
        )}
      </Card>

      <Card>
        <span className="eyebrow">Имя</span>
        <input
          id="profile-name"
          type="text"
          placeholder="Как к вам обращаться"
          value={profile.name}
          onChange={(event) => actions.setName(event.target.value)}
        />

        <span className="eyebrow">Единицы</span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="chip" aria-pressed={profile.units === 'metric'} onClick={() => actions.setUnits('metric')}>
            Килограммы
          </button>
          <button type="button" className="chip" aria-pressed={profile.units === 'imperial'} onClick={() => actions.setUnits('imperial')}>
            Фунты
          </button>
        </div>

        <span className="eyebrow">Напоминания</span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="chip" aria-pressed={profile.reminders} onClick={() => actions.setReminders(true)}>
            Включены
          </button>
          <button type="button" className="chip" aria-pressed={!profile.reminders} onClick={() => actions.setReminders(false)}>
            Выключены
          </button>
        </div>
        <p className="tiny muted">
          Веб-версия не шлёт системные уведомления — переключатель сохраняется, но напоминания не приходят.
        </p>
      </Card>

      <Card>
        <span className="eyebrow">Ваши данные</span>
        <dl className="col" style={{ gap: 8, margin: 0 }}>
          <Row label="Схема" value={`${planById(state.planId).title} · ${planById(state.planId).fastHours} ч`} />
          <Row label="Рост" value={profile.heightCm ? `${profile.heightCm} см` : '—'} />
          <Row label="Возраст" value={profile.age ? `${profile.age}` : '—'} />
          <Row label="Старт" value={profile.startKg ? formatWeight(profile.startKg, profile.units) : '—'} />
          <Row label="Цель" value={profile.goalKg ? formatWeight(profile.goalKg, profile.units) : '—'} />
          <Row label="Норма воды" value={`${waterTargetMl(profile.startKg)} мл`} />
        </dl>
      </Card>

      <Card>
        <span className="eyebrow">Данные приложения</span>
        <p className="tiny muted">
          Всё хранится только в этом браузере — ни аккаунта, ни отправки на сервер. Очистка истории браузера удалит данные.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={() => actions.loadDemo()}>
            Загрузить демо-данные
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setConfirmReset(true)}>
            Стереть всё
          </button>
        </div>
      </Card>

      <p className="banner">{DISCLAIMER}</p>

      <p className="tiny muted">
        FastLoop — независимая учебная реализация трекера интервального голодания. Не связана с GoFasting и его разработчиком,
        не содержит их кода, ресурсов и товарных знаков.
      </p>

      {confirmReset ? (
        <Sheet title="Стереть все данные?" onClose={() => setConfirmReset(false)}>
          <p className="tiny muted">
            Удалятся история голоданий, записи веса, воды и шагов, а также ответы онбординга. Отменить нельзя.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost grow" onClick={() => setConfirmReset(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn grow"
              style={{ background: 'var(--danger)', color: '#fff' }}
              onClick={() => {
                actions.reset();
                setConfirmReset(false);
              }}
            >
              Стереть
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="row between">
      <dt className="tiny muted">{label}</dt>
      <dd className="tiny num" style={{ margin: 0, fontWeight: 600 }}>
        {value}
      </dd>
    </div>
  );
}
