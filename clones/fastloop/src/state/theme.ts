/**
 * Which palette the app shows.
 *
 * In a browser the stylesheet's prefers-color-scheme rules do the work, so
 * "auto" simply removes the override and lets CSS react to the system on its
 * own. Inside the Android WebView that signal is unreliable below recent API
 * levels, so the wrapper reports night mode directly and this sets the
 * data-theme attribute the stylesheet also understands.
 */

export type ThemePreference = 'auto' | 'light' | 'dark';

export const THEME_LABELS: Record<ThemePreference, string> = {
  auto: 'Как в телефоне',
  light: 'Светлая',
  dark: 'Тёмная',
};

declare global {
  interface Window {
    /** Called by the Android wrapper when the system theme changes. */
    __fastloopSystemTheme?: () => void;
  }
}

function nativeNight(): boolean | null {
  const bridge = typeof window === 'undefined' ? undefined : window.FastLoopNative;
  if (!bridge || typeof bridge.isNightMode !== 'function') return null;
  try {
    return bridge.isNightMode();
  } catch {
    return null;
  }
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (preference === 'light' || preference === 'dark') {
    root.setAttribute('data-theme', preference);
    return;
  }

  const night = nativeNight();
  if (night === null) {
    // A browser follows the media query by itself, including live changes.
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', night ? 'dark' : 'light');
  }
}

/** True when the app runs inside the Android wrapper. */
export function hasNativeTheme(): boolean {
  return nativeNight() !== null;
}
