import { useState } from 'react';
import { elapsedMs, formatDayClock, formatHoursShort, reachedGoal } from '../../domain/fasting';
import { isRated } from '../../domain/wellbeing';
import type { FastSession } from '../../domain/types';
import { bmi, bmiBand, fastStats, formatWeight, weightSeries } from '../../domain/metrics';
import {
  RANGES,
  chartGoals,
  fastHoursSeries,
  rangeDays,
  stepsSeries,
  summarize,
  waterSeries,
  weightPoints,
} from '../../domain/series';
import type { Range } from '../../domain/series';
import { actions, useAppState } from '../../state/store';
import { useNow } from '../useNow';
import { AchievementsCard } from '../components/Achievements';
import { BarChart } from '../components/BarChart';
import { BmiBar } from '../components/BmiBar';
import { WeightChart } from '../components/WeightChart';
import { Card, LockPill, Sheet, Stat } from '../components/common';

const FREE_HISTORY = 3;

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): number | null {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function Progress({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [editing, setEditing] = useState<FastSession | 'new' | null>(null);
  const [range, setRange] = useState<Range>('week');
  const now = useNow(false);
  const stats = fastStats(state.history, now);
  const series = weightSeries(state.weights);
  const latest = series.at(-1);
  const days = rangeDays(range);
  const goals = chartGoals(state);
  const fastHours = fastHoursSeries(state, now, days);
  const water = waterSeries(state, now, days);
  const steps = stepsSeries(state, now, days);
  const points = weightPoints(state, now, days);
  const fastSummary = summarize(fastHours, null);
  const waterSummary = summarize(water, goals.water);
  const stepSummary = summarize(steps, goals.steps);
  const bmiValue = latest && state.profile.heightCm ? bmi(latest.kg, state.profile.heightCm) : null;
  const isDemo = state.history.some((s) => s.id.startsWith('demo-'));
  const done = [...state.history].filter((s) => s.endedAt !== null).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  const visible = state.premium ? done : done.slice(0, FREE_HISTORY);
  const hidden = done.length - visible.length;

  return (
    <>
      <h1 style={{ fontSize: 21 }}>Прогресс</h1>

      {isDemo ? (
        <p className="banner">
          Показаны демо-данные за прошлую неделю, чтобы экран не был пустым. Очистить их можно в профиле.
        </p>
      ) : null}

      <div className="carousel chiprow">
        {RANGES.map((item) => (
          <button key={item.id} type="button" className="chip" aria-pressed={range === item.id} onClick={() => setRange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="row between">
          <span className="eyebrow">Длительность голоданий</span>
          {fastSummary.average !== null ? (
            <span className="pill num">в среднем {fastSummary.average.toFixed(1)} ч</span>
          ) : null}
        </div>
        <BarChart
          points={fastHours}
          goal={null}
          tone="accent"
          format={(value) => `${value.toFixed(0)} ч`}
          label={`Длительность голоданий за ${days} дн.`}
        />
        <p className="tiny muted">
          {fastSummary.logged > 0
            ? `Записей за период: ${fastSummary.logged} из ${fastSummary.total} дней. Дольше всего — ${(fastSummary.best ?? 0).toFixed(1)} ч. Столбец стоит на дне, когда окно закрылось.`
            : 'Пустые дни — это дни без записи, а не нулевые голодания.'}
        </p>
      </Card>

      <div className="grid2">
        <Card>
          <span className="eyebrow">Вода</span>
          <BarChart
            points={water}
            goal={goals.water}
            tone="accent"
            format={(value) => `${Math.round(value / 100) / 10} л`}
            label={`Вода за ${days} дн.`}
          />
          <p className="tiny muted">
            Норма набрана в {waterSummary.hit} из {waterSummary.total} дней.
          </p>
        </Card>

        <Card>
          <span className="eyebrow">Шаги</span>
          <BarChart
            points={steps}
            goal={goals.steps}
            tone="warm"
            format={(value) => `${Math.round(value / 1000)}к`}
            label={`Шаги за ${days} дн.`}
          />
          <p className="tiny muted">
            Цель взята в {stepSummary.hit} из {stepSummary.total} дней.
          </p>
        </Card>
      </div>

      <Card>
        <div className="row between">
          <span className="eyebrow">Вес</span>
          {bmiValue ? (
            <span className="pill">
              ИМТ {bmiValue.toFixed(1)} · {bmiBand(bmiValue).label}
            </span>
          ) : null}
        </div>
        {points.length >= 2 ? (
          <WeightChart points={points} goalKg={state.profile.goalKg} units={state.profile.units} />
        ) : (
          <p className="tiny muted">
            За этот период меньше двух записей. Расширьте период или запишите вес на главном экране.
          </p>
        )}
        {latest && state.profile.startKg ? (
          <div className="grid3">
            <Stat value={formatWeight(state.profile.startKg, state.profile.units)} label="старт" />
            <Stat value={formatWeight(latest.kg, state.profile.units)} label="сейчас" />
            <Stat
              value={state.profile.goalKg ? formatWeight(state.profile.goalKg, state.profile.units) : '—'}
              label="цель"
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <span className="eyebrow">Голодания</span>
        <div className="grid2">
          <Stat value={stats.completed} label="всего завершено" />
          <Stat value={`${stats.streak} дн.`} label="серия подряд" />
          <Stat value={formatHoursShort(stats.averageMs)} label="средняя длительность" />
          {state.premium ? (
            <Stat value={formatHoursShort(stats.longestMs)} label="самое длинное" />
          ) : (
            <button
              type="button"
              className="lockbtn stat"
              onClick={() => onRequestPro('Рекорды и доля достигнутых целей — в PRO.')}
            >
              <span className="value" style={{ color: 'var(--ink-3)' }}>•••</span>
              <span className="label row" style={{ gap: 5 }}>
                рекорд <LockPill />
              </span>
            </button>
          )}
        </div>
        {state.premium ? (
          <p className="tiny muted">
            Цель достигнута в {Math.round(stats.goalRate * 100)}% завершённых голоданий.
          </p>
        ) : null}
      </Card>

      {bmiValue ? (
        <Card>
          <span className="eyebrow">Индекс массы тела</span>
          <BmiBar value={bmiValue} />
        </Card>
      ) : null}

      <AchievementsCard />

      <Card>
        <div className="row between">
          <span className="eyebrow">История</span>
          <div className="row" style={{ gap: 8 }}>
            {!state.premium && hidden > 0 ? <LockPill /> : null}
            <button type="button" className="chip" onClick={() => setEditing('new')}>
              + забытое
            </button>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="tiny muted">Пока ни одного завершённого голодания. Забыли нажать старт — добавьте запись вручную.</p>
        ) : (
          <ul className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
            {visible.map((session) => {
              const duration = elapsedMs(session, now);
              const hit = reachedGoal(session);
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    className="lockbtn row between"
                    style={{ gap: 10, width: '100%' }}
                    onClick={() => setEditing(session)}
                  >
                    <span className="col grow" style={{ gap: 1 }}>
                      <span className="row wrap" style={{ gap: 7 }}>
                        <span style={{ fontWeight: 600 }} className="num">
                          {formatHoursShort(duration)}
                        </span>
                        {session.edited ? <span className="pill">правлено</span> : null}
                        {isRated(session) ? <span className="pill accent">энергия {session.wellbeing.energy}/5</span> : null}
                      </span>
                      <span className="tiny muted">
                        {session.planId} · начало {formatDayClock(session.startedAt, now)}
                      </span>
                    </span>
                    <span className="pill" style={{ color: hit ? 'var(--good)' : 'var(--ink-3)' }}>
                      {hit ? 'цель взята' : 'короче цели'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!state.premium && hidden > 0 ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onRequestPro(`Ещё ${hidden} записей истории доступны в PRO.`)}
          >
            Показать ещё {hidden}
          </button>
        ) : null}
      </Card>

      {editing ? (
        <FastEditor
          session={editing === 'new' ? null : editing}
          planId={state.planId}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

/** Add a fast nobody remembered to start, or correct one that is wrong. */
function FastEditor({
  session,
  planId,
  onClose,
}: {
  session: FastSession | null;
  planId: FastSession['planId'];
  onClose: () => void;
}): JSX.Element {
  const now = Date.now();
  const [start, setStart] = useState(() => toLocalInput(session?.startedAt ?? now - 16 * 3_600_000));
  const [end, setEnd] = useState(() => toLocalInput(session?.endedAt ?? now));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startedAt = fromLocalInput(start);
  const endedAt = fromLocalInput(end);
  const valid = startedAt !== null && endedAt !== null && endedAt > startedAt;
  const hours = valid ? ((endedAt - startedAt) / 3_600_000).toFixed(1) : null;

  return (
    <Sheet title={session ? 'Изменить запись' : 'Добавить голодание'} onClose={onClose}>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Начало</span>
        <input id="fast-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Конец</span>
        <input id="fast-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <p className="tiny muted">
        {valid ? `Длительность: ${hours} ч.` : 'Конец должен быть позже начала.'}
      </p>

      <button
        type="button"
        className="btn block"
        disabled={!valid}
        onClick={() => {
          if (!valid) return;
          if (session) actions.updateFast(session.id, startedAt, endedAt);
          else actions.addPastFast(startedAt, endedAt, planId);
          onClose();
        }}
      >
        Сохранить
      </button>

      {session ? (
        confirmDelete ? (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost grow" onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn grow"
              style={{ background: 'var(--danger)', color: '#fff' }}
              onClick={() => {
                actions.deleteFast(session.id);
                onClose();
              }}
            >
              Удалить запись
            </button>
          </div>
        ) : (
          <button type="button" className="btn quiet tiny" onClick={() => setConfirmDelete(true)}>
            Удалить запись
          </button>
        )
      ) : null}
    </Sheet>
  );
}
