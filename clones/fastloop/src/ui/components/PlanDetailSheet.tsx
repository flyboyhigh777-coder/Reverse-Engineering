import { ALWAYS_NOT_FOR, EVIDENCE_CLASS, EVIDENCE_NOTE, detailFor } from '../../domain/planDetail';
import type { Plan } from '../../domain/plans';
import { PlanIcon } from './PlanIcons';
import { Sheet } from './common';

const TIER_CLASS: Readonly<Record<string, string>> = {
  'Базовые': 'tier-base',
  'Промежуточные': 'tier-mid',
  'Расширенные': 'tier-ext',
  'Длительные': 'tier-long',
};

/** The tints cycle so neighbouring benefit cards never share a colour. */
const TINTS = ['t-lime', 't-sky', 't-peach', 't-lilac', 't-mint', 't-sand'] as const;

function Check(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

function Cross(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

/**
 * Everything known about one window, on one page.
 *
 * Reads top to bottom as a decision: what the day looks like, what is claimed
 * and how well it is established, who it fits, who it does not, how to get
 * through it, and only then the button that switches to it.
 */
export function PlanDetailSheet({
  plan,
  selected,
  locked,
  onChoose,
  onClose,
}: {
  plan: Plan;
  selected: boolean;
  locked: boolean;
  onChoose: () => void;
  onClose: () => void;
}): JSX.Element {
  const detail = detailFor(plan.id);
  const eatShare = Math.round((plan.eatHours / 24) * 100);

  return (
    <Sheet title={plan.title} onClose={onClose}>
      <div className={`plan-hero ${TIER_CLASS[plan.tier] ?? 'tier-mid'}`}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <span className="col" style={{ gap: 2 }}>
            <span className="ttl num">{plan.title}</span>
            <span className="sub">{detail?.headline ?? plan.blurb}</span>
          </span>
          <span className="pill">{plan.level}</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="plan-split" aria-hidden="true">
            <i className="fast" style={{ width: `${100 - eatShare}%` }} />
            <i className="eat" style={{ width: `${eatShare}%` }} />
          </span>
          <span className="plan-legend num">
            <span>{plan.fastHours} ч без еды</span>
            <span>{plan.eatHours} ч окно</span>
          </span>
        </div>
      </div>

      <p className="tiny">{detail?.summary ?? plan.suits}</p>

      {plan.caution ? (
        <p className="banner tiny" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
          {plan.caution}
        </p>
      ) : null}

      {detail && detail.benefits.length > 0 ? (
        <div className="col" style={{ gap: 9 }}>
          <span className="eyebrow">Что это даёт</span>
          <p className="tiny muted">
            У каждого пункта стоит метка: насколько это подтверждено на людях, а не на мышах и не в рекламе.
          </p>
          {detail.benefits.map((benefit, index) => (
            <div key={benefit.title} className={`benefit ${TINTS[index % TINTS.length]}`}>
              <span className="ico"><PlanIcon kind={benefit.icon} /></span>
              <span className="col grow" style={{ gap: 4 }}>
                <span className="row wrap" style={{ gap: 7 }}>
                  <b>{benefit.title}</b>
                  <span className={`evi ${EVIDENCE_CLASS[benefit.evidence]}`} title={EVIDENCE_NOTE[benefit.evidence]}>
                    {benefit.evidence}
                  </span>
                </span>
                <span className="tiny">{benefit.text}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {detail ? (
        <div className="col" style={{ gap: 10 }}>
          <div className="card tint t-mint">
            <span className="eyebrow">Подходит, если</span>
            <ul className="fitlist yes">
              {detail.goodFor.map((line) => (
                <li key={line}><span className="m"><Check /></span><span>{line}</span></li>
              ))}
            </ul>
          </div>
          <div className="card tint t-rose">
            <span className="eyebrow">Не подходит</span>
            <ul className="fitlist no">
              {detail.notFor.map((line) => (
                <li key={line}><span className="m"><Cross /></span><span>{line}</span></li>
              ))}
            </ul>
            <hr className="divider" />
            <span className="tiny muted">И при любом окне — сначала к врачу:</span>
            <ul className="fitlist no">
              {ALWAYS_NOT_FOR.map((line) => (
                <li key={line}><span className="m"><Cross /></span><span>{line}</span></li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {detail && detail.practice.length > 0 ? (
        <div className="col" style={{ gap: 10 }}>
          <span className="eyebrow">Как провести такой день</span>
          <ol className="steps">
            {detail.practice.map((step) => (
              <li key={step.title}>
                <span className="col grow" style={{ gap: 2 }}>
                  <b>{step.title}</b>
                  <span className="tiny muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {detail ? <p className="banner tiny">{detail.startHere}</p> : null}

      <button type="button" className="btn block" onClick={onChoose} disabled={selected}>
        {selected ? 'Это ваша схема' : locked ? `Открыть ${plan.title} в PRO` : `Перейти на ${plan.title}`}
      </button>
    </Sheet>
  );
}
