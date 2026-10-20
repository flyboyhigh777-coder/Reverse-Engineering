import { useEffect, useMemo, useState } from 'react';
import { SECTIONS, visibleSteps } from '../../domain/quiz';
import type { QuizStep } from '../../domain/quiz';
import { actions, useAppState } from '../../state/store';
import { BackupSheet } from '../components/BackupSheet';
import { HEIGHT_SCALE, Ruler, WEIGHT_SCALE } from '../components/Ruler';

const DAY_MS = 86_400_000;

function defaultAnswer(step: QuizStep): string | string[] {
  switch (step.kind) {
    case 'number':
      return String(step.initial);
    case 'time':
      return step.initial;
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
  const [restoring, setRestoring] = useState(false);
  const steps = useMemo(() => visibleSteps(state.answers), [state.answers]);
  const position = Math.min(index, steps.length - 1);
  const step = steps[position];
  const stored = state.answers[step.id];
  const value = stored ?? defaultAnswer(step);

  // Seed a default so Continue works without touching the control first.
  useEffect(() => {
    const seedable = step.kind === 'number' || step.kind === 'time' || step.kind === 'scale' || step.kind === 'date';
    if (seedable && state.answers[step.id] === undefined) actions.answer(step.id, defaultAnswer(step));
  }, [step, state.answers]);

  const canContinue = useMemo(() => {
    if (step.kind === 'info' || step.kind === 'text') return true;
    if (step.kind === 'multi') return Array.isArray(value) && value.length > 0;
    return typeof value === 'string' && value !== '';
  }, [step, value]);

  const advance = () => {
    if (position + 1 >= steps.length) actions.finishQuiz();
    else setIndex(position + 1);
  };

  const chooseAndAdvance = (next: string) => {
    actions.answer(step.id, next);
    window.setTimeout(advance, 160);
  };

  const set = (next: string) => actions.answer(step.id, next);

  const toggle = (option: string) => {
    if (step.kind !== 'multi') return;
    const current = Array.isArray(value) ? [...value] : [];
    const exclusive = step.exclusive;
    if (exclusive && option === exclusive) {
      actions.answer(step.id, current.includes(exclusive) ? [] : [exclusive]);
      return;
    }
    const without = exclusive ? current.filter((item) => item !== exclusive) : current;
    const at = without.indexOf(option);
    if (at >= 0) without.splice(at, 1);
    else without.push(option);
    actions.answer(step.id, without);
  };

  const sectionIndex = SECTIONS.indexOf(step.section);
  const percent = Math.round(((position + 1) / steps.length) * 100);

  return (
    <div className="shell">
      <div className="screen quiz">
        <div className="row between" style={{ flex: 'none' }}>
          <button
            type="button"
            className="btn quiet"
            onClick={() => setIndex(Math.max(0, position - 1))}
            disabled={position === 0}
            aria-label="Назад"
          >
            ←
          </button>
          <span className="tiny muted num">
            {position + 1} / {steps.length}
          </span>
        </div>

        <div className="col" style={{ gap: 6, flex: 'none' }}>
          <div className="progressbar">
            <div style={{ width: `${percent}%` }} />
          </div>
          <div className="row between tiny muted">
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{step.section}</span>
            <span>
              раздел {sectionIndex + 1} из {SECTIONS.length}
            </span>
          </div>
        </div>

        <div className="col" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* marginBlock:auto centres a short step without clipping a long one */}
          <div className="col" style={{ gap: 14, marginBlock: 'auto' }}>
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
        </div>

        {step.kind === 'single' ? null : (
          <button type="button" className="btn block" style={{ flex: 'none' }} onClick={advance} disabled={!canContinue}>
            {position + 1 >= steps.length ? 'Собрать план' : 'Дальше'}
          </button>
        )}

        {position === 0 ? (
          <div className="col" style={{ gap: 2, flex: 'none' }}>
            <button type="button" className="btn quiet tiny" onClick={() => setRestoring(true)}>
              У меня есть резервная копия
            </button>
            <button type="button" className="btn quiet tiny" onClick={() => actions.loadDemo()}>
              Пропустить и сразу открыть приложение
            </button>
          </div>
        ) : null}
      </div>

      {restoring ? <BackupSheet onClose={() => setRestoring(false)} /> : null}
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
              <span className="col" style={{ gap: 1 }}>
                <span style={{ fontWeight: 500 }}>{option.label}</span>
                {option.sub ? <span className="tiny muted">{option.sub}</span> : null}
              </span>
            </button>
          ))}
        </div>
      );

    case 'number':
      return (
        <div className="col" style={{ gap: 14, paddingBlock: 10 }}>
          <Ruler
            value={Number(value) || step.initial}
            min={step.min}
            max={step.max}
            step={step.step ?? 1}
            unit={step.unit}
            labelEvery={step.labelEvery ?? 10}
            secondary={step.secondary === 'height' ? HEIGHT_SCALE : step.secondary === 'weight' ? WEIGHT_SCALE : undefined}
            onChange={(next) => onSet(String(next))}
          />
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            {step.secondary
              ? 'Потяните ленту или нажмите на число. Снизу — та же величина в дюймах и фунтах.'
              : 'Потяните шкалу или нажмите на число, чтобы ввести вручную.'}
          </p>
        </div>
      );

    case 'time':
      return (
        <div className="col" style={{ gap: 10, alignItems: 'center', paddingBlock: 12 }}>
          <input
            id={`q-${step.id}`}
            type="time"
            value={typeof value === 'string' ? value : step.initial}
            onChange={(event) => onSet(event.target.value)}
            aria-label={step.question}
            style={{ maxWidth: 200, textAlign: 'center', fontSize: 26, fontWeight: 700, fontFamily: 'var(--display)' }}
          />
          <p className="tiny muted">Примерно — точность до получаса достаточна.</p>
        </div>
      );

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

