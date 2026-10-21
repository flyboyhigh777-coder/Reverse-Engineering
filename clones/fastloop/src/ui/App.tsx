import { useEffect, useState } from 'react';
import { refreshIfStale } from '../state/content';
import { getState, useAppState } from '../state/store';
import { publishWidgetState } from '../state/widget';
import { applyTheme } from '../state/theme';
import { Analyzing } from './onboarding/Analyzing';
import { PlanReveal } from './onboarding/PlanReveal';
import { Quiz } from './onboarding/Quiz';
import { Paywall } from './paywall/Paywall';
import { ProSheet } from './paywall/ProSheet';
import { Learn } from './screens/Learn';
import { Profile } from './screens/Profile';
import { Progress } from './screens/Progress';
import { Recipes } from './screens/Recipes';
import { Timer } from './screens/Timer';
import { BookIcon, ChartIcon, ChefIcon, PersonIcon, TimerIcon } from './components/common';

type Tab = 'timer' | 'progress' | 'recipes' | 'learn' | 'profile';

const TABS: readonly { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'timer', label: 'Таймер', icon: TimerIcon },
  { id: 'progress', label: 'Прогресс', icon: ChartIcon },
  { id: 'recipes', label: 'Еда', icon: ChefIcon },
  { id: 'learn', label: 'Статьи', icon: BookIcon },
  { id: 'profile', label: 'Профиль', icon: PersonIcon },
];

export function App(): JSX.Element {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('timer');
  const [pro, setPro] = useState<string | null>(null);
  const theme = state.profile.theme;

  // Quietly top the library up when the cache is stale. A failure is silent
  // here: the built-in library works, and an error belongs in the profile
  // where someone went looking for updates, not in the way of the timer.
  useEffect(() => {
    refreshIfStale();
  }, []);

  // Hand the widgets a fresh summary whenever anything they show changes.
  useEffect(() => {
    publishWidgetState(state);
  }, [state]);

  useEffect(() => {
    applyTheme(theme);
    // The Android wrapper calls this when the system flips to night mode.
    window.__fastloopSystemTheme = () => applyTheme(getState().profile.theme);
    return () => {
      delete window.__fastloopSystemTheme;
    };
  }, [theme]);

  if (state.stage === 'quiz') return <Quiz />;
  if (state.stage === 'analyzing') return <Analyzing />;
  if (state.stage === 'plan') return <PlanReveal />;
  if (state.stage === 'paywall') return <Paywall />;

  const requestPro = (reason: string) => setPro(reason);

  return (
    <div className="shell">
      <main className="screen">
        {tab === 'timer' ? <Timer onRequestPro={requestPro} /> : null}
        {tab === 'progress' ? <Progress onRequestPro={requestPro} /> : null}
        {tab === 'recipes' ? <Recipes onRequestPro={requestPro} /> : null}
        {tab === 'learn' ? <Learn onRequestPro={requestPro} /> : null}
        {tab === 'profile' ? <Profile onRequestPro={requestPro} /> : null}
      </main>

      <nav className="tabs" aria-label="Разделы">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="tab" aria-current={tab === id} onClick={() => setTab(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      {pro ? <ProSheet reason={pro} onClose={() => setPro(null)} /> : null}
    </div>
  );
}
