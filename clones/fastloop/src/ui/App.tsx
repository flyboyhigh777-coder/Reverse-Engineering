import { useState } from 'react';
import { useAppState } from '../state/store';
import { Analyzing } from './onboarding/Analyzing';
import { PlanReveal } from './onboarding/PlanReveal';
import { Quiz } from './onboarding/Quiz';
import { Paywall } from './paywall/Paywall';
import { ProSheet } from './paywall/ProSheet';
import { Learn } from './screens/Learn';
import { Profile } from './screens/Profile';
import { Progress } from './screens/Progress';
import { Timer } from './screens/Timer';
import { BookIcon, ChartIcon, PersonIcon, TimerIcon } from './components/common';

type Tab = 'timer' | 'progress' | 'learn' | 'profile';

const TABS: readonly { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'timer', label: 'Таймер', icon: TimerIcon },
  { id: 'progress', label: 'Прогресс', icon: ChartIcon },
  { id: 'learn', label: 'Статьи', icon: BookIcon },
  { id: 'profile', label: 'Профиль', icon: PersonIcon },
];

export function App(): JSX.Element {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('timer');
  const [pro, setPro] = useState<string | null>(null);

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
