import { useState } from 'react';
import {
  HOUR_MS,
  elapsedMs,
  formatClock,
  formatDuration,
  formatHoursShort,
  isoDate,
  progress,
  remainingMs,
} from '../../domain/fasting';
import { nextPhaseAfter, phaseAtHours } from '../../domain/phases';
import { CUSTOM_MAX_HOURS, CUSTOM_MIN_HOURS, LEVEL_HINT, LEVEL_ORDER, PLANS, WEEKDAYS, resolvePlan } from '../../domain/plans';
import { activePlan } from '../../domain/schedule';
import { readDiagnostics, useStepCounter } from '../../state/steps';
import { WATER_NOTE, fastStats, stepsTarget, waterTargetMl, formatWeight, displayToKg, weightUnit } from '../../domain/metrics';
import type { PlanId } from '../../domain/types';
import { actions, useAppState } from '../../state/store';
import { useNow } from '../useNow';
import { CoachCard } from '../components/CoachCard';
import { Ring, PhaseRail } from '../components/Ring';
import { SafetySheet } from '../components/SafetySheet';
import { WellbeingSheet } from '../components/WellbeingSheet';
import { Ruler, WEIGHT_SCALE } from '../components/Ruler';
import { Card, DropIcon, LockPill, ScaleIcon, Sheet, StepIcon } from '../components/common';

