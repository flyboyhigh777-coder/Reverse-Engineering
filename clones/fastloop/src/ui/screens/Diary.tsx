import { useState } from 'react';
import { isoDate, startOfDay } from '../../domain/fasting';
import { FOOD_TABLE_NOTE } from '../../domain/foods';
import { weightSeries } from '../../domain/metrics';
import {
  MEAL_SLOTS,
  SLOT_LABEL,
  bySlot,
  calorieTarget,
  dailyTarget,
  duringFast,
  entriesOn,
  maintenance,
  totalFor,
} from '../../domain/nutrition';
import type { FoodEntry, MealSlot } from '../../domain/types';
import { actions, useAppState } from '../../state/store';
import { ArtTile } from '../components/FoodArt';
import type { ArtKind } from '../components/FoodArt';
import { CalorieRing, MacroBar } from '../components/MacroBar';
import { FoodPicker } from '../components/FoodPicker';
import { Card, ForkIcon, LeafIcon, Sheet, TargetIcon } from '../components/common';

const DAY_MS = 86_400_000;

const SLOT_ART: Record<MealSlot, ArtKind> = {
  breakfast: 'egg',
  lunch: 'bowl',
  dinner: 'meat',
  snack: 'nuts',
};

/** One hue per meal, so the day reads as four blocks rather than one list. */
const SLOT_TINT: Record<MealSlot, string> = {
  breakfast: 't-peach',
  lunch: 't-lime',
  dinner: 't-lilac',
  snack: 't-sky',
};

const SLOT_HINT: Record<MealSlot, string> = {
  breakfast: 'первый приём после окна',
  lunch: 'середина дня',
  dinner: 'за три часа до сна',
  snack: 'между приёмами',
};

