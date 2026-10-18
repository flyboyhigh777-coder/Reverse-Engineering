import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A tape-measure picker for height, weight and age.
 *
 * It replaces a range input because a range input is *absolute*: the thumb
 * jumps to wherever the finger lands or lifts, so letting go a few pixels off
 * silently changes the value. This control is *relative* — the value moves by
 * how far the finger travelled and then stops exactly there. Each step crossed
 * is a detent with a short vibration, so the value can be felt as well as seen.
 */

const HEIGHT = 64;
const PX_PER_STEP = 9;
const CENTER_Y = 8;
const HAPTIC_MIN_GAP_MS = 28;

let lastHapticAt = 0;

function detent(): void {
  const now = Date.now();
  if (now - lastHapticAt < HAPTIC_MIN_GAP_MS) return;
  lastHapticAt = now;
  try {
    navigator.vibrate?.(8);
  } catch {
    /* no vibration motor, or the browser refuses — the control still works */
  }
}

function round(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

export function Ruler({
  value,
  min,
  max,
  step,
  unit,
  labelEvery,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Spacing of numbered ticks, in value units. */
  labelEvery: number;
  onChange: (next: number) => void;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [typing, setTyping] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startValue: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const clamp = useCallback((next: number) => Math.min(max, Math.max(min, next)), [min, max]);

  const commit = useCallback(
    (next: number) => {
      const snapped = clamp(round(next, step));
      if (snapped !== value) {
        detent();
        onChange(snapped);
      }
    },
    [clamp, step, value, onChange],
  );

  const pxPerUnit = PX_PER_STEP / step;
  const halfUnits = width / 2 / pxPerUnit;
  const firstTick = round(Math.max(min, value - halfUnits) - step, step);
  const lastTick = round(Math.min(max, value + halfUnits) + step, step);

  const ticks: { x: number; v: number; major: boolean }[] = [];
  for (let v = firstTick; v <= lastTick + 1e-9; v = round(v + step, step)) {
    if (v < min || v > max) continue;
    const major = Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6;
    ticks.push({ x: width / 2 + (v - value) * pxPerUnit, v, major });
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startValue: value };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    // Dragging left pulls higher numbers under the needle, like a real tape.
    commit(state.startValue - (event.clientX - state.startX) / pxPerUnit);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const jump = labelEvery;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -jump,
      PageUp: jump,
    };
    if (event.key === 'Home') {
      event.preventDefault();
      commit(min);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      commit(max);
      return;
    }
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    commit(value + delta);
  };

  const decimals = (String(step).split('.')[1] ?? '').length;

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        <button type="button" className="chip" onClick={() => commit(value - step)} aria-label={`Меньше на ${step} ${unit}`}>
          −
        </button>
        {typing === null ? (
          <button
            type="button"
            className="lockbtn bigvalue"
            style={{ width: 'auto', padding: '0 6px' }}
            onClick={() => setTyping(value.toFixed(decimals))}
            title="Нажмите, чтобы ввести значение"
          >
            {value.toFixed(decimals)}
            <span style={{ fontSize: 18, color: 'var(--ink-3)', marginLeft: 6 }}>{unit}</span>
          </button>
        ) : (
          <input
            id="ruler-direct"
            type="number"
            inputMode="decimal"
            autoFocus
            step={step}
            value={typing}
            style={{ maxWidth: 160, textAlign: 'center', fontSize: 24, fontWeight: 700 }}
            onChange={(event) => setTyping(event.target.value)}
            onBlur={() => {
              const parsed = Number.parseFloat(typing.replace(',', '.'));
              if (Number.isFinite(parsed)) onChange(clamp(round(parsed, step)));
              setTyping(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setTyping(null);
            }}
            aria-label={`Значение в ${unit}`}
          />
        )}
        <button type="button" className="chip" onClick={() => commit(value + step)} aria-label={`Больше на ${step} ${unit}`}>
          +
        </button>
      </div>

      <div
        ref={hostRef}
        className="ruler"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(decimals)} ${unit}`}
        aria-label="Прокрутите, чтобы изменить значение"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" height={HEIGHT} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick.v}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={CENTER_Y}
                y2={CENTER_Y + (tick.major ? 20 : 11)}
                stroke={tick.major ? 'var(--ink-3)' : 'var(--line)'}
                strokeWidth={tick.major ? 1.6 : 1}
                strokeLinecap="round"
              />
              {tick.major ? (
                <text x={tick.x} y={CENTER_Y + 38} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                  {tick.v}
                </text>
              ) : null}
            </g>
          ))}
          <line
            x1={width / 2}
            x2={width / 2}
            y1={CENTER_Y - 4}
            y2={CENTER_Y + 28}
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
