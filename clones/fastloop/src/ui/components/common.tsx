import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }): JSX.Element {
  return (
    <div className="stat">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="row between">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" className="closebtn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LockPill(): JSX.Element {
  return (
    <span className="pill lock">
      <LockIcon /> PRO
    </span>
  );
}

export function LockIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2.5" fill="none" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function TimerIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}

export function ChartIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-4M12.5 16V8M17 16v-6" />
    </svg>
  );
}

/** An open book. The previous one left its second page as a loose stroke. */
export function BookIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 7.2v12.3" />
      <path d="M12 7.2C10.5 5.9 8.6 5.3 6 5.3H3.4v12.4H6c2.6 0 4.5.6 6 1.8" />
      <path d="M12 7.2c1.5-1.3 3.4-1.9 6-1.9h2.6v12.4H18c-2.6 0-4.5.6-6 1.8" />
    </svg>
  );
}

/**
 * Fork and knife. The chef's hat it replaces had a brim narrower than its
 * crown, which at 22 pixels read as a jar with a lid — and this tab is a
 * food diary now, not only a recipe book.
 */
export function ChefIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 3v5.5M10.4 3v5.5" />
      <path d="M7 8.5h3.4" />
      <path d="M8.7 8.5V21" />
      <path d="M16.6 3c-1.3 1.9-2 3.8-2 5.7 0 1.5.7 2.4 2 2.5V21" />
    </svg>
  );
}

export function PersonIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}

export function DropIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS} width="18" height="18">
      <path d="M12 3.5s5.5 6 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3.5 12 3.5z" />
    </svg>
  );
}

export function StepIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS} width="18" height="18">
      <path d="M8.5 14c-1.8-1.2-2.4-3.6-1.8-6 .5-2 2-3.3 3.3-2.9 1.4.4 1.9 2.2 1.5 4.3-.3 1.6-.4 3 .2 4" />
      <path d="M7 16.5c.5 2.2 1.9 3.4 3.4 3 1.2-.3 1.6-1.4 1.3-2.6M15.5 10c1.4-1 1.9-2.9 1.4-4.6" />
    </svg>
  );
}

export function ScaleIcon(): JSX.Element {
  return (
    <svg {...ICON_PROPS} width="18" height="18">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M12 8.5v2.2M9 9.4l1.2 1.7M15 9.4l-1.2 1.7" />
    </svg>
  );
}
