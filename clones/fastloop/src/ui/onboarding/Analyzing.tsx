import { useEffect, useState } from 'react';
import { ANALYSIS_STEPS } from '../../domain/quiz';
import { actions } from '../../state/store';

const STEP_MS = 620;

export function Analyzing(): JSX.Element {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= ANALYSIS_STEPS.length) {
      const id = window.setTimeout(() => actions.setStage('plan'), 420);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setDone(done + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [done]);

  const percent = Math.round((done / ANALYSIS_STEPS.length) * 100);

  return (
    <div className="shell">
      <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="col" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 52, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {percent}%
          </span>
          <span className="tiny muted">Собираем ваш план</span>
        </div>
        <div className="progressbar">
          <div style={{ width: `${percent}%` }} />
        </div>
        <ul className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {ANALYSIS_STEPS.map((label, i) => (
            <li key={label} className="row" style={{ gap: 10, opacity: i < done ? 1 : i === done ? 0.85 : 0.35 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  flex: 'none',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: i < done ? 'var(--accent)' : 'var(--surface-2)',
                  color: i < done ? 'var(--accent-ink)' : 'var(--ink-3)',
                }}
              >
                {i < done ? '✓' : i + 1}
              </span>
              <span className="tiny">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
