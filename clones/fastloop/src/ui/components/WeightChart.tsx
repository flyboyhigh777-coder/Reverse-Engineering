import { useId, useMemo, useState } from 'react';
import { kgToDisplay, weightUnit } from '../../domain/metrics';
import type { Units } from '../../domain/types';

export interface Point {
  readonly t: number;
  readonly kg: number;
}

const W = 320;
const H = 176;
const PAD = { top: 14, right: 12, bottom: 24, left: 38 };

/**
 * One series, so no legend box — the card title names it. A dashed goal line
 * is a reference, not a second series, and is labelled in place.
 */
export function WeightChart({
  points,
  goalKg,
  units,
  dashed = false,
}: {
  points: readonly Point[];
  goalKg: number | null;
  units: Units;
  dashed?: boolean;
}): JSX.Element {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const values = sorted.map((p) => p.kg);
    if (goalKg !== null) values.push(goalKg);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max(0.6, (rawMax - rawMin) * 0.18);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const tMin = sorted[0]?.t ?? 0;
    const tMax = sorted[sorted.length - 1]?.t ?? 1;
    const spanT = Math.max(1, tMax - tMin);
    const x = (t: number) => PAD.left + ((t - tMin) / spanT) * (W - PAD.left - PAD.right);
    const y = (kg: number) => PAD.top + (1 - (kg - min) / Math.max(0.001, max - min)) * (H - PAD.top - PAD.bottom);
    return { sorted, min, max, x, y, tMin, tMax };
  }, [points, goalKg]);

  if (model.sorted.length === 0) {
    return <p className="tiny muted">Нет записей веса.</p>;
  }

  const { sorted, x, y } = model;
  const line = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const baseline = H - PAD.bottom;
  const area = `${line} L ${x(sorted[sorted.length - 1].t).toFixed(1)} ${baseline} L ${x(sorted[0].t).toFixed(1)} ${baseline} Z`;
  const last = sorted[sorted.length - 1];
  const unit = weightUnit(units);
  const fmt = (kg: number) => kgToDisplay(kg, units).toFixed(1);
  const dayLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const active = hover === null ? null : sorted[Math.max(0, Math.min(sorted.length - 1, hover))];

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    sorted.forEach((p, i) => {
      const distance = Math.abs(x(p.t) - localX);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setHover(nearest);
  };

  const tooltipX = active ? Math.min(W - 74, Math.max(PAD.left - 10, x(active.t) - 37)) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', maxWidth: '100%', touchAction: 'pan-y' }}
      role="img"
      aria-label={`График веса: от ${fmt(sorted[0].kg)} до ${fmt(last.kg)} ${unit}`}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[model.max, (model.max + model.min) / 2, model.min].map((value, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(value) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">
            {fmt(value)}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '5 4' : undefined}
      />

      {goalKg !== null ? (
        <g>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(goalKg)}
            y2={y(goalKg)}
            stroke="var(--warm)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x={W - PAD.right} y={y(goalKg) - 5} textAnchor="end" fontSize="9.5" fill="var(--warm)" fontWeight="600">
            цель {fmt(goalKg)}
          </text>
        </g>
      ) : null}

      <circle cx={x(last.t)} cy={y(last.kg)} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />

      <text x={PAD.left} y={H - 7} fontSize="9.5" fill="var(--ink-3)">
        {dayLabel(sorted[0].t)}
      </text>
      <text x={W - PAD.right} y={H - 7} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">
        {dayLabel(last.t)}
      </text>

      {active ? (
        <g pointerEvents="none">
          <line x1={x(active.t)} x2={x(active.t)} y1={PAD.top} y2={baseline} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(active.t)} cy={y(active.kg)} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
          <rect x={tooltipX} y={PAD.top - 2} width="74" height="30" rx="7" fill="var(--surface)" stroke="var(--line)" />
          <text x={tooltipX + 8} y={PAD.top + 9} fontSize="9" fill="var(--ink-3)">
            {dayLabel(active.t)}
          </text>
          <text x={tooltipX + 8} y={PAD.top + 21} fontSize="11" fontWeight="700" fill="var(--ink)">
            {fmt(active.kg)} {unit}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
