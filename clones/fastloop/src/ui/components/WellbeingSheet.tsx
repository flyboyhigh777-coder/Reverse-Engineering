import { useState } from 'react';
import { formatHoursShort } from '../../domain/fasting';
import { WELLBEING_SCALES } from '../../domain/wellbeing';
import type { Wellbeing } from '../../domain/wellbeing';
import { actions, useAppState } from '../../state/store';
import { Sheet } from './common';

/** Asked once, right after a fast ends — it is the coach's only input. */
export function WellbeingSheet(): JSX.Element | null {
  const state = useAppState();
  const id = state.pendingRatingId;
  const session = state.history.find((s) => s.id === id);
  const [values, setValues] = useState<Wellbeing>({ energy: 3, hunger: 3, sleep: 3 });

  if (!id || !session || session.endedAt === null) return null;
  const duration = session.endedAt - session.startedAt;

  return (
    <Sheet title="Как прошло?" onClose={() => actions.dismissRating()}>
      <p className="tiny muted">
        Голодание на {formatHoursShort(duration)} завершено. Три отметки — и тренер сможет сравнить окна между собой.
      </p>

      {WELLBEING_SCALES.map((scale) => (
        <div className="col" key={scale.key} style={{ gap: 8 }}>
          <span className="eyebrow">{scale.question}</span>
          <div className="row" style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="chip"
                style={{ flex: 1, justifyContent: 'center' }}
                aria-pressed={values[scale.key] === n}
                onClick={() => setValues({ ...values, [scale.key]: n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="row between tiny muted">
            <span>{scale.low}</span>
            <span>{scale.high}</span>
          </div>
        </div>
      ))}

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn ghost grow" onClick={() => actions.dismissRating()}>
          Пропустить
        </button>
        <button type="button" className="btn grow" onClick={() => actions.rateFast(id, values)}>
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}
