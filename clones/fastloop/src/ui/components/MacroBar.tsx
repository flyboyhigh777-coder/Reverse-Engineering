export type MacroKind = 'carbs' | 'protein' | 'fat';

const COLOR: Record<MacroKind, string> = {
  carbs: 'var(--carb)',
  protein: 'var(--prot)',
  fat: 'var(--fat)',
};

const SOFT: Record<MacroKind, string> = {
  carbs: 'var(--carb-soft)',
  protein: 'var(--prot-soft)',
  fat: 'var(--fat-soft)',
};

const LABEL: Record<MacroKind, string> = {
  carbs: 'Углеводы',
  protein: 'Белок',
  fat: 'Жиры',
};

/** One macro against its target. Three hues, because they are three things. */
export function MacroBar({ kind, value, target }: { kind: MacroKind; value: number; target: number }): JSX.Element {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const over = target > 0 && value > target;
  return (
    <div className="macro-bar">
      <div className="head">
        <span style={{ color: COLOR[kind], fontWeight: 600 }}>{LABEL[kind]}</span>
        <span className="num muted">
          {Math.round(value)}/{Math.round(target)} г
        </span>
      </div>
      <div className="track" style={{ background: SOFT[kind] }}>
        <div
          className="fill"
          style={{ width: `${ratio * 100}%`, background: over ? 'var(--warn)' : COLOR[kind] }}
        />
      </div>
    </div>
  );
}

const SIZE = 190;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Calories eaten against the day's target. */
export function CalorieRing({ eaten, target }: { eaten: number; target: number }): JSX.Element {
  const ratio = target > 0 ? eaten / target : 0;
  const left = Math.round(target - eaten);
  const over = left < 0;
  return (
    <div className="kcal-ring">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`Съедено ${Math.round(eaten)} из ${target} ккал`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={over ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(1, Math.max(0, ratio)))}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="inner">
        <span className="cap">{over ? 'перебор' : 'осталось'}</span>
        <span className="big" style={over ? { color: 'var(--warn)' } : undefined}>
          {Math.abs(left)}
        </span>
        <span className="cap">ккал</span>
      </div>
    </div>
  );
}
