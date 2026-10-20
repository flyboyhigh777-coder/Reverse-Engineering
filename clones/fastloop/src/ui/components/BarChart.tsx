import { useState } from 'react';
import type { DayPoint } from '../../domain/series';

const W = 320;
const H = 150;
const PAD = { top: 14, right: 10, bottom: 22, left: 34 };

/**
 * One bar per day. A day with no record draws an empty slot rather than a
 * zero-height bar, because "did not log" and "logged nothing" are different
 * facts and the chart must not merge them.
 */
export function BarChart({
  points,
  goal,
  format,
  tone = 'accent',
  label,
}: {
  points: readonly DayPoint[];
  goal: number | null;
  format: (value: number) => string;
  tone?: 'accent' | 'warm';
  label: string;
}): JSX.Element {
  const [hover, setHover] = useState<number | null>(null);

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) {
    return <p className="tiny muted">Пока нечего показать — записи за этот период нет.</p>;
  }

  const top = Math.max(goal ?? 0, ...values) * 1.12 || 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / points.length;
  const barW = Math.max(2, Math.min(18, slot * 0.62));
  const baseline = H - PAD.bottom;
  const y = (value: number) => PAD.top + (1 - value / top) * plotH;
  const cx = (index: number) => PAD.left + slot * (index + 0.5);
  const color = tone === 'warm' ? 'var(--warm)' : 'var(--accent)';

  const dayLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const active = hover === null ? null : points[hover];

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    const index = Math.floor((localX - PAD.left) / slot);
    setHover(index >= 0 && index < points.length ? index : null);
  };

  const tooltipX = active ? Math.min(W - 80, Math.max(2, cx(hover ?? 0) - 40)) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', maxWidth: '100%', touchAction: 'pan-y' }}
      role="img"
      aria-label={label}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {[top, top / 2].map((value, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD.left - 5} y={y(value) + 3.5} textAnchor="end" fontSize="9" fill="var(--ink-3)">
            {format(value)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} stroke="var(--line)" strokeWidth="1" />

      {points.map((point, index) => {
        const x = cx(index) - barW / 2;
        if (point.value === null) {
          return (
            <rect
              key={point.date}
              x={x}
              y={baseline - 3}
              width={barW}
              height={3}
              rx={1.5}
              fill="var(--track)"
            />
          );
        }
        const height = Math.max(2, baseline - y(point.value));
        const met = goal !== null && point.value >= goal;
        return (
          <rect
            key={point.date}
            x={x}
            y={baseline - height}
            width={barW}
            height={height}
            rx={Math.min(4, barW / 2)}
            fill={color}
            opacity={met || goal === null ? 1 : 0.42}
          />
        );
      })}

      {goal !== null ? (
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(goal)}
          y2={y(goal)}
          stroke="var(--warm)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      ) : null}

      <text x={PAD.left} y={H - 6} fontSize="9" fill="var(--ink-3)">
        {dayLabel(points[0].t)}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="var(--ink-3)">
        {dayLabel(points[points.length - 1].t)}
      </text>

      {active ? (
        <g pointerEvents="none">
          <rect x={tooltipX} y={PAD.top - 4} width="80" height="30" rx="7" fill="var(--surface)" stroke="var(--line)" />
          <text x={tooltipX + 8} y={PAD.top + 7} fontSize="9" fill="var(--ink-3)">
            {dayLabel(active.t)}
          </text>
          <text x={tooltipX + 8} y={PAD.top + 19} fontSize="11" fontWeight="700" fill="var(--ink)">
            {active.value === null ? 'нет записи' : format(active.value)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
