import { useState } from 'react';
import { coachInsights } from '../../domain/coach';
import type { Insight, Tone } from '../../domain/coach';
import { useAppState } from '../../state/store';
import { Card } from './common';

const TONE_COLOR: Record<Tone, string> = {
  good: 'var(--good)',
  info: 'var(--accent)',
  warn: 'var(--warn)',
};

const TONE_MARK: Record<Tone, string> = { good: '✓', info: '·', warn: '!' };

export function CoachCard({ now }: { now: number }): JSX.Element | null {
  const state = useAppState();
  const [expanded, setExpanded] = useState(false);
  const insights = coachInsights(state, now);
  if (insights.length === 0) return null;

  const shown = expanded ? insights : insights.slice(0, 2);

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">Тренер</span>
        <span className="pill">по вашим записям</span>
      </div>
      <div className="col" style={{ gap: 13 }}>
        {shown.map((insight) => (
          <Line key={insight.id} insight={insight} />
        ))}
      </div>
      {insights.length > 2 ? (
        <button type="button" className="btn ghost sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Свернуть' : `Ещё ${insights.length - 2}`}
        </button>
      ) : null}
    </Card>
  );
}

function Line({ insight }: { insight: Insight }): JSX.Element {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          flex: 'none',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          marginTop: 1,
          background: 'var(--surface-2)',
          color: TONE_COLOR[insight.tone],
        }}
      >
        {TONE_MARK[insight.tone]}
      </span>
      <span className="col grow" style={{ gap: 2 }}>
        <strong className="tiny" style={{ fontSize: 13.5 }}>
          {insight.title}
        </strong>
        <span className="tiny muted">{insight.body}</span>
      </span>
    </div>
  );
}
