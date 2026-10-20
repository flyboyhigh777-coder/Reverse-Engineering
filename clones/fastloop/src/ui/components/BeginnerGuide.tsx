import { useState } from 'react';
import { BEGINNER_RULES, BEGINNER_WEEK, beginnerDay } from '../../domain/beginner';
import { useAppState } from '../../state/store';
import { ArtTile } from './FoodArt';
import { Card, Sheet } from './common';

/** The first week, as a card that knows which day the person is on. */
export function BeginnerCard(): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const day = beginnerDay(state, Date.now());
  const current = BEGINNER_WEEK[day - 1];

  return (
    <>
      <Card>
        <div className="row between">
          <span className="eyebrow">Руководство для начинающих</span>
          <span className="pill accent num">день {day} из {BEGINNER_WEEK.length}</span>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 58, flex: 'none', borderRadius: 10, overflow: 'hidden' }}>
            <ArtTile kind="sunrise" label="" />
          </span>
          <span className="col grow" style={{ gap: 3 }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{current.title}</strong>
            <span className="tiny muted">{current.task}</span>
          </span>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
          Открыть всю неделю
        </button>
      </Card>

      {open ? <BeginnerSheet day={day} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function BeginnerSheet({ day, onClose }: { day: number; onClose: () => void }): JSX.Element {
  return (
    <Sheet title="Первая неделя" onClose={onClose}>
      <p className="tiny muted">
        Лестница специально пологая. Самая частая причина бросить — не слабая воля, а старт на три ступени выше, чем
        выдерживает привычка.
      </p>

      <div className="col" style={{ gap: 10 }}>
        {BEGINNER_WEEK.map((item) => (
          <div key={item.day} className={item.day === day ? 'badge on' : 'badge'} style={{ flexDirection: 'column', gap: 6 }}>
            <span className="row between" style={{ width: '100%' }}>
              <strong style={{ fontSize: 14 }}>
                День {item.day}. {item.title}
              </strong>
              {item.day === day ? <span className="pill accent">сегодня</span> : null}
            </span>
            <span className="tiny">{item.task}</span>
            <span className="tiny muted">Что обычно происходит: {item.expect}</span>
            <span className="tiny" style={{ color: 'var(--warn)' }}>
              Частая ошибка: {item.mistake}
            </span>
          </div>
        ))}
      </div>

      <hr className="divider" />

      <span className="eyebrow">Правила, которые держатся весь первый месяц</span>
      <ul className="col" style={{ gap: 7, listStyle: 'none', padding: 0, margin: 0 }}>
        {BEGINNER_RULES.map((rule) => (
          <li key={rule} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ color: 'var(--accent)' }}>•</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
