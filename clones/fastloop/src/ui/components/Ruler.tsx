import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A tape-measure picker for height, weight and age.
 *
 * It replaces a range input because a range input is *absolute*: the thumb
 * jumps to wherever the finger lands or lifts, so letting go a few pixels off
 * silently changes the value. This control is *relative* — the value moves by
 * how far the finger travelled and then stops exactly there. Each step crossed
 * is a detent with a short vibration, so the value can be felt as well as seen.
 *
 * A second scale can run along the opposite edge, the way centimetres and
 * inches share one tape. Both are always visible, so the reading makes sense
 * whichever system the person thinks in.
 */

const HEIGHT = 104;
const BASELINE = 54;
const PX_PER_STEP = 11;
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

export interface SecondaryScale {
  /** Primary units in one secondary unit — 2.54 cm per inch, 0.4536 kg per lb. */
  readonly per: number;
  /** Label spacing, in secondary units. */
  readonly labelEvery: number;
  readonly label: (secondary: number) => string;
  /** The converted reading shown beside the main number. */
  readonly readout: (primary: number) => string;
}

export function feetInches(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return inches === 0 ? `${feet}′` : `${feet}′${inches}″`;
}

export const HEIGHT_SCALE: SecondaryScale = {
  per: 2.54,
  labelEvery: 6,
  label: (inches) => feetInches(inches),
  readout: (cm) => feetInches(cm / 2.54),
};

export const WEIGHT_SCALE: SecondaryScale = {
  per: 0.45359237,
  labelEvery: 10,
  label: (pounds) => String(pounds),
  readout: (kg) => `${(kg / 0.45359237).toFixed(0)} фнт`,
};

export function Ruler({
  value,
  min,
  max,
  step,
  unit,
  labelEvery,
  secondary,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Spacing of numbered ticks, in value units. */
  labelEvery: number;
  secondary?: SecondaryScale;
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
  const lowBound = Math.max(min, value - halfUnits);
  const highBound = Math.min(max, value + halfUnits);
  const xOf = (v: number) => width / 2 + (v - value) * pxPerUnit;

  const ticks: { x: number; v: number; major: boolean }[] = [];
  for (let v = round(lowBound - step, step); v <= highBound + step; v = round(v + step, step)) {
    if (v < min || v > max) continue;
    const major = Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6;
    ticks.push({ x: xOf(v), v, major });
  }

  const secondTicks: { x: number; s: number; major: boolean }[] = [];
  if (secondary) {
    const from = Math.floor(lowBound / secondary.per) - 1;
    const to = Math.ceil(highBound / secondary.per) + 1;
    for (let s = from; s <= to; s += 1) {
      const primary = s * secondary.per;
      if (primary < min || primary > max) continue;
      secondTicks.push({ x: xOf(primary), s, major: s % secondary.labelEvery === 0 });
    }
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
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -labelEvery,
      PageUp: labelEvery,
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
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <button type="button" className="chip ruler-step" onClick={() => commit(value - step)} aria-label={`Меньше на ${step} ${unit}`}>
          −
        </button>
        <div className="col" style={{ alignItems: 'center', gap: 0 }}>
          {typing === null ? (
            <button
              type="button"
              className="lockbtn bigvalue"
              style={{ width: 'auto', padding: '0 6px' }}
              onClick={() => setTyping(value.toFixed(decimals))}
              title="Нажмите, чтобы ввести значение"
            >
              {value.toFixed(decimals)}
              <span style={{ fontSize: 20, color: 'var(--ink-3)', marginLeft: 7 }}>{unit}</span>
            </button>
          ) : (
            <input
              id="ruler-direct"
              type="number"
              inputMode="decimal"
              autoFocus
              step={step}
              value={typing}
              style={{ maxWidth: 170, textAlign: 'center', fontSize: 28, fontWeight: 700 }}
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
          {secondary ? <span className="tiny muted num">{secondary.readout(value)}</span> : null}
        </div>
        <button type="button" className="chip ruler-step" onClick={() => commit(value + step)} aria-label={`Больше на ${step} ${unit}`}>
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
        aria-valuetext={`${value.toFixed(decimals)} ${unit}${secondary ? `, ${secondary.readout(value)}` : ''}`}
        aria-label="Прокрутите, чтобы изменить значение"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" height={HEIGHT} aria-hidden="true">
          <line x1={0} x2={width} y1={BASELINE} y2={BASELINE} stroke="var(--line)" strokeWidth="1" />

          {ticks.map((tick) => (
            <g key={`p${tick.v}`}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={BASELINE}
                y2={BASELINE - (tick.major ? 20 : 11)}
                stroke={tick.major ? 'var(--ink-3)' : 'var(--line)'}
                strokeWidth={tick.major ? 1.7 : 1}
                strokeLinecap="round"
              />
              {tick.major ? (
                <text x={tick.x} y={BASELINE - 26} textAnchor="middle" fontSize="12" fill="var(--ink-3)">
                  {tick.v}
                </text>
              ) : null}
            </g>
          ))}

          {secondTicks.map((tick) => (
            <g key={`s${tick.s}`}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={BASELINE}
                y2={BASELINE + (tick.major ? 16 : 8)}
                stroke={tick.major ? 'var(--ink-3)' : 'var(--line)'}
                strokeWidth={tick.major ? 1.4 : 1}
                strokeLinecap="round"
                opacity={tick.major ? 0.8 : 0.5}
              />
              {tick.major ? (
                <text x={tick.x} y={BASELINE + 32} textAnchor="middle" fontSize="11" fill="var(--ink-3)" opacity="0.8">
                  {secondary?.label(tick.s)}
                </text>
              ) : null}
            </g>
          ))}

          <line
            x1={width / 2}
            x2={width / 2}
            y1={BASELINE - 30}
            y2={BASELINE + (secondary ? 22 : 6)}
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
