import { useMemo, useState, useSyncExternalStore } from 'react';
import { buildCsv, csvFileName } from '../../domain/exportCsv';
import { DISCLAIMER } from '../../domain/phases';
import { resolvePlan } from '../../domain/plans';
import { formatWeight, waterTargetMl } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { THEME_LABELS, hasNativeTheme } from '../../state/theme';
import type { ThemePreference } from '../../state/theme';
import { DEFAULT_PROVIDER, VISION_NOTE, VISION_PROVIDERS, clearVisionLog, describeLog, providerById, subscribeVisionLog, visionLog } from '../../domain/vision';
import type { ProviderId } from '../../domain/vision';
import { maskKey, readVisionAccess, writeVisionAccess } from '../../state/visionKey';
import type { VisionAccess } from '../../state/visionKey';
import { DEFAULT_URL, refreshContent, setContentUrl, useContent } from '../../state/content';
import { findAllPhotos, forgetPhotos, setPhotosEnabled, usePhotoStats, usePhotosEnabled } from '../../state/photos';
import { BackupSheet } from '../components/BackupSheet';
import { Card, LockPill, Sheet } from '../components/common';
import { KeyField, KeyHowTo } from '../components/VisionKey';

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
              Открыты 12:12, 13:11, 14:10 и 16:8. Остальные схемы, своё окно, правка времени, полная история и разбор фаз
              заперты.
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

      <ContentCard />

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
        FastLoop — самостоятельная разработка: весь код написан с нуля и собран вручную, без заимствованных материалов.
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

