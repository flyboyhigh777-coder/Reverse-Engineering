import type { ReactNode } from 'react';
import { PHASES } from '../../domain/phases';

const SIZE = 248;
const C = SIZE / 2;
const R_MAIN = 96;
const R_PHASE = 116;

const TONE_VAR: Record<string, string> = {
  fed: 'var(--p-fed)',
  early: 'var(--p-early)',
  switch: 'var(--p-switch)',
  burn: 'var(--p-burn)',
  deep: 'var(--p-deep)',
};

function polar(radius: number, fraction: number): [number, number] {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
}

/** Arc between two fractions of the circle, clockwise from 12 o'clock. */
function arc(radius: number, from: number, to: number): string {
  const span = Math.max(0, Math.min(1, to) - Math.max(0, from));
  if (span <= 0) return '';
  const [x1, y1] = polar(radius, from);
  const [x2, y2] = polar(radius, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${span > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function Ring({
  progress,
  goalHours,
  running,
  children,
}: {
  /** 0..1+, where 1 is the plan's goal. */
  progress: number;
  goalHours: number;
  running: boolean;
  children: ReactNode;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(1, progress));
  const circumference = 2 * Math.PI * R_MAIN;
  const bands = PHASES.map((phase) => {
    const from = phase.fromHour / goalHours;
    const to = Math.min(phase.toHour, goalHours) / goalHours;
    return { id: phase.id, tone: phase.tone, d: arc(R_PHASE, from, to) };
  }).filter((band) => band.d !== '');

  return (
    <div className="ring-wrap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        style={{ maxWidth: SIZE, display: 'block' }}
        role="img"
        aria-label={`Прогресс голодания ${Math.round(clamped * 100)} процентов`}
      >
        <g strokeLinecap="round" fill="none">
          {bands.map((band) => (
            <path key={band.id} d={band.d} stroke={TONE_VAR[band.tone]} strokeWidth="5" />
          ))}
          <circle cx={C} cy={C} r={R_MAIN} stroke="var(--track)" strokeWidth="14" />
          <circle
            cx={C}
            cy={C}
            r={R_MAIN}
            stroke={running ? 'var(--warm)' : 'var(--accent)'}
            strokeWidth="14"
            strokeDasharray={`${(clamped * circumference).toFixed(2)} ${circumference.toFixed(2)}`}
            transform={`rotate(-90 ${C} ${C})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </g>
        {running && clamped > 0.004 ? (
          <circle
            cx={polar(R_MAIN, clamped)[0]}
            cy={polar(R_MAIN, clamped)[1]}
            r="6"
            fill="var(--surface)"
            stroke="var(--warm)"
            strokeWidth="3"
          />
        ) : null}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function PhaseRail({ activeId }: { activeId: string }): JSX.Element {
  return (
    <div className="rail" aria-hidden="true">
      {PHASES.map((phase) => (
        <div
          key={phase.id}
          style={{
            background: TONE_VAR[phase.tone],
            opacity: phase.id === activeId ? 1 : 0.4,
            outline: phase.id === activeId ? '2px solid var(--surface)' : 'none',
          }}
        />
      ))}
    </div>
  );
}
