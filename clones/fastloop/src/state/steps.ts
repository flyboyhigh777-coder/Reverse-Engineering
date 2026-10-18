import { useCallback, useEffect, useRef, useState } from 'react';
import { isoDate } from '../domain/fasting';
import type { StepSource } from '../domain/types';
import { actions, getState } from './store';

/** Implemented by the Android wrapper and injected into the WebView. */
export interface NativeBridge {
  getStepsToday(): number;
  hasStepSensor(): boolean;
  hasPermission(): boolean;
  requestPermission(): void;
  appVersion(): string;
  /** Human-readable sensor state; absent in builds before 0.3.0. */
  diagnostics?(): string;
  /** Android night mode; absent in builds before 0.10.0. */
  isNightMode?(): boolean;
}

declare global {
  interface Window {
    FastLoopNative?: NativeBridge;
  }
  interface DeviceMotionEventConstructor {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }
}

export type CounterState =
  | 'native'        // hardware step counter, counts even when the app is closed
  | 'native-denied' // sensor present, permission not granted yet
  | 'motion'        // accelerometer in the browser, only while this page is open
  | 'motion-off'    // accelerometer available but not started
  | 'manual';       // nothing to read from; the user types the number

function nativeBridge(): NativeBridge | null {
  const bridge = typeof window === 'undefined' ? undefined : window.FastLoopNative;
  return bridge && typeof bridge.getStepsToday === 'function' ? bridge : null;
}

function motionAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
}

/**
 * Peak counter over the accelerometer magnitude. A low-pass filter removes
 * sensor noise; a refractory window keeps one stride from counting twice.
 * It is an approximation and the UI says so — the hardware counter in the
 * Android build is the accurate path.
 */
function createStepDetector(onStep: () => void): (event: DeviceMotionEvent) => void {
  let smoothed = 0;
  let previous = 0;
  let rising = false;
  let lastStepAt = 0;
  return (event) => {
    const a = event.accelerationIncludingGravity;
    if (!a) return;
    const magnitude = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
    smoothed = smoothed === 0 ? magnitude : smoothed * 0.8 + magnitude * 0.2;
    const delta = smoothed - previous;
    previous = smoothed;
    const at = Date.now();
    if (delta > 0.35) {
      rising = true;
    } else if (rising && delta < -0.35 && at - lastStepAt > 280) {
      rising = false;
      lastStepAt = at;
      onStep();
    }
  };
}

export function useStepCounter(): {
  state: CounterState;
  source: StepSource;
  enable: () => Promise<void>;
} {
  const [state, setState] = useState<CounterState>(() => {
    const bridge = nativeBridge();
    if (bridge) return bridge.hasPermission() ? 'native' : 'native-denied';
    return motionAvailable() ? 'motion-off' : 'manual';
  });
  const counted = useRef(0);
  const base = useRef(0);

  // Hardware counter: poll the bridge; it keeps counting while the app is shut.
  useEffect(() => {
    if (state !== 'native') return;
    const bridge = nativeBridge();
    if (!bridge) return;
    const read = () => {
      try {
        actions.reportSensorSteps(bridge.getStepsToday(), 'native');
      } catch {
        /* bridge went away — fall back to whatever is already recorded */
      }
    };
    read();
    const id = window.setInterval(read, 4000);
    return () => window.clearInterval(id);
  }, [state]);

  // Browser fallback: only counts while this page is open and awake.
  useEffect(() => {
    if (state !== 'motion') return;
    const today = isoDate(Date.now());
    base.current = getState().days.find((d) => d.date === today)?.steps ?? 0;
    counted.current = 0;
    const handler = createStepDetector(() => {
      counted.current += 1;
      actions.reportSensorSteps(base.current + counted.current, 'motion');
    });
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [state]);

  const enable = useCallback(async () => {
    const bridge = nativeBridge();
    if (bridge) {
      bridge.requestPermission();
      // The dialog is modal and the person may sit on it, so poll for a while
      // instead of reading the answer once and giving up.
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        if (bridge.hasPermission()) {
          setState('native');
          window.clearInterval(id);
        } else if (attempts >= 30) {
          window.clearInterval(id);
        }
      }, 600);
      return;
    }
    const ctor = window.DeviceMotionEvent as unknown as DeviceMotionEventConstructor | undefined;
    if (ctor && typeof ctor.requestPermission === 'function') {
      try {
        const verdict = await ctor.requestPermission();
        setState(verdict === 'granted' ? 'motion' : 'motion-off');
      } catch {
        setState('motion-off');
      }
      return;
    }
    if (motionAvailable()) setState('motion');
  }, []);

  useEffect(() => {
    if (state !== 'native-denied') return;
    const recheck = () => {
      const bridge = nativeBridge();
      if (bridge && bridge.hasPermission()) setState('native');
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [state]);

  const source: StepSource = state === 'native' ? 'native' : state === 'motion' ? 'motion' : 'manual';
  return { state, source, enable };
}

/** Sensor state straight from the Android side, for the diagnostics block. */
export function readDiagnostics(): string | null {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.diagnostics !== 'function') return null;
  try {
    return bridge.diagnostics();
  } catch {
    return null;
  }
}

export function isAndroidBuild(): boolean {
  return nativeBridge() !== null;
}
