import { useEffect, useMemo, useState } from 'react';
import { QUIZ } from '../../domain/quiz';
import type { QuizStep } from '../../domain/quiz';
import { actions, useAppState } from '../../state/store';
import { Ruler } from '../components/Ruler';

const DAY_MS = 86_400_000;

function defaultAnswer(step: QuizStep): string | string[] {
  switch (step.kind) {
    case 'number':
      return String(step.initial);
    case 'scale':
      return '3';
    case 'date':
      return new Date(Date.now() + 60 * DAY_MS).toISOString().slice(0, 10);
    case 'multi':
      return [];
    default:
      return '';
  }
}

export function Quiz(): JSX.Element {
  const state = useAppState();
  const [index, setIndex] = useState(0);
  const step = QUIZ[index];
  const stored = state.answers[step.id];
  const value = stored ?? defaultAnswer(step);

  // Seed defaults so a user can press Continue without touching the control.
  useEffect(() => {
    if (state.answers[step.id] === undefined && step.kind !== 'info' && step.kind !== 'single' && step.kind !== 'multi') {
      actions.answer(step.id, defaultAnswer(step));
    }
  }, [step, state.answers]);

  const canContinue = useMemo(() => {
    if (step.kind === 'info') return true;
    if (step.kind === 'text') return true;
    if (step.kind === 'multi') return Array.isArray(value) && value.length > 0;
    return typeof value === 'string' && value !== '';
  }, [step, value]);

  const advance = () => {
    if (index + 1 >= QUIZ.length) actions.finishQuiz();
    else setIndex(index + 1);
  };

  /** Single-choice steps commit and move on; everything else waits for Continue. */
  const chooseAndAdvance = (next: string) => {
    actions.answer(step.id, next);
    window.setTimeout(advance, 160);
  };

  const set = (next: string) => actions.answer(step.id, next);

  const toggle = (option: string) => {
    const list = Array.isArray(value) ? [...value] : [];
    const at = list.indexOf(option);
    if (at >= 0) list.splice(at, 1);
    else list.push(option);
    actions.answer(step.id, list);
  };

  return (
    <div className="shell">
      <div className="screen quiz">
        <div className="row between" style={{ flex: 'none' }}>
          <button
            type="button"
            className="btn quiet"
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label="Назад"
          >
            ←
          </button>
          <span className="tiny muted num">
            {index + 1} / {QUIZ.length}
          </span>
        </div>
        <div className="progressbar" style={{ flex: 'none' }}>
          <div style={{ width: `${((index + 1) / QUIZ.length) * 100}%` }} />
        </div>

        <div className="col" style={{ gap: 14, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {step.kind === 'info' ? (
            <InfoStep step={step} />
          ) : (
            <>
              <h1 style={{ fontSize: 24 }}>{step.question}</h1>
              {'hint' in step && step.hint ? <p className="tiny muted">{step.hint}</p> : null}
              <StepBody step={step} value={value} onChoose={chooseAndAdvance} onSet={set} onToggle={toggle} />
            </>
          )}
        </div>

        {step.kind === 'single' ? null : (
          <button type="button" className="btn block" style={{ flex: 'none' }} onClick={advance} disabled={!canContinue}>
            {index + 1 >= QUIZ.length ? 'Собрать план' : 'Дальше'}
          </button>
        )}

        {index === 0 ? (
          <button type="button" className="btn quiet tiny" style={{ flex: 'none' }} onClick={() => actions.loadDemo()}>
            Пропустить и сразу открыть приложение
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InfoStep({ step }: { step: Extract<QuizStep, { kind: 'info' }> }): JSX.Element {
  return (
    <div className="col" style={{ gap: 16, justifyContent: 'center', flex: 1 }}>
      {step.stat ? (
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 44, fontWeight: 800, color: 'var(--accent)' }}>
            {step.stat}
          </span>
          <span className="tiny muted">{step.statLabel}</span>
        </div>
      ) : null}
      <h1 style={{ fontSize: 26 }}>{step.title}</h1>
      <p className="muted" style={{ maxWidth: '65ch' }}>
        {step.body}
      </p>
    </div>
  );
}

function StepBody({
  step,
  value,
  onChoose,
  onSet,
  onToggle,
}: {
  step: QuizStep;
  value: string | readonly string[];
  onChoose: (next: string) => void;
  onSet: (next: string) => void;
  onToggle: (option: string) => void;
}): JSX.Element | null {
  switch (step.kind) {
    case 'single':
      return (
        <div className="col" style={{ gap: 9 }}>
          {step.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="option"
              aria-pressed={value === option.value}
              onClick={() => onChoose(option.value)}
            >
              <span className="mark" />
              <span className="col" style={{ gap: 1 }}>
                <span style={{ fontWeight: 500 }}>{option.label}</span>
                {option.sub ? <span className="tiny muted">{option.sub}</span> : null}
              </span>
            </button>
          ))}
        </div>
      );

    case 'multi':
      return (
        <div className="col" style={{ gap: 9 }}>
          {step.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="option"
              aria-pressed={Array.isArray(value) && value.includes(option.value)}
              onClick={() => onToggle(option.value)}
            >
              <span className="mark" />
              <span style={{ fontWeight: 500 }}>{option.label}</span>
            </button>
          ))}
        </div>
      );

    case 'number': {
      const current = Number(value) || step.initial;
      return (
        <div className="col" style={{ gap: 14, paddingBlock: 10 }}>
          <Ruler
            value={current}
            min={step.min}
            max={step.max}
            step={step.step ?? 1}
            unit={step.unit}
            labelEvery={step.labelEvery ?? 10}
            onChange={(next) => onSet(String(next))}
          />
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Потяните шкалу или нажмите на число, чтобы ввести вручную.
          </p>
        </div>
      );
    }

    case 'scale': {
      const current = Number(value) || 3;
      return (
        <div className="col" style={{ gap: 14, paddingBlock: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="chip"
                aria-pressed={current === n}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onSet(String(n))}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="row between tiny muted">
            <span>{step.low}</span>
            <span>{step.high}</span>
          </div>
        </div>
      );
    }

    case 'date':
      return (
        <input
          id={`q-${step.id}`}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onSet(event.target.value)}
          aria-label={step.question}
        />
      );

    case 'text':
      return (
        <input
          id={`q-${step.id}`}
          type="text"
          placeholder={step.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onSet(event.target.value)}
          aria-label={step.question}
        />
      );

    default:
      return null;
  }
}
