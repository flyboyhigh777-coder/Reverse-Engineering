import { useMemo, useState } from 'react';
import { buildCsv, csvFileName } from '../../domain/exportCsv';
import { DISCLAIMER } from '../../domain/phases';
import { resolvePlan } from '../../domain/plans';
import { formatWeight, waterTargetMl } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { Card, LockPill, Sheet } from '../components/common';

export function Profile({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const { profile } = state;
  const plan = resolvePlan(state.planId, state.customFastHours);

  return (
    <>
      <h1 style={{ fontSize: 21 }}>Профиль</h1>

      <Card>
        <div className="row between">
          <span className="eyebrow">Подписка</span>
          <span className={state.premium ? 'pill accent' : 'pill'}>{state.premium ? 'PRO включён' : 'Бесплатный режим'}</span>
        </div>
        {state.premium ? (
          <>
            <p className="tiny muted">
              Все схемы, история и разбор фаз открыты. В этой сборке PRO включён по умолчанию — оплаты не было и не будет.
            </p>
            <button type="button" className="btn ghost sm" onClick={() => actions.setPremium(false)}>
              Выключить PRO и посмотреть бесплатный режим
            </button>
          </>
        ) : (
          <>
            <p className="tiny muted">
              Заперты схемы 18:6 и длиннее, правка времени окна, полная история и разбор фаз — так же, как в оригинале.
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="button" className="btn sm" onClick={() => actions.setPremium(true)}>
                Вернуть PRO
              </button>
              <button type="button" className="btn ghost sm" onClick={() => onRequestPro('Полный доступ к схемам, истории и фазам.')}>
                Посмотреть экран PRO
              </button>
            </div>
          </>
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
          Напоминания пока не отправляются ни в вебе, ни в Android-сборке: переключатель сохраняет выбор на будущее.
          Приложение не запрашивает разрешение на уведомления и ничего не присылает.
        </p>
      </Card>

      <Card>
        <span className="eyebrow">Ваши данные</span>
        <dl className="col" style={{ gap: 8, margin: 0 }}>
          <Row label="Схема" value={`${plan.title} · ${plan.fastHours} ч`} />
          <Row label="Рост" value={profile.heightCm ? `${profile.heightCm} см` : '—'} />
          <Row label="Возраст" value={profile.age ? `${profile.age}` : '—'} />
          <Row label="Старт" value={profile.startKg ? formatWeight(profile.startKg, profile.units) : '—'} />
          <Row label="Цель" value={profile.goalKg ? formatWeight(profile.goalKg, profile.units) : '—'} />
          <Row label="Норма воды" value={`${waterTargetMl(profile.sex, profile.activity)} мл`} />
        </dl>
      </Card>

      <Card>
        <span className="eyebrow">Данные приложения</span>
        <p className="tiny muted">
          Всё хранится только в этом браузере — ни аккаунта, ни отправки на сервер. Очистка истории браузера удалит данные.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => (state.premium ? setShowExport(true) : onRequestPro('Экспорт записей в CSV входит в PRO.'))}
          >
            <span className="row" style={{ gap: 6 }}>
              Экспорт в CSV {state.premium ? null : <LockPill />}
            </span>
          </button>
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

      {showExport ? <ExportSheet onClose={() => setShowExport(false)} /> : null}

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

function ExportSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const csv = useMemo(() => buildCsv(state, now), [state, now]);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <Sheet title={csvFileName(now)} onClose={onClose}>
      <p className="tiny muted">
        Все голодания, записи веса, воды и шагов. Разделитель — точка с запятой: Excel с русской локалью откроет файл
        по столбцам без импорта.
      </p>
      <textarea
        id="export-csv"
        readOnly
        value={csv}
        rows={8}
        onFocus={(event) => event.currentTarget.select()}
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          lineHeight: 1.45,
          padding: 10,
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          resize: 'vertical',
        }}
      />
      <button type="button" className="btn block" onClick={copy}>
        {copied === 'ok' ? 'Скопировано' : 'Скопировать'}
      </button>
      {copied === 'fail' ? (
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Браузер не дал доступ к буферу. Выделите текст выше и скопируйте вручную.
        </p>
      ) : null}
    </Sheet>
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