/** Articles and recipes pulled over the network, and where from. */
function ContentCard(): JSX.Element {
  const content = useContent();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content.url);

  const when =
    content.fetchedAt === null
      ? 'ещё не обновлялось'
      : `обновлено ${new Date(content.fetchedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;

  const photos = usePhotosEnabled();
  const shots = usePhotoStats();

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">Статьи и рецепты из сети</span>
        {content.fromNetwork > 0 ? <span className="pill accent num">+{content.fromNetwork}</span> : null}
      </div>

      <p className="tiny muted">
        Библиотека внутри приложения работает без интернета. По этому адресу приложение забирает дополнение к ней —
        новые статьи, рецепты и заметки дня — и запоминает их, чтобы читать потом офлайн.
      </p>

      <div className="row between">
        <span className="tiny muted">{when}</span>
        <button type="button" className="btn sm" disabled={content.status === 'loading'} onClick={() => void refreshContent()}>
          {content.status === 'loading' ? 'Проверяю…' : 'Обновить сейчас'}
        </button>
      </div>

      <hr className="divider" />

      <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="col grow" style={{ gap: 2 }}>
          <strong className="tiny">Фотографии блюд</strong>
          <span className="tiny muted">
            Карточки рецептов подтягивают снимок с Wikimedia Commons и подписывают автора. Выключите, если не хотите
            тратить мобильный трафик — останутся рисованные обложки.
          </span>
        </span>
        <button
          type="button"
          className="chip"
          aria-pressed={photos}
          onClick={() => setPhotosEnabled(!photos)}
        >
          {photos ? 'вкл' : 'выкл'}
        </button>
      </div>

      {photos ? (
        <div className="col" style={{ gap: 8 }}>
          <span className="tiny num">
            Найдено {shots.found} из {shots.total}
            {shots.pending > 0 ? ` · ещё не искали ${shots.pending}` : ''}
            {shots.missing > 0 ? ` · без фото ${shots.missing}` : ''}
          </span>
          {shots.reasons.length > 0 ? (
            <span className="tiny muted">
              Почему не нашлось: {shots.reasons.map(([reason, count]) => `${reason} — ${count}`).join(', ')}.
            </span>
          ) : null}
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={() => findAllPhotos()}>
              Поискать остальные
            </button>
            <button
              type="button"
              className="btn quiet sm"
              onClick={() => {
                forgetPhotos();
                findAllPhotos();
              }}
            >
              Искать заново
            </button>
          </div>
        </div>
      ) : null}

      {content.status === 'error' && content.message ? (
        <p className="banner tiny" style={{ color: 'var(--warn)' }}>{content.message}</p>
      ) : null}
      {content.status === 'ok' ? (
        <p className="tiny" style={{ color: 'var(--good)' }}>
          Загружено записей: {content.fromNetwork}
          {content.packUpdatedAt ? ` · выпуск от ${content.packUpdatedAt}` : ''}
          {content.message ? ` · ${content.message}` : ''}
        </p>
      ) : null}

      {editing ? (
        <div className="col" style={{ gap: 8 }}>
          <input
            id="content-url"
            type="url"
            inputMode="url"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn sm grow"
              onClick={() => {
                setContentUrl(draft);
                setEditing(false);
                void refreshContent(draft.trim() === '' ? DEFAULT_URL : draft.trim());
              }}
            >
              Сохранить и проверить
            </button>
            <button type="button" className="btn ghost sm" onClick={() => { setDraft(content.url); setEditing(false); }}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn quiet tiny" onClick={() => { setDraft(content.url); setEditing(true); }}>
          Сменить адрес обновлений
        </button>
      )}
    </Card>
  );
}

/**
 * The one switch that lets the app reach the network.
 *
 * Off by default and off until a key is pasted here, so the promise that
 * nothing leaves the phone is true for anyone who never opens this card.
 */
function VisionCard(): JSX.Element {
  const [access, setAccess] = useState<VisionAccess | null>(() => readVisionAccess());
  const [chosen, setChosen] = useState<ProviderId>(() => readVisionAccess()?.provider ?? DEFAULT_PROVIDER);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const active = access ? providerById(access.provider) : providerById(chosen);
  const shown = access && !editing ? active : providerById(chosen);

  const verify = async (provider: ProviderId, candidate: string) => {
    setChecking(true);
    setVerdict(null);
    const result = await providerById(provider).check(candidate);
    setChecking(false);
    if (result.ok) {
      const saved: VisionAccess = { provider, key: candidate, model: result.model ?? null };
      writeVisionAccess(saved);
      setAccess(saved);
      setVerdict({ ok: true, text: `Ключ работает — камера готова. Модель: ${saved.model ?? providerById(provider).model}.` });
    } else {
      setVerdict({ ok: false, text: result.reason });
    }
  };

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">ИИ-камера</span>
        <span className={access ? 'pill accent' : 'pill'}>{access ? 'включена' : 'выключена'}</span>
      </div>
      <p className="tiny muted">
        Распознаёт блюдо на фотографии и оценивает калории и БЖУ. Своего сервера у приложения нет, поэтому нужен ваш
        ключ — выберите, чей. Снимок уходит выбранному сервису в момент распознавания; ни фото, ни ответ нигде не
        сохраняются, а ключ не попадает в резервную копию.
      </p>

      {!access || editing ? (
        <div className="row wrap" style={{ gap: 7 }}>
          {VISION_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className="chip"
              aria-pressed={chosen === provider.id}
              onClick={() => {
                setChosen(provider.id);
                setVerdict(null);
              }}
            >
              {provider.title}
              <span className={provider.free ? 'pill accent' : 'pill'} style={{ fontSize: 10 }}>
                {provider.free ? 'бесплатно' : 'платно'}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!access || editing ? <KeyHowTo provider={shown} /> : null}

      {access && !editing ? (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="pill">{active.title}</span>
            <span className="pill num">{maskKey(access.key)}</span>
            <button type="button" className="btn sm" disabled={checking} onClick={() => void verify(access.provider, access.key)}>
              {checking ? 'Проверяю…' : 'Проверить ключ'}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setEditing(true);
                setChosen(access.provider);
                setDraft('');
                setVerdict(null);
              }}
            >
              Заменить
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                writeVisionAccess(null);
                setAccess(null);
                setVerdict(null);
              }}
            >
              Удалить
            </button>
          </div>
          {access.model ? <span className="tiny muted num">Модель: {access.model}</span> : null}
          {verdict ? (
            <p className="banner tiny" style={verdict.ok ? { color: 'var(--good)' } : { color: 'var(--warn)' }}>
              {verdict.text}
            </p>
          ) : null}
        </>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          <KeyField provider={shown} id="vision-key" value={draft} onChange={setDraft} />
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn sm grow"
              disabled={draft.trim() === '' || checking}
              onClick={() => {
                const candidate = draft.trim();
                setEditing(false);
                setDraft('');
                void verify(chosen, candidate);
              }}
            >
              {checking ? 'Проверяю…' : draft.trim() === '' ? 'Сначала вставьте ключ ↑' : 'Сохранить и проверить'}
            </button>
            {access ? (
              <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>
                Отмена
              </button>
            ) : null}
          </div>
          {verdict ? (
            <p className="banner tiny" style={verdict.ok ? { color: 'var(--good)' } : { color: 'var(--warn)' }}>
              {verdict.text}
            </p>
          ) : null}
        </div>
      )}

      <VisionLog />

      <p className="tiny muted">{VISION_NOTE}</p>
    </Card>
  );
}

/**
 * What actually happened on the last few attempts.
 *
 * The feature cannot be tested where it is built — the network policy here
 * refuses every provider — so when someone says the camera does not work,
 * this is the only way to learn more than «не получилось». It shows the
 * server's own words, which the translated message throws away.
 */
function VisionLog(): JSX.Element | null {
  const entries = useSyncExternalStore(subscribeVisionLog, visionLog, visionLog);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (entries.length === 0) return null;
  const text = describeLog(entries);

  return (
    <div className="col" style={{ gap: 8 }}>
      <hr className="divider" />
      <div className="row between" style={{ gap: 10 }}>
        <button type="button" className="btn quiet sm" style={{ padding: 0 }} onClick={() => setOpen(!open)}>
          {open ? 'Скрыть, что происходило' : `Что происходило · последних попыток: ${entries.length}`}
        </button>
        {entries[0] && !entries[0].ok ? <span className="pill" style={{ color: 'var(--warn)' }}>была ошибка</span> : null}
      </div>
      {open ? (
        <>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 11.5,
              lineHeight: 1.45,
              background: 'var(--surface-2)',
              borderRadius: 12,
              padding: '10px 11px',
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {text}
          </pre>
          <div className="row wrap" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => { clearVisionLog(); setCopied(false); }}>
              Очистить
            </button>
          </div>
          <p className="tiny muted">
            Здесь настоящий ответ сервера, а не его перевод. Если камера не работает — пришлите мне этот текст, по нему
            видно, что именно отказало. Записи живут только до перезапуска приложения и никуда не отправляются сами.
          </p>
        </>
      ) : null}
    </div>
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
