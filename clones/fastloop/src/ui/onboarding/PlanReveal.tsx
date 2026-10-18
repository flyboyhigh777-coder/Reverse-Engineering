import { planById } from '../../domain/plans';
import { projectGoal, projectionSeries, formatWeight } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { WeightChart } from '../components/WeightChart';
import { Card } from '../components/common';

export function PlanReveal(): JSX.Element {
  const state = useAppState();
  const { profile, planId } = state;
  const now = Date.now();
  const plan = planById(planId);
  const projection = projectGoal(profile.startKg, profile.goalKg, planId, profile.activity, now);
  const greeting = profile.name ? `${profile.name}, ваш план готов` : 'Ваш план готов';

  const series =
    projection && profile.startKg && profile.goalKg
      ? projectionSeries(profile.startKg, profile.goalKg, projection.weeklyKg, now)
      : [];

  const eventDate = profile.eventDate ? new Date(`${profile.eventDate}T12:00:00`) : null;
  const eventOk = eventDate && projection ? eventDate.getTime() >= projection.date.getTime() : null;

  return (
    <div className="shell">
      <div className="screen">
        <span className="eyebrow">Персональная схема</span>
        <h1 style={{ fontSize: 27 }}>{greeting}</h1>

        <Card className="raised">
          <div className="row between">
            <div className="col" style={{ gap: 2 }}>
              <span className="eyebrow">Начинаем с</span>
              <span style={{ fontFamily: 'var(--display)', fontSize: 32, fontWeight: 800 }}>{plan.title}</span>
            </div>
            <span className="pill accent">{plan.level}</span>
          </div>
          <p className="tiny muted">
            {plan.fastHours} часов без еды, {plan.eatHours} часов окно питания. {plan.blurb}
          </p>
        </Card>

        {projection && profile.startKg && profile.goalKg ? (
          <Card>
            <div className="row between">
              <span className="eyebrow">Оценка при этой схеме</span>
              <span className="pill warm">≈ {projection.weeklyKg.toFixed(2)} кг/нед</span>
            </div>
            <WeightChart points={series} goalKg={profile.goalKg} units={profile.units} dashed />
            <p className="tiny muted">
              Если держать схему, {formatWeight(profile.goalKg, profile.units)} выходит примерно к{' '}
              <strong>{projection.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> — это{' '}
              {projection.weeks} нед. Расчёт по длине окна и уровню активности, а не измерение: реальный темп зависит от того, что
              и сколько вы едите внутри окна.
            </p>
          </Card>
        ) : null}

        {eventDate && profile.event && profile.event !== 'none' ? (
          <Card>
            <span className="eyebrow">Ваша дата</span>
            <p className="tiny">
              {eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} —{' '}
              {eventOk
                ? 'по оценке вы успеваете дойти до цели к этому дню.'
                : 'по оценке к этому дню вы пройдёте часть пути; цель реалистичнее сдвинуть или выбрать более короткое окно.'}
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
