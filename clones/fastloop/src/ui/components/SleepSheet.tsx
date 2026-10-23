import { useState } from 'react';
import { isoDate } from '../../domain/fasting';
import { SLEEP_TARGET_MIN, formatDuration } from '../../domain/sleep';
import type { SleepEntry } from '../../domain/types';
import { actions, useAppState } from '../../state/store';
import { Sheet } from './common';

const DAY = 86_400_000;

function clockOf(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function atClock(dayStart: number, clock: string): number {
  const [h, m] = clock.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return dayStart;
  return dayStart + h * 3_600_000 + m * 60_000;
}

function num(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Last night, in two numbers.
 *
 * Bedtime and waking are all that is asked for, because that is all anyone
 * knows at breakfast without looking anything up. The stage minutes are
 * behind a fold for people whose watch measured them — Mi Fitness and the
 * like report deep, light and REM — and the app never pretends to have them
 * when nobody did.
 */
export function SleepSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const [morning, setMorning] = useState(() => startOfDay(now));
  const date = isoDate(morning);
  const saved = state.sleep.find((night) => night.date === date) ?? null;

  const [bed, setBed] = useState(() => (saved ? clockOf(saved.asleepAt) : '23:00'));
  const [up, setUp] = useState(() => (saved ? clockOf(saved.wokeAt) : '07:00'));
  const [stages, setStages] = useState(() => saved !== null && saved.deep !== null);
  const [deep, setDeep] = useState(() => (saved?.deep ?? '').toString());
  const [light, setLight] = useState(() => (saved?.light ?? '').toString());
  const [rem, setRem] = useState(() => (saved?.rem ?? '').toString());
  const [awake, setAwake] = useState(() => (saved?.awake ?? '').toString());
  const [rested, setRested] = useState<number | null>(() => saved?.rested ?? null);

  // Waking is on the chosen morning; bedtime is the night before unless the
  // person went to bed after midnight, which the clock order gives away.
  const wokeAt = atClock(morning, up);
  const bedToday = atClock(morning, bed);
  const asleepAt = bedToday <= wokeAt ? bedToday : bedToday - DAY;
  const minutes = Math.round((wokeAt - asleepAt) / 60_000);
  const sane = minutes >= 60 && minutes <= 900;

  const save = (): void => {
    const entry: SleepEntry = {
      date,
      asleepAt,
      wokeAt,
      deep: stages ? num(deep) : null,
      light: stages ? num(light) : null,
      rem: stages ? num(rem) : null,
      awake: stages ? num(awake) : null,
      rested,
      source: stages ? 'watch' : 'manual',
    };
    actions.logSleep(entry);
    onClose();
  };

  return (
    <Sheet title="Как спали?" onClose={onClose}>
      <div className="row wrap" style={{ gap: 7 }}>
        <button type="button" className="chip" aria-pressed={morning === startOfDay(now)} onClick={() => setMorning(startOfDay(now))}>
          сегодня утром
        </button>
        <button type="button" className="chip" aria-pressed={morning === startOfDay(now) - DAY} onClick={() => setMorning(startOfDay(now) - DAY)}>
          вчера утром
        </button>
      </div>

      <div className="grid2">
        <label className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Лёг</span>
          <input id="sleep-bed" type="time" value={bed} onChange={(event) => setBed(event.target.value)} />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Встал</span>
          <input id="sleep-up" type="time" value={up} onChange={(event) => setUp(event.target.value)} />
        </label>
      </div>

      <div className="row between">
        <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700 }}>
          {sane ? formatDuration(minutes) : '—'}
        </span>
        <span className="tiny muted">
          {sane
            ? minutes >= SLEEP_TARGET_MIN
              ? 'семь часов и больше'
              : `до семи часов не хватает ${formatDuration(SLEEP_TARGET_MIN - minutes)}`
            : 'проверьте время'}
        </span>
      </div>

      <div className="col" style={{ gap: 7 }}>
        <span className="eyebrow">Как выспались</span>
        <div className="row wrap" style={{ gap: 7 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="chip num"
              aria-pressed={rested === value}
              onClick={() => setRested(rested === value ? null : value)}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="tiny muted">
          1 — разбит, 5 — выспался. Единственное, чего не измерит ни одна чаcовая манжета.
        </span>
      </div>

      <button type="button" className="when-toggle" aria-pressed={stages} onClick={() => setStages(!stages)}>
        <span className="tick" aria-hidden="true">{stages ? '✓' : ''}</span>
        <span className="col" style={{ gap: 1 }}>
          <strong>Фазы с часов</strong>
          <span className="tiny muted">Минуты из приложения часов: глубокий, лёгкий, быстрый, пробуждения</span>
        </span>
      </button>

      {stages ? (
        <div className="grid2">
          <label className="col" style={{ gap: 4 }}>
            <span className="eyebrow">Глубокий, мин</span>
            <input id="sleep-deep" type="number" inputMode="numeric" value={deep} onChange={(e) => setDeep(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4 }}>
            <span className="eyebrow">Лёгкий, мин</span>
            <input id="sleep-light" type="number" inputMode="numeric" value={light} onChange={(e) => setLight(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4 }}>
            <span className="eyebrow">Быстрый, мин</span>
            <input id="sleep-rem" type="number" inputMode="numeric" value={rem} onChange={(e) => setRem(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4 }}>
            <span className="eyebrow">Просыпался, мин</span>
            <input id="sleep-awake" type="number" inputMode="numeric" value={awake} onChange={(e) => setAwake(e.target.value)} />
          </label>
        </div>
      ) : null}

      <button type="button" className="btn block" disabled={!sane} onClick={save}>
        Записать ночь
      </button>

      {saved ? (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            actions.removeSleep(date);
            onClose();
          }}
        >
          Удалить запись
        </button>
      ) : null}
    </Sheet>
  );
}
