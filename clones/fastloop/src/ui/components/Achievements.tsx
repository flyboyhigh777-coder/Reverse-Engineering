import { useMemo, useState } from 'react';
import {
  ACHIEVEMENT_GROUPS,
  achievements,
  isUnlocked,
  nextUp,
  unlockedCount,
} from '../../domain/achievements';
import type { Achievement, AchievementGroup } from '../../domain/achievements';
import { useAppState } from '../../state/store';
import { Card, Sheet } from './common';

/** The group's emblem. Five shapes, so a badge is recognisable without text. */
function Medal({ group, unlocked }: { group: AchievementGroup; unlocked: boolean }): JSX.Element {
  const stroke = unlocked ? 'var(--accent-ink)' : 'var(--ink-3)';
  return (
    <span className={unlocked ? 'medal on' : 'medal'} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {group === 'Серии' ? <path d="M12 3c2.5 3.2 4.5 5.3 4.5 8a4.5 4.5 0 0 1-9 0c0-1.3.5-2.4 1.3-3.6.6 1 1.3 1.6 2 1.8C10.2 7.2 10.8 5 12 3zM7 19h10" /> : null}
        {group === 'Голодания' ? <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></> : null}
        {group === 'Длительность' ? (
          <path d="M7 3h10M7 21h10M9.2 3v3.3c0 1.7 2.8 3 2.8 5.7s-2.8 4-2.8 5.7V21M14.8 3v3.3c0 1.7-2.8 3-2.8 5.7s2.8 4 2.8 5.7V21" />
        ) : null}
        {group === 'Вес' ? <><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M12 9v2.4M9.3 10l1.2 1.6M14.7 10l-1.2 1.6" /></> : null}
        {group === 'Привычки' ? <path d="M5 13l4.5 4.5L19 7" /> : null}
      </svg>
    </span>
  );
}

function Badge({ item }: { item: Achievement }): JSX.Element {
  const unlocked = isUnlocked(item);
  const ratio = Math.min(1, item.current / item.target);
  return (
    <div className={unlocked ? 'badge on' : 'badge'}>
      <Medal group={item.group} unlocked={unlocked} />
      <span className="col grow" style={{ gap: 3 }}>
        <span className="row between" style={{ gap: 8 }}>
          <strong style={{ fontSize: 13.5 }}>{item.title}</strong>
          <span className="tiny num muted">
            {unlocked ? 'есть' : `${item.current}/${item.target}${item.unit ? ` ${item.unit}` : ''}`}
          </span>
        </span>
        <span className="tiny muted">{item.detail}</span>
        {unlocked ? null : (
          <span className="progressbar">
            <span style={{ display: 'block', height: '100%', width: `${ratio * 100}%`, background: 'var(--accent)', borderRadius: 999 }} />
          </span>
        )}
      </span>
    </div>
  );
}

export function AchievementsCard(): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const now = Date.now();
  const list = useMemo(() => achievements(state, now), [state, now]);
  const have = unlockedCount(list);
  const close = nextUp(list, 3);

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">Достижения</span>
        <span className="pill accent num">
          {have}/{list.length}
        </span>
      </div>

      <div className="progressbar">
        <div style={{ width: `${(have / list.length) * 100}%` }} />
      </div>

      {close.length > 0 ? (
        <div className="col" style={{ gap: 8 }}>
          <span className="tiny muted">Ближе всего:</span>
          {close.map((item) => (
            <Badge key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="tiny muted">
          {have === 0
            ? 'Значки считаются по вашим записям: завершённые голодания, серии, вес, вода и шаги. Ни один не открывается просто за открытие приложения.'
            : 'Все ближайшие цели взяты. Откройте список, чтобы выбрать следующую.'}
        </p>
      )}

      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        Все достижения
      </button>

      {open ? <AchievementsSheet onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

export function AchievementsSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const list = useMemo(() => achievements(state, now), [state, now]);
  const [group, setGroup] = useState<AchievementGroup | 'all'>('all');
  const have = unlockedCount(list);
  const shown = group === 'all' ? list : list.filter((item) => item.group === group);

  return (
    <Sheet title={`Достижения · ${have} из ${list.length}`} onClose={onClose}>
      <div className="carousel chiprow">
        <button type="button" className="chip" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>
          Все
        </button>
        {ACHIEVEMENT_GROUPS.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={group === name} onClick={() => setGroup(name)}>
            {name}
          </button>
        ))}
      </div>

      <div className="col" style={{ gap: 9 }}>
        {shown.map((item) => (
          <Badge key={item.id} item={item} />
        ))}
      </div>

      <p className="tiny muted">
        Значки не влияют ни на схему, ни на советы — это только отметки пройденного. Они пересчитываются из истории,
        поэтому исправленная или удалённая запись меняет и их.
      </p>
    </Sheet>
  );
}
