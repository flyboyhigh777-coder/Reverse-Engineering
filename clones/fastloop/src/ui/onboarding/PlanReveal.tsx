import { formatWeight, projectGoal, projectionSeries } from '../../domain/metrics';
import { resolvePlan } from '../../domain/plans';
import { describeWindow } from '../../domain/recommendation';
import { STOP_SIGNS } from '../../domain/screening';
import { actions, useAppState } from '../../state/store';
import { WeightChart } from '../components/WeightChart';
import { Card } from '../components/common';

export function PlanReveal(): JSX.Element {
  const state = useAppState();
  const { profile, person, screening, recommendation } = state;
  const now = Date.now();
  const greeting = profile.name ? `${profile.name}, ` : '';

  if (screening?.blocked) return <Blocked />;

  const plan = recommendation ? resolvePlan(recommendation.planId, recommendation.target.fastHours) : null;
  const projection = projectGoal(profile.startKg, profile.goalKg, state.planId, profile.activity, now);
  const series =
    projection && profile.startKg && profile.goalKg
      ? projectionSeries(profile.startKg, profile.goalKg, projection.weeklyKg, now)
      : [];

  return (
    <div className="shell">
      <div className="screen">
        <span className="eyebrow">Разбор ваших ответов</span>
        <h1 style={{ fontSize: 27 }}>{greeting}вот что получилось</h1>

        {projection && profile.startKg && profile.goalKg ? (
          <div className="goalcard">
            <div className="pair">
              <span className="col" style={{ gap: 2 }}>
                <span className="wcap">сейчас</span>
                <span className="wnum">{formatWeight(profile.startKg, profile.units)}</span>
              </span>
              <span className="arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h15M13.5 6.5 20 12l-6.5 5.5" />
                </svg>
              </span>
              <span className="col" style={{ gap: 2, textAlign: 'right' }}>
                <span className="wcap">цель</span>
                <span className="wnum">{formatWeight(profile.goalKg, profile.units)}</span>
              </span>
            </div>
            <span className="meter" aria-hidden="true"><i style={{ width: '6%' }} /></span>
            <span className="tiny" style={{ opacity: 0.93 }}>
              Минус {projection.totalKg.toFixed(1)} кг за ≈ {projection.weeks} нед. — это арифметика по длине окна и
              активности, а не обещание.
            </span>
          </div>
        ) : null}

        {person ? (
          <Card className="raised">
            <span className="eyebrow">Ваш тип</span>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{person.typeName}</strong>
            <p className="tiny">{person.typeSummary}</p>
            {person.sleep.sleepMinutes !== null ? (
              <div className="grid3">
                <Mini value={`${Math.floor(person.sleep.sleepMinutes / 60)} ч ${person.sleep.sleepMinutes % 60} м`} label="сон в будни" />
                <Mini
                  value={person.sleep.socialJetlagMinutes !== null ? `+${Math.round(person.sleep.socialJetlagMinutes / 60)} ч` : '—'}
                  label="сдвиг в выходные"
                />
                <Mini value={person.currentFastHours !== null ? `${person.currentFastHours} ч` : '—'} label="пауза сейчас" />
              </div>
            ) : null}
          </Card>
        ) : null}

        {recommendation && plan ? (
          <Card className="raised">
            <div className="row between">
              <span className="eyebrow">Ваше окно</span>
              <span className="pill accent">{plan.title}</span>
            </div>
            <strong className="num" style={{ fontFamily: 'var(--display)', fontSize: 30 }}>
              {recommendation.manual ? `${recommendation.target.fastHours} ч паузы` : describeWindow(recommendation.target)}
            </strong>
            <p className="tiny muted">
              {recommendation.manual
                ? `Длину окна подобрали, а часы — за вами: при сменном графике их привязывают к смене. Для ориентира: ${describeWindow(recommendation.target)}.`
                : `Едите в эти часы, остальное время — вода, чай и кофе без добавок. Это ${recommendation.target.fastHours} ч паузы.`}
            </p>
            <ul className="col" style={{ gap: 7, listStyle: 'none', padding: 0, margin: 0 }}>
              {recommendation.rationale.map((line) => (
                <li key={line} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 700 }}>·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {recommendation && recommendation.ramp.length > 1 ? (
          <Card>
            <span className="eyebrow">Путь по неделям</span>
            <p className="tiny muted">Прибавляем постепенно: резкий старт — самая частая причина бросить.</p>
            <ol className="timeline">
              {recommendation.ramp.map((week, index) => (
                <li key={week.week} className={index === 0 ? 'on' : undefined}>
                  <span className="dot num" aria-hidden="true">{week.week}</span>
                  <span className="col grow" style={{ gap: 2 }}>
                    <span className="phase">{rampPhase(index, recommendation.ramp.length)}</span>
                    <span className="row wrap" style={{ gap: 7 }}>
                      <strong className="num">{week.plan.fastHours} ч</strong>
                      <span className="pill num">{describeWindow(week.plan)}</span>
                    </span>
                    <span className="tiny muted">{week.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        {person && person.levers.length > 0 ? (
          <Card>
            <span className="eyebrow">С чего начать помимо окна</span>
            <ul className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
              {person.levers.map((lever) => (
                <li key={lever} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                  <span>{lever}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {screening && screening.cautious ? (
          <Card>
            <div className="row between">
              <span className="eyebrow">Осторожно</span>
              <span className="pill warm">учтено в плане</span>
            </div>
            <p className="tiny muted">
              По вашим ответам окно ограничено {screening.maxFastHours} часами. Это не запрет, а разумный потолок.
            </p>
            {screening.findings.map((finding) => (
              <div className="col" key={finding.id} style={{ gap: 2 }}>
                <strong className="tiny">{finding.title}</strong>
                <span className="tiny muted">{finding.detail}</span>
              </div>
            ))}
          </Card>
        ) : null}

        {projection && profile.startKg && profile.goalKg ? (
          <Card>
            <div className="row between">
              <span className="eyebrow">Оценка темпа</span>
              <span className="pill warm">≈ {projection.weeklyKg.toFixed(2)} кг/нед</span>
            </div>
            <WeightChart points={series} goalKg={profile.goalKg} units={profile.units} dashed />
            <p className="tiny muted">
              {formatWeight(profile.goalKg, profile.units)} выходит примерно к{' '}
              <strong>{projection.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              Это расчёт по длине окна и активности, а не обещание: реальный темп решает то, что и сколько вы едите внутри окна.
            </p>
          </Card>
        ) : null}

        <button type="button" className="btn block" onClick={() => actions.setStage('paywall')}>
          Продолжить
        </button>
      </div>
    </div>
  );
}

/**
 * Names the stages of the ramp. The weeks already carry their own note; the
 * name is there so the list reads as a route with an end rather than a
 * schedule that keeps tightening.
 */
function rampPhase(index: number, total: number): string {
  if (index === 0) return 'Начало';
  if (index === total - 1) return 'Ваша схема';
  if (index === 1) return 'Адаптация';
  return 'Привыкание';
}

function Mini({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div className="col" style={{ gap: 1 }}>
      <strong className="num" style={{ fontFamily: 'var(--display)', fontSize: 16 }}>
        {value}
      </strong>
      <span className="tiny muted">{label}</span>
    </div>
  );
}

/** Screening said no. No plan, no paywall — tracking and reading only. */
function Blocked(): JSX.Element {
  const state = useAppState();
  const findings = state.screening?.findings.filter((f) => f.severity === 'stop') ?? [];

  return (
    <div className="shell">
      <div className="screen">
        <span className="eyebrow">Важно</span>
        <h1 style={{ fontSize: 26 }}>Схему голодания мы вам не предложим</h1>
        <p className="muted" style={{ maxWidth: '65ch' }}>
          По вашим ответам интервальное голодание сейчас не подходит. Это не осторожность ради галочки — в этих случаях оно
          либо небезопасно, либо меняет действие лекарств.
        </p>

        {findings.map((finding) => (
          <Card key={finding.id}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{finding.title}</strong>
            <p className="tiny muted">{finding.detail}</p>
          </Card>
        ))}

        <Card>
          <span className="eyebrow">Что приложение может дать вам сейчас</span>
          <p className="tiny">
            Дневник веса с графиком, вода, шаги и библиотека статей остаются. Таймер голодания убран с главного экрана —
            включить его можно будет в профиле, если врач скажет, что можно.
          </p>
        </Card>

        <Card>
          <span className="eyebrow">Когда прекратить любой эксперимент с едой</span>
          <ul className="col" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
            {STOP_SIGNS.map((sign) => (
              <li key={sign} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ color: 'var(--danger)', fontWeight: 700 }}>!</span>
                <span>{sign}</span>
              </li>
            ))}
          </ul>
        </Card>

        <button type="button" className="btn block" onClick={() => actions.setStage('app')}>
          Открыть режим наблюдения
        </button>
      </div>
    </div>
  );
}
