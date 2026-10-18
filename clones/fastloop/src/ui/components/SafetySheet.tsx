import { SAFETY } from '../../domain/safety';
import type { SafetyBlock } from '../../domain/safety';
import { Sheet } from './common';

const TONE: Record<SafetyBlock['tone'], { color: string; mark: string }> = {
  stop: { color: 'var(--danger)', mark: '!' },
  emergency: { color: 'var(--danger)', mark: '!!' },
  doctor: { color: 'var(--warn)', mark: '?' },
  normal: { color: 'var(--good)', mark: '·' },
};

export function SafetySheet({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <Sheet title="Если стало плохо" onClose={onClose}>
      <p className="tiny muted">
        Голодание не должно сопровождаться плохим самочувствием. Прервать его — это не провал, а правильное решение.
      </p>

      {SAFETY.map((block) => (
        <div className="col" key={block.id} style={{ gap: 7 }}>
          <div className="row" style={{ gap: 8 }}>
            <span
              aria-hidden="true"
              style={{
                minWidth: 22,
                height: 22,
                padding: '0 5px',
                borderRadius: 11,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 800,
                background: 'var(--surface-2)',
                color: TONE[block.tone].color,
              }}
            >
              {TONE[block.tone].mark}
            </span>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 15, color: TONE[block.tone].color }}>
              {block.title}
            </strong>
          </div>
          {block.lead ? <p className="tiny muted">{block.lead}</p> : null}
          <ul className="col" style={{ gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
            {block.items.map((item) => (
              <li key={item} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {block.action ? <p className="tiny">{block.action}</p> : null}
        </div>
      ))}

      <p className="banner tiny">
        FastLoop — трекер, а не медицинский сервис. Этот экран не заменяет осмотр и не ставит диагноз.
      </p>
    </Sheet>
  );
}