export function Timer({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const now = useNow(state.current !== null);
  const [sheet, setSheet] = useState<'plan' | 'start' | 'weight' | 'steps' | 'phase' | 'safety' | null>(null);

  const plan = activePlan(state, now);
  const counter = useStepCounter();
  const session = state.current;
  const elapsed = session ? elapsedMs(session, now) : 0;
  const hours = elapsed / HOUR_MS;
  const phase = phaseAtHours(hours);
  const next = nextPhaseAfter(hours);
  const stats = fastStats(state.history, now);
  const today = state.days.find((d) => d.date === isoDate(now));
  const waterGoal = waterTargetMl(state.profile.sex, state.profile.activity);
  const stepGoal = stepsTarget(state.profile.activity);
  const lastWeight = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const ratio = session ? progress(session, now) : 0;

  const greeting = state.profile.name.trim() ? `Привет, ${state.profile.name.trim()}` : 'Привет';

  return (
    <>
      <div className="row between">
        <h1 style={{ fontSize: 21 }}>{greeting}</h1>
        {stats.streak > 0 ? <span className="pill accent num">🔥 {stats.streak} дн. подряд</span> : null}
      </div>

      {state.observationMode ? (
        <Card>
          <span className="eyebrow">Режим наблюдения</span>
          <p className="tiny">
            По вашим ответам схема голодания не предлагается. Дневник веса, вода, шаги и статьи работают как обычно.
          </p>
          <p className="tiny muted">
            Если врач скажет, что можно, таймер включается в профиле.
          </p>
        </Card>
      ) : null}

      {state.observationMode ? null : (
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="chip" aria-pressed={false} onClick={() => setSheet('plan')}>
          Схема {plan.title} ▾
        </button>
        <span className="pill">{plan.fastHours} ч без еды</span>
        {state.scheduleEnabled && state.premium && state.schedule[String(new Date(now).getDay())] ? (
          <span className="pill accent">по расписанию</span>
        ) : null}
      </div>
      )}

      {state.observationMode ? null : (
      <Card className="raised">
        <Ring progress={ratio} goalHours={plan.fastHours} running={session !== null}>
          {session ? (
            <>
              <span className="ring-time">{formatDuration(elapsed)}</span>
              <span className="ring-sub">
                {ratio >= 1 ? `цель пройдена на ${formatHoursShort(elapsed - plan.fastHours * HOUR_MS)}` : `осталось ${formatHoursShort(remainingMs(session, now))}`}
              </span>
            </>
          ) : (
            <>
              <span className="ring-time">{plan.fastHours}:00</span>
              <span className="ring-sub">готовы начать</span>
            </>
          )}
        </Ring>

        {session ? (
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <button
              type="button"
              className="col lockbtn"
              style={{ gap: 2, width: 'auto', alignItems: 'flex-start' }}
              onClick={() => (state.premium ? setSheet('start') : onRequestPro('Сдвигать время старта и финиша можно в PRO.'))}
            >
              <span className="eyebrow">Начало</span>
              <span className="row" style={{ gap: 7 }}>
                <span className="num" style={{ fontWeight: 600 }}>{formatClock(session.startedAt)}</span>
                {state.premium ? <span className="tiny muted">изменить</span> : <LockPill />}
              </span>
            </button>
            <div className="col" style={{ gap: 2, alignItems: 'flex-end' }}>
              <span className="eyebrow">Цель</span>
              <span className="num" style={{ fontWeight: 600 }}>{formatClock(session.targetEndAt)}</span>
            </div>
          </div>
        ) : null}

        {session ? (
          <button type="button" className="btn warm block" onClick={() => actions.endFast()}>
            Завершить голодание
          </button>
        ) : (
          <button type="button" className="btn block" onClick={() => actions.startFast()}>
            Начать голодание
          </button>
        )}
        <button type="button" className="btn quiet tiny" onClick={() => setSheet('safety')}>
          Стало плохо — что делать
        </button>
      </Card>
      )}

      <CoachCard now={now} onRequestPro={onRequestPro} />

      {state.observationMode ? null : (
      <Card>
        <div className="row between">
          <span className="eyebrow">Сейчас</span>
          {!state.premium ? <LockPill /> : null}
        </div>
        <PhaseRail activeId={session ? phase.id : 'digest'} />
        <div className="col" style={{ gap: 3 }}>
          <strong style={{ fontFamily: 'var(--display)', fontSize: 17 }}>
            {session ? phase.title : 'Голодание не запущено'}
          </strong>
          <p className="tiny muted">{session ? phase.short : 'Запустите таймер, чтобы отслеживать фазы.'}</p>
        </div>
        {session ? (
          state.premium ? (
            <>
              <p className="tiny">{phase.body}</p>
              {next ? (
                <p className="tiny muted">
                  Дальше: {next.title} — примерно через {formatHoursShort((next.fromHour - hours) * HOUR_MS)}.
                </p>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => onRequestPro('Подробный разбор фаз и прогноз следующей фазы доступны в PRO.')}
            >
              Что происходит в организме
            </button>
          )
        ) : null}
      </Card>
      )}

      <div className="grid2">
        <Card>
          <div className="row between">
            <span className="eyebrow">
              <DropIcon /> Вода
            </span>
          </div>
          <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }}>
            {today?.waterMl ?? 0}
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}> / {waterGoal} мл</span>
          </span>
          <div className="progressbar">
            <div style={{ width: `${Math.min(100, ((today?.waterMl ?? 0) / waterGoal) * 100)}%` }} />
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="chip" onClick={() => actions.addWater(250)}>+250</button>
            <button type="button" className="chip" onClick={() => actions.addWater(500)}>+500</button>
          </div>
          <span className="tiny muted" title={WATER_NOTE}>
            ориентир, не норма
          </span>
        </Card>

        <Card>
          <span className="eyebrow">
            <StepIcon /> Шаги
          </span>
          <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }}>
            {(today?.steps ?? 0).toLocaleString('ru-RU')}
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}> / {stepGoal.toLocaleString('ru-RU')}</span>
          </span>
          <div className="progressbar">
            <div style={{ width: `${Math.min(100, ((today?.steps ?? 0) / stepGoal) * 100)}%` }} />
          </div>
          <StepsControl state={counter.state} onEnable={counter.enable} onManual={() => setSheet('steps')} />
        </Card>
      </div>

      <Card>
        <div className="row between">
          <span className="eyebrow">
            <ScaleIcon /> Вес
          </span>
          <button type="button" className="btn ghost sm" onClick={() => setSheet('weight')}>
            Записать
          </button>
        </div>
        <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700 }}>
          {lastWeight ? formatWeight(lastWeight.kg, state.profile.units) : '—'}
        </span>
        {state.profile.goalKg && lastWeight ? (
          <p className="tiny muted">
            До цели {formatWeight(Math.max(0, lastWeight.kg - state.profile.goalKg), state.profile.units)}
          </p>
        ) : null}
      </Card>

      <WellbeingSheet />

      {sheet === 'safety' ? <SafetySheet onClose={() => setSheet(null)} /> : null}

      {sheet === 'plan' ? (
        <PlanSheet
          onLocked={(reason) => {
            setSheet(null);
            onRequestPro(reason);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'start' && session ? (
        <StartSheet
          startedAt={session.startedAt}
          onSave={(ts) => {
            actions.moveStart(ts);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'weight' ? (
        <WeightSheet
          initial={lastWeight?.kg ?? state.profile.startKg ?? 70}
          units={state.profile.units}
          onSave={(kg) => {
            actions.addWeight(kg);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'steps' ? (
        <StepsSheet
          counterState={counter.state}
          initial={today?.steps ?? 0}
          onSave={(count) => {
            actions.setSteps(count);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}

function StepsControl({
  state,
  onEnable,
  onManual,
}: {
  state: ReturnType<typeof useStepCounter>['state'];
  onEnable: () => void;
  onManual: () => void;
}): JSX.Element {
  if (state === 'native') {
    return (
      <div className="col" style={{ gap: 5 }}>
        <span className="pill accent">датчик телефона</span>
        <button type="button" className="chip" onClick={onManual}>
          Поправить
        </button>
      </div>
    );
  }
  if (state === 'native-denied') {
    return (
      <div className="col" style={{ gap: 5 }}>
        <button type="button" className="chip" onClick={onEnable}>
          Разрешить доступ
        </button>
        <span className="tiny muted">Нужно разрешение на распознавание активности.</span>
      </div>
    );
  }
  if (state === 'motion') {
    return (
      <div className="col" style={{ gap: 5 }}>
        <span className="pill">считаем, пока открыто</span>
        <button type="button" className="chip" onClick={onManual}>
          Поправить
        </button>
      </div>
    );
  }
  if (state === 'motion-off') {
    return (
      <div className="col" style={{ gap: 5 }}>
        <button type="button" className="chip" onClick={onEnable}>
          Считать автоматически
        </button>
        <button type="button" className="chip" onClick={onManual}>
          Ввести вручную
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="chip" onClick={onManual}>
      Записать
    </button>
  );
}

function PlanSheet({ onLocked, onClose }: { onLocked: (reason: string) => void; onClose: () => void }): JSX.Element {
  const state = useAppState();
  const { premium, planId, customFastHours } = state;
  const custom = resolvePlan('custom', customFastHours);

  return (
    <Sheet title="Схема голодания" onClose={onClose}>
      <p className="tiny muted">
        Поднимайтесь на ступень, когда текущая схема держится без усилий примерно неделю. Перескакивать через уровень —
        самый частый способ бросить на третий день.
      </p>

      {LEVEL_ORDER.map((level) => (
        <div className="col" key={level} style={{ gap: 9 }}>
          <div className="col" style={{ gap: 1 }}>
            <span className="eyebrow">{level}</span>
            <span className="tiny muted">{LEVEL_HINT[level]}</span>
          </div>
          {PLANS.filter((plan) => plan.level === level).map((plan) => {
            const locked = plan.premium && !premium;
            const isCustom = plan.id === 'custom';
            const selected = plan.id === planId;
            return (
              <button
                key={plan.id}
                type="button"
                className="option"
                aria-pressed={selected}
                onClick={() => (locked ? onLocked('Длинные окна и своё окно открываются в PRO.') : actions.setPlan(plan.id))}
              >
                <span className="mark" />
                <span className="col grow" style={{ gap: 3 }}>
                  <span className="row wrap" style={{ gap: 7 }}>
                    <strong>{plan.title}</strong>
                    {isCustom ? <span className="pill accent num">{custom.title}</span> : null}
                    {locked ? <LockPill /> : null}
                  </span>
                  <span className="tiny muted">{plan.blurb}</span>
                  {selected ? <span className="tiny">{plan.suits}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {planId === 'custom' && premium ? (
        <div className="col" style={{ gap: 10 }}>
          <div className="row between">
            <span className="eyebrow">Длина окна</span>
            <span className="num" style={{ fontWeight: 700 }}>
              {custom.fastHours} ч голодания / {custom.eatHours} ч еды
            </span>
          </div>
          <Ruler
            value={customFastHours}
            min={CUSTOM_MIN_HOURS}
            max={CUSTOM_MAX_HOURS}
            step={0.5}
            unit="ч"
            labelEvery={2}
            onChange={(next) => actions.setCustomHours(next)}
          />
        </div>
      ) : null}

      <hr className="divider" />

      <div className="col" style={{ gap: 10 }}>
        <div className="row between">
          <span className="eyebrow">Расписание по дням</span>
          {premium ? null : <LockPill />}
        </div>
        <p className="tiny muted">
          Разные окна в будни и выходные. Короткая схема в субботу лучше пропущенного дня — серия не рвётся.
        </p>
        {premium ? (
          <>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="chip"
                aria-pressed={state.scheduleEnabled}
                onClick={() => actions.setScheduleEnabled(!state.scheduleEnabled)}
              >
                {state.scheduleEnabled ? 'Включено' : 'Выключено'}
              </button>
            </div>
            {state.scheduleEnabled ? (
              <div className="col" style={{ gap: 7 }}>
                {WEEKDAYS.map((day) => {
                  const picked = state.schedule[day.key] ?? null;
                  return (
                    <div key={day.key} className="row" style={{ gap: 8 }}>
                      <span className="tiny" style={{ width: 28, fontWeight: 600 }}>
                        {day.short}
                      </span>
                      <select
                        id={`sched-${day.key}`}
                        aria-label={`Схема на ${day.short}`}
                        value={picked ?? ''}
                        onChange={(event) =>
                          actions.setScheduleDay(day.key, event.target.value === '' ? null : (event.target.value as PlanId))
                        }
                      >
                        <option value="">как обычно ({resolvePlan(planId, customFastHours).title})</option>
                        {PLANS.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.id === 'custom' ? custom.title : plan.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <button type="button" className="btn ghost sm" onClick={() => onLocked('Расписание по дням недели входит в PRO.')}>
            Посмотреть PRO
          </button>
        )}
      </div>
    </Sheet>
  );
}

function StartSheet({
  startedAt,
  onSave,
  onClose,
}: {
  startedAt: number;
  onSave: (ts: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [value, setValue] = useState(() => {
    const d = new Date(startedAt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  return (
    <Sheet title="Когда вы начали?" onClose={onClose}>
      <input id="start-time" type="time" value={value} onChange={(event) => setValue(event.target.value)} />
      <p className="tiny muted">Если время позже текущего, оно отнесётся ко вчерашнему дню.</p>
      <button
        type="button"
        className="btn block"
        onClick={() => {
          const [h, m] = value.split(':').map(Number);
          if (!Number.isFinite(h) || !Number.isFinite(m)) return;
          const next = new Date();
          next.setHours(h, m, 0, 0);
          const ts = next.getTime() > Date.now() ? next.getTime() - 86_400_000 : next.getTime();
          onSave(ts);
        }}
      >
        Сохранить
      </button>
    </Sheet>
  );
}

function WeightSheet({
  initial,
  units,
  onSave,
  onClose,
}: {
  initial: number;
  units: 'metric' | 'imperial';
  onSave: (kg: number) => void;
  onClose: () => void;
}): JSX.Element {
  const metric = units === 'metric';
  const [shown, setShown] = useState(() => Number((metric ? initial : initial * 2.2046226218).toFixed(1)));
  return (
    <Sheet title="Записать вес" onClose={onClose}>
      <Ruler
        value={shown}
        min={metric ? 35 : 77}
        max={metric ? 250 : 551}
        step={metric ? 0.1 : 0.2}
        unit={weightUnit(units)}
        labelEvery={metric ? 1 : 2}
        secondary={metric ? WEIGHT_SCALE : undefined}
        onChange={setShown}
      />
      <button type="button" className="btn block" onClick={() => onSave(displayToKg(shown, units))}>
        Сохранить
      </button>
    </Sheet>
  );
}

function StepsSheet({
  counterState,
  initial,
  onSave,
  onClose,
}: {
  counterState: ReturnType<typeof useStepCounter>['state'];
  initial: number;
  onSave: (count: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [value, setValue] = useState(String(initial));
  const diagnostics = readDiagnostics();
  const note =
    counterState === 'native'
      ? 'Считает аппаратный датчик телефона — он работает и когда приложение закрыто. Ручная правка перезапишет значение до следующего показания датчика.'
      : counterState === 'motion'
        ? 'Считаем по акселерометру, пока это окно открыто и экран не погашен. Это приблизительно: за день через браузер точного счёта не выйдет.'
        : 'Автоматический счёт недоступен в этом браузере, поэтому значение вводится вручную.';
  return (
    <Sheet title="Шаги за сегодня" onClose={onClose}>
      <p className="tiny muted">{note}</p>
      {diagnostics ? (
        <p className="banner tiny" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
          {diagnostics}
        </p>
      ) : null}
      <input id="steps-input" type="number" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} />
      <button
        type="button"
        className="btn block"
        onClick={() => {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed)) onSave(parsed);
        }}
      >
        Сохранить
      </button>
    </Sheet>
  );
}
