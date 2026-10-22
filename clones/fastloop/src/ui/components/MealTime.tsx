import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppState } from '../../state/store';

/**
 * When the food was actually eaten.
 *
 * Everything written down used to be stamped «now», which is right almost
 * always and wrong in the one case that matters: you finish dinner, start
 * the fast, and remember half an hour later that you never logged it. The
 * entry then lands inside the fast and the diary says you ate during the
 * window, which is both false and discouraging.
 *
 * So the time is adjustable, and off by default — a diary that asks what
 * time it is before every entry is a diary people stop using. The nudge
 * only appears while a fast is running, which is the only time the stamp
 * can be wrong in a way worth catching.
 */

interface MealTime {
  /** null means «now», resolved at the moment of saving. */
  readonly at: number | null;
  readonly setAt: (at: number | null) => void;
}

const Context = createContext<MealTime>({ at: null, setAt: () => {} });

export function MealTimeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, setAt }), [at]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The timestamp to write. Resolved late, so «now» means the save, not the open. */
export function useMealAt(): () => number {
  const { at } = useContext(Context);
  return () => at ?? Date.now();
}

const DAY = 86_400_000;

function clockOf(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Builds a timestamp from a day and a wall clock, in the phone's own zone. */
function stamp(dayStart: number, clock: string): number {
  const [hours, minutes] = clock.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return dayStart;
  const date = new Date(dayStart);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * The control itself. Rendered next to each save button rather than once at
 * the top, because the question «when was this» only becomes real when you
 * are about to write the entry down.
 */
export function WhenPicker(): JSX.Element {
  const { at, setAt } = useContext(Context);
  const state = useAppState();
  const now = Date.now();
  const running = state.current && state.current.endedAt === null ? state.current : null;
  const chosen = at ?? now;
  const [day, setDay] = useState(() => startOfDay(chosen));

  const on = at !== null;
  const insideFast = running !== null && chosen >= running.startedAt;
  const beforeFast = running === null ? null : running.startedAt - 60_000;

  return (
    <div className="when">
      <button
        type="button"
        className="when-toggle"
        aria-pressed={on}
        onClick={() => {
          if (on) setAt(null);
          else {
            // Opening the field with the current time means the common case —
            // «я ел недавно» — is a two-digit edit, not a date entry.
            setDay(startOfDay(now));
            setAt(now);
          }
        }}
      >
        <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
        <span className="col" style={{ gap: 1 }}>
          <strong>Другое время</strong>
          <span className="tiny muted">
            {on ? 'Запишется тем временем, которое выбрано ниже' : 'Сейчас запишется текущим временем'}
          </span>
        </span>
      </button>

      {on ? (
        <div className="col" style={{ gap: 8 }}>
          <div className="row wrap" style={{ gap: 7, alignItems: 'center' }}>
            <input
              id="meal-clock"
              type="time"
              value={clockOf(chosen)}
              onChange={(event) => setAt(stamp(day, event.target.value))}
              style={{ width: 128 }}
            />
            <button
              type="button"
              className="chip"
              aria-pressed={day === startOfDay(now)}
              onClick={() => {
                const next = startOfDay(now);
                setDay(next);
                setAt(stamp(next, clockOf(chosen)));
              }}
            >
              сегодня
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={day === startOfDay(now) - DAY}
              onClick={() => {
                const next = startOfDay(now) - DAY;
                setDay(next);
                setAt(stamp(next, clockOf(chosen)));
              }}
            >
              вчера
            </button>
          </div>

          {beforeFast !== null ? (
            <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
              setDay(startOfDay(beforeFast));
              setAt(beforeFast);
            }}>
              Это было до начала голодания · {clockOf(beforeFast)}
            </button>
          ) : null}
        </div>
      ) : null}

      {running !== null ? (
        <p className="tiny" style={{ color: insideFast ? 'var(--warn)' : 'var(--good)' }}>
          {insideFast
            ? 'Сейчас идёт голодание, и запись попадёт в окно. Если вы ели до его начала — поставьте время.'
            : 'Время до начала голодания: запись не попадёт в окно.'}
        </p>
      ) : null}
    </div>
  );
}