function DayStrip({ date, onPick, now }: { date: string; onPick: (date: string) => void; now: number }): JSX.Element {
  const today = startOfDay(now);
  // The week ends today: nothing after it has been eaten yet.
  const days = Array.from({ length: 7 }, (_, index) => today - (6 - index) * DAY_MS);
  return (
    <div className="daystrip">
      {days.map((ts) => {
        const iso = isoDate(ts);
        return (
          <button key={iso} type="button" aria-pressed={iso === date} onClick={() => onPick(iso)}>
            <span className="dow">{new Date(ts).toLocaleDateString('ru-RU', { weekday: 'short' })}</span>
            <span className="num">{new Date(ts).getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Diary(): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const [date, setDate] = useState(() => isoDate(now));
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);

  const latestWeight = weightSeries(state.weights).at(-1)?.kg ?? null;
  const target = dailyTarget(state, latestWeight);
  const entries = entriesOn(state, date);
  const total = totalFor(entries);

  return (
    <>
      <div className="row between">
        <span className="eyebrow">
          {new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
        </span>
        {date !== isoDate(now) ? (
          <button type="button" className="chip" onClick={() => setDate(isoDate(now))}>
            сегодня
          </button>
        ) : null}
      </div>

      <DayStrip date={date} now={now} onPick={setDate} />

      {target === null ? (
        <Card>
          <span className="eyebrow">Норма не посчитана</span>
          <p className="tiny">
            Для расчёта нужны рост, возраст и вес. Заполните их в профиле — или задайте дневную норму сами.
          </p>
          <button type="button" className="btn ghost sm" onClick={() => setGoalSheet(true)}>
            Задать норму вручную
          </button>
        </Card>
      ) : (
        <Card className="raised">
          <div className="row between">
            <span className="eyebrow">Калории за день</span>
            <button type="button" className="chip" onClick={() => setGoalSheet(true)}>
              изменить цель
            </button>
          </div>

          <CalorieRing eaten={total.kcal} target={target.kcal} macros={total} />

          <div className="grid3">
            <div className="statcard t-lime">
              <span className="ico"><ForkIcon /></span>
              <span className="v num">{total.kcal}</span>
              <span className="k">съедено</span>
            </div>
            <div className="statcard t-sky">
              <span className="ico"><TargetIcon /></span>
              <span className="v num">{target.kcal}</span>
              <span className="k">цель</span>
            </div>
            <div className={`statcard ${total.kcal > target.kcal ? 't-rose' : 't-peach'}`}>
              <span className="ico"><LeafIcon /></span>
              <span className="v num">{Math.abs(target.kcal - total.kcal)}</span>
              <span className="k">{total.kcal > target.kcal ? 'перебор' : 'осталось'}</span>
            </div>
          </div>

          <div className="col" style={{ gap: 9 }}>
            <MacroBar kind="protein" value={total.protein} target={total.protein > 0 || target.protein > 0 ? target.protein : 0} />
            <MacroBar kind="fat" value={total.fat} target={target.fat} />
            <MacroBar kind="carbs" value={total.carbs} target={target.carbs} />
          </div>

          {total.fiber > 0 ? <p className="tiny muted">Клетчатка за день: {total.fiber} г.</p> : null}
        </Card>
      )}

      <div className="col" style={{ gap: 10 }}>
        {MEAL_SLOTS.map((slot) => {
          const items = bySlot(entries, slot);
          const slotTotal = totalFor(items);
          return (
            <div key={slot} className={`meal tint ${SLOT_TINT[slot]}`}>
              <div className="top">
                <span className="thumb">
                  <ArtTile kind={SLOT_ART[slot]} height={42} rounded={11} label="" />
                </span>
                <span className="col grow" style={{ gap: 1 }}>
                  <strong style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{SLOT_LABEL[slot]}</strong>
                  <span className="tiny muted">
                    {items.length === 0 ? SLOT_HINT[slot] : `${slotTotal.kcal} ккал · ${items.length} зап.`}
                  </span>
                </span>
                <button type="button" className="add" aria-label={`Добавить в «${SLOT_LABEL[slot]}»`} onClick={() => setAdding(slot)}>
                  +
                </button>
              </div>

              {items.length > 0 ? (
                <ul>
                  {items.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" onClick={() => setEditing(entry)}>
                        <span className="col" style={{ gap: 1 }}>
                          <span className="row wrap" style={{ gap: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{entry.name}</span>
                            {entry.source === 'photo' ? <span className="pill">по фото</span> : null}
                            {duringFast(state, entry.at) ? (
                              <span className="pill" style={{ color: 'var(--warn)' }}>в окне голодания</span>
                            ) : null}
                          </span>
                          <span className="tiny num muted">
                            {entry.grams > 0 ? `${entry.grams} г · ` : ''}Б {entry.macros.protein} · Ж {entry.macros.fat} · У {entry.macros.carbs}
                          </span>
                        </span>
                        <span className="num" style={{ fontWeight: 700 }}>{entry.macros.kcal}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="tiny muted">{FOOD_TABLE_NOTE}</p>

      {adding ? <FoodPicker slot={adding} onClose={() => setAdding(null)} /> : null}

      {editing ? (
        <Sheet title={editing.name} onClose={() => setEditing(null)}>
          <div className="macro-row">
            <div className="macro"><b>{editing.macros.kcal}</b><span>ккал</span></div>
            <div className="macro" style={{ color: 'var(--prot)' }}><b>{editing.macros.protein}</b><span>белок, г</span></div>
            <div className="macro" style={{ color: 'var(--fat)' }}><b>{editing.macros.fat}</b><span>жиры, г</span></div>
            <div className="macro" style={{ color: 'var(--carb)' }}><b>{editing.macros.carbs}</b><span>углев., г</span></div>
          </div>
          <span className="eyebrow">Перенести</span>
          <div className="row wrap" style={{ gap: 7 }}>
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                className="chip"
                aria-pressed={editing.slot === slot}
                onClick={() => {
                  actions.moveFood(editing.id, slot);
                  setEditing(null);
                }}
              >
                {SLOT_LABEL[slot]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn block"
            style={{ background: 'var(--danger)', color: '#fff' }}
            onClick={() => {
              actions.removeFood(editing.id);
              setEditing(null);
            }}
          >
            Удалить запись
          </button>
        </Sheet>
      ) : null}

      {goalSheet ? <GoalSheet onClose={() => setGoalSheet(false)} /> : null}
    </>
  );
}

function GoalSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const state = useAppState();
  const kg = weightSeries(state.weights).at(-1)?.kg ?? null;
  const computed = calorieTarget(state.profile, kg);
  const upkeep = maintenance(state.profile, kg);
  const [value, setValue] = useState(() => String(state.calorieGoal ?? computed?.kcal ?? 2000));

  return (
    <Sheet title="Дневная норма калорий" onClose={onClose}>
      {computed ? (
        <div className="col" style={{ gap: 7 }}>
          <div className="row between">
            <span className="tiny muted">Поддержание веса</span>
            <span className="tiny num" style={{ fontWeight: 600 }}>{upkeep} ккал</span>
          </div>
          <div className="row between">
            <span className="tiny muted">Расчёт приложения</span>
            <span className="tiny num" style={{ fontWeight: 600 }}>{computed.kcal} ккал</span>
          </div>
          {computed.deficit > 0 ? (
            <p className="tiny muted">
              Дефицит {computed.deficit} ккал в день — это примерно {(computed.deficit * 7 / 7700).toFixed(1)} кг в неделю.
              {computed.capped
                ? ' Дефицит уменьшен: ниже этой цифры норма опустилась бы под ваш собственный обмен покоя, а это путь к потере мышц и к остановке веса.'
                : ''}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="tiny muted">
          Рост, возраст и вес в профиле не заполнены, поэтому формула молчит. Норму можно поставить своей рукой.
        </p>
      )}

      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Своя норма</span>
        <input
          id="goal-kcal"
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn grow"
          onClick={() => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) actions.setCalorieGoal(parsed);
            onClose();
          }}
        >
          Сохранить
        </button>
        {state.calorieGoal !== null ? (
          <button
            type="button"
            className="btn ghost grow"
            onClick={() => {
              actions.setCalorieGoal(null);
              onClose();
            }}
          >
            Вернуть расчёт
          </button>
        ) : null}
      </div>

      <p className="tiny muted">
        Формула Миффлина–Сан Жеора даёт оценку для среднего человека ваших размеров: индивидуальный обмен отличается
        примерно на ±10%. Правильнее проверять её по линии веса за две-три недели и двигать на 100–200 ккал, чем верить
        цифре на слово.
      </p>
    </Sheet>
  );
}
