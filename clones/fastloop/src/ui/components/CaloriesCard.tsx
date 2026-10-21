import { useState } from 'react';
import { isoDate } from '../../domain/fasting';
import { weightSeries } from '../../domain/metrics';
import { SLOT_LABEL, dailyTarget, entriesOn, slotForHour, totalFor } from '../../domain/nutrition';
import { useAppState } from '../../state/store';
import { FoodPicker } from './FoodPicker';
import { MacroBar } from './MacroBar';
import { Card } from './common';

/** The day's calories on the home screen, with one tap to add a meal. */
export function CaloriesCard(): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const [adding, setAdding] = useState(false);

  const kg = weightSeries(state.weights).at(-1)?.kg ?? null;
  const target = dailyTarget(state, kg);
  const total = totalFor(entriesOn(state, isoDate(now)));
  const slot = slotForHour(new Date(now).getHours());
  const left = target ? target.kcal - total.kcal : 0;

  return (
    <>
      <Card>
        <div className="row between">
          <span className="eyebrow">Калории сегодня</span>
          {target ? (
            <span className={left < 0 ? 'pill' : 'pill accent'} style={left < 0 ? { color: 'var(--warn)' } : undefined}>
              {left < 0 ? `перебор ${-left}` : `осталось ${left}`}
            </span>
          ) : null}
        </div>

        <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700 }}>
          {total.kcal}
          {target ? <span style={{ fontSize: 13, color: 'var(--ink-3)' }}> / {target.kcal} ккал</span> : null}
        </span>

        {target ? (
          <>
            <div className="progressbar">
              <div
                style={{
                  width: `${Math.min(100, (total.kcal / target.kcal) * 100)}%`,
                  background: left < 0 ? 'var(--warn)' : 'var(--accent)',
                }}
              />
            </div>
            <div className="col" style={{ gap: 7 }}>
              <MacroBar kind="protein" value={total.protein} target={target.protein} />
              <MacroBar kind="fat" value={total.fat} target={target.fat} />
              <MacroBar kind="carbs" value={total.carbs} target={target.carbs} />
            </div>
          </>
        ) : (
          <p className="tiny muted">
            Норма не посчитана: не хватает роста, возраста или веса в профиле. Записывать еду это не мешает.
          </p>
        )}

        <button type="button" className="btn block" onClick={() => setAdding(true)}>
          Записать еду · {SLOT_LABEL[slot].toLowerCase()}
        </button>
      </Card>

      {adding ? <FoodPicker slot={slot} onClose={() => setAdding(false)} /> : null}
    </>
  );
}
