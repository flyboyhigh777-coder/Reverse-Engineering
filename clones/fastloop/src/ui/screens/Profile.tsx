import { useMemo, useState } from 'react';
import { buildCsv, csvFileName } from '../../domain/exportCsv';
import { DISCLAIMER } from '../../domain/phases';
import { resolvePlan } from '../../domain/plans';
import { formatWeight, waterTargetMl } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { THEME_LABELS, hasNativeTheme } from '../../state/theme';
import type { ThemePreference } from '../../state/theme';
import { VISION_MODEL, VISION_NOTE } from '../../domain/vision';
import { maskKey, readVisionKey, writeVisionKey } from '../../state/visionKey';
import { BackupSheet } from '../components/BackupSheet';
import { Card, LockPill, Sheet } from '../components/common';

export function Profile({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
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

        <span className="eyebrow">Оформление</span>
        <div className="row wrap" style={{ gap: 8 }}>
          {(['auto', 'light', 'dark'] as ThemePreference[]).map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={profile.theme === value}
              onClick={() => actions.setTheme(value)}
            >
              {THEME_LABELS[value]}
            </button>
          ))}
        </div>
        <p className="tiny muted">
          {hasNativeTheme()
            ? 'В режиме «как в телефоне» приложение переключается вместе с системной тёмной темой — сразу, без перезапуска.'
            : 'В браузере режим «как в телефоне» следует настройке оформления системы.'}
        </p>

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

      <VisionCard />

      <Card>
        <span className="eyebrow">Данные приложения</span>
        <p className="tiny muted">
          Всё хранится только на этом устройстве — ни аккаунта, ни отправки на сервер. Удаление приложения или очистка
          истории браузера стирает записи без следа, поэтому перед переустановкой сделайте копию.
        </p>
        <button type="button" className="btn block" onClick={() => setShowBackup(true)}>
          Резервная копия
        </button>
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

      {showBackup ? <BackupSheet onClose={() => setShowBackup(false)} /> : null}

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

/**
 * The one switch that lets the app reach the network.
 *
 * Off by default and off until a key is pasted here, so the promise that
 * nothing leaves the phone is true for anyone who never opens this card.
 */
function VisionCard(): JSX.Element {
  const [key, setKey] = useState<string | null>(() => readVisionKey());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">ИИ-камера</span>
        <span className={key ? 'pill accent' : 'pill'}>{key ? 'включена' : 'выключена'}</span>
      </div>
      <p className="tiny muted">
        Распознаёт блюдо на фотографии и оценивает калории и БЖУ. Работает через Claude ({VISION_MODEL}) и требует вашего
        ключа с console.anthropic.com. Каждое фото — платный запрос на вашем счету.
      </p>
      <p className="tiny muted">
        Пока ключа нет, приложение не делает ни одного сетевого запроса. С ключом в сеть уходит только сам снимок, в
        момент распознавания; ни фото, ни ответ нигде не сохраняются, а ключ не попадает в резервную копию.
      </p>

      {key && !editing ? (
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="pill num">{maskKey(key)}</span>
          <button type="button" className="btn ghost sm" onClick={() => { setEditing(true); setDraft(''); }}>
            Заменить
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              writeVisionKey(null);
              setKey(null);
            }}
          >
            Удалить ключ
          </button>
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          <input
            id="vision-key"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn sm grow"
              disabled={draft.trim() === ''}
              onClick={() => {
                writeVisionKey(draft);
                setKey(readVisionKey());
                setEditing(false);
                setDraft('');
              }}
            >
              Сохранить ключ
            </button>
            {key ? (
              <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>
                Отмена
              </button>
            ) : null}
          </div>
        </div>
      )}

      <p className="tiny muted">{VISION_NOTE}</p>
    </Card>
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
