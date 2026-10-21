import { useEffect, useMemo, useState } from 'react';
import { SECTIONS, visibleSteps } from '../../domain/quiz';
import type { QuizStep } from '../../domain/quiz';
import { insightFor } from '../../domain/quizInsight';
import { actions, useAppState } from '../../state/store';
import { BackupSheet } from '../components/BackupSheet';
import { HEIGHT_SCALE, Ruler, WEIGHT_SCALE } from '../components/Ruler';

const DAY_MS = 86_400_000;

/**
 * A hue and a glyph per section.
 *
 * Fifty questions in one colour read as a form to be endured. Giving each
 * part of the interview its own colour turns a counter into a journey, and
 * tells you at a glance that the subject has changed. The soft fills are
 * mixed against the current surface, so one declaration serves both themes.
 */
const SECTION_HUE: Readonly<Record<string, string>> = {
  'Цель': '#12a398',
  'О себе': '#4a90d9',
  'Здоровье': '#e0645e',
  'Сон и ритм': '#8572e8',
  'Еда': '#e39430',
  'Движение': '#35b06a',
  'Настрой': '#d4679a',
  'План': '#14a08f',
};

function SectionGlyph({ section }: { section: string }): JSX.Element {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (section) {
    case 'Цель':
      return <svg {...props}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'О себе':
      return <svg {...props}><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" /></svg>;
    case 'Здоровье':
      return <svg {...props}><path d="M12 20s-7-4.3-7-9A3.9 3.9 0 0 1 12 8.4 3.9 3.9 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>;
    case 'Сон и ритм':
      return <svg {...props}><path d="M19 13.5A7.5 7.5 0 0 1 10.5 5a7.5 7.5 0 1 0 8.5 8.5z" /></svg>;
    case 'Еда':
      return <svg {...props}><path d="M7 3v8M10 3v8M8.5 11v10M16 3c-1.5 2-2 4-2 6s.7 2.5 2 2.5V21" /></svg>;
    case 'Движение':
      return <svg {...props}><circle cx="13" cy="4.5" r="1.8" /><path d="M9 21l2.5-5 3-2-1-5-3.5 2-2 3M14.5 11l3 1.5 1.5 4" /></svg>;
    case 'Настрой':
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M9 14.5c1.8 1.6 4.2 1.6 6 0M9.5 10h.01M14.5 10h.01" /></svg>;
    default:
      return <svg {...props}><path d="M5 13l4.5 4.5L19 7" /></svg>;
  }
}

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
  const hue = SECTION_HUE[step.section] ?? 'var(--accent)';
  const insight = insightFor(step.id, state.answers);

  // How far each section is filled, for the segmented bar.
  const fill = SECTIONS.map((name) => {
    const inSection = steps.filter((item) => item.section === name);
    if (inSection.length === 0) return 0;
    const seen = inSection.filter((item) => steps.indexOf(item) <= position).length;
    return seen / inSection.length;
  });

  return (
    <div
      className="shell quiz-shell"
      style={
        {
          '--sec': hue,
          '--sec-tint': `color-mix(in oklab, ${hue} 12%, var(--surface))`,
          '--sec-glow': `color-mix(in oklab, ${hue} 38%, transparent)`,
        } as React.CSSProperties
      }
    >
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
          <span className="sectionchip">
            <span className="dot"><SectionGlyph section={step.section} /></span>
            {step.section}
          </span>
          <span className="tiny muted num">
            {position + 1}/{steps.length}
          </span>
        </div>

        <div className="col" style={{ gap: 5, flex: 'none' }}>
          <div className="segments" aria-hidden="true">
            {fill.map((ratio, index) => (
              <span key={SECTIONS[index]}>
                <i style={{ width: `${ratio * 100}%` }} />
              </span>
            ))}
          </div>
          <span className="tiny muted">
            Раздел {sectionIndex + 1} из {SECTIONS.length}
          </span>
        </div>

        <div className="col" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Sits near the top so questions do not wander up and down the
              screen as the number of options changes from step to step. */}
          <div className="col" style={{ gap: 15, marginTop: 14, marginBottom: 'auto' }}>
            {step.kind === 'info' ? (
              <InfoStep step={step} hue={hue} />
            ) : (
              <>
                <h1 style={{ fontSize: 27, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{step.question}</h1>
                {'hint' in step && step.hint ? <p className="muted" style={{ fontSize: 14 }}>{step.hint}</p> : null}
                <StepBody step={step} value={value} onChoose={chooseAndAdvance} onSet={set} onToggle={toggle} />
                {insight ? (
                  <div className="insight">
                    <span aria-hidden="true" style={{ color: hue, fontSize: 17, lineHeight: 1.2 }}>◆</span>
                    <span className="col" style={{ gap: 2 }}>
                      <b>{insight.headline}</b>
                      <span className="tiny muted">{insight.detail}</span>
                    </span>
                  </div>
                ) : null}
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

function InfoStep({ step, hue }: { step: Extract<QuizStep, { kind: 'info' }>; hue: string }): JSX.Element {
  return (
    <div
      className="quiz-hero"
      style={{ background: `linear-gradient(145deg, ${hue}, color-mix(in oklab, ${hue} 55%, #0b2a28))` }}
    >
      <span className="glow" aria-hidden="true" />
      {step.stat ? (
        <>
          <div className="stat">{step.stat}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>{step.statLabel}</div>
        </>
      ) : null}
      <h1>{step.title}</h1>
      <p>{step.body}</p>
    </div>
  );
}

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

function TickGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4.5 4.5L19 7" />
    </svg>
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
          {step.options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className="optcard"
              aria-pressed={value === option.value}
              onClick={() => onChoose(option.value)}
            >
              <span className="bullet">{LETTERS[index] ?? index + 1}</span>
              <span className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{option.label}</span>
                {option.sub ? <span className="tiny muted">{option.sub}</span> : null}
              </span>
            </button>
          ))}
        </div>
      );

    case 'multi':
      return (
        <div className="col" style={{ gap: 9 }}>
          {step.options.map((option) => {
            const picked = Array.isArray(value) && value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="optcard"
                aria-pressed={picked}
                onClick={() => onToggle(option.value)}
              >
                <span className="bullet">{picked ? <TickGlyph /> : null}</span>
                <span className="col" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{option.label}</span>
                  {option.sub ? <span className="tiny muted">{option.sub}</span> : null}
                </span>
              </button>
            );
          })}
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
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="optcard"
                aria-pressed={current === n}
                style={{ flex: 1, minHeight: 64, justifyContent: 'center', padding: 0 }}
                onClick={() => onSet(String(n))}
              >
                <span style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 800 }}>{n}</span>
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

