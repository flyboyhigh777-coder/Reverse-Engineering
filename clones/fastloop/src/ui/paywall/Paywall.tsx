import { useEffect, useState } from 'react';
import { projectGoal } from '../../domain/metrics';
import { actions, useAppState } from '../../state/store';
import { Card } from '../components/common';

interface Tier {
  readonly id: string;
  readonly title: string;
  readonly price: number;
  readonly weeks: number;
  readonly badge?: string;
}

const TIERS: readonly Tier[] = [
  { id: 'week', title: '1 неделя', price: 399, weeks: 1 },
  { id: 'month', title: '1 месяц', price: 999, weeks: 4.345 },
  { id: 'year', title: '12 месяцев', price: 2790, weeks: 52.14, badge: 'выгоднее всего' },
];

const PERKS: readonly string[] = [
  'Полный разбор тренера: какая длина окна подходит вам по собственным оценкам',
  'Все схемы, включая 18:6, 20:4, OMAD и своё окно с точностью до получаса',
  'Расписание по дням недели — короткая схема на выходные вместо срыва',
  'Свободная правка времени старта и финиша',
  'Полная история голоданий и экспорт всех записей в CSV',
  'Подробный разбор фаз и статьи о тренировках, кето и плато',
];

const OFFER_SECONDS = 600;
const CLOSE_DELAY_MS = 5000;

export function Paywall(): JSX.Element {
  const state = useAppState();
  const [selected, setSelected] = useState('year');
  const [left, setLeft] = useState(OFFER_SECONDS);
  const [canClose, setCanClose] = useState(false);
  const [restored, setRestored] = useState(false);

  // With PRO already on this screen is only a walkthrough of the funnel, so
  // the hold-back timer and the delayed close are not applied.
  const alreadyPro = state.premium;

  useEffect(() => {
    if (alreadyPro) {
      setCanClose(true);
      return;
    }
    const tick = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    const close = window.setTimeout(() => setCanClose(true), CLOSE_DELAY_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(close);
    };
  }, [alreadyPro]);

  const projection = projectGoal(state.profile.startKg, state.profile.goalKg, state.planId, state.profile.activity, Date.now());
  const name = state.profile.name.trim();
  const minutes = Math.floor(left / 60);
  const seconds = String(left % 60).padStart(2, '0');

  return (
    <div className="shell">
      <div className="screen">
        <div className="row between" style={{ minHeight: 30 }}>
          {alreadyPro ? (
            <span className="pill accent">PRO уже открыт в этой сборке</span>
          ) : (
            <span className="pill warm num">предложение истекает через {minutes}:{seconds}</span>
          )}
          {canClose ? (
            <button type="button" className="closebtn" aria-label="Закрыть" onClick={() => actions.setStage('app')}>
              ×
            </button>
          ) : null}
        </div>

        <h1 style={{ fontSize: 26 }}>
          {name ? `${name}, план сохранён` : 'План сохранён'}
        </h1>
        {projection ? (
          <p className="muted" style={{ maxWidth: '65ch' }}>
            Цель — минус {projection.totalKg.toFixed(1)} кг примерно к{' '}
            {projection.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}. Чтобы менять схему и время под свой
            день, нужен PRO.
          </p>
        ) : (
          <p className="muted">Чтобы менять схему и время под свой день, нужен PRO.</p>
        )}

        <Card>
          <ul className="col" style={{ gap: 9, listStyle: 'none', padding: 0, margin: 0 }}>
            {PERKS.map((perk) => (
              <li key={perk} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2 }} aria-hidden="true">
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
                <span className="tiny">{perk}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="col" style={{ gap: 12, marginTop: 4 }}>
          {TIERS.map((tier) => {
            const perWeek = tier.price / tier.weeks;
            return (
              <button
                key={tier.id}
                type="button"
                className="offer"
                aria-pressed={selected === tier.id}
                onClick={() => setSelected(tier.id)}
              >
                {tier.badge ? <span className="badge">{tier.badge}</span> : null}
                <span className="col grow" style={{ gap: 1 }}>
                  <span style={{ fontWeight: 600 }}>{tier.title}</span>
                  <span className="tiny muted num">{Math.round(perWeek)} ₽ в неделю</span>
                </span>
                <span className="num" style={{ fontFamily: 'var(--display)', fontSize: 19, fontWeight: 700 }}>
                  {tier.price.toLocaleString('ru-RU')} ₽
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn block"
          onClick={() => (alreadyPro ? actions.setStage('app') : actions.unlockPremium())}
        >
          {alreadyPro ? 'Продолжить' : 'Оформить PRO'}
        </button>

        <p className="tiny muted" style={{ textAlign: 'center' }}>
          {alreadyPro
            ? 'Экран оставлен как часть разбора воронки. Все функции уже открыты, платить ничего не нужно; вернуться к бесплатному режиму можно в профиле.'
            : 'Демонстрация: оплата не проводится, платёжные данные не запрашиваются и никуда не отправляются. Кнопка просто включает PRO-режим в этой копии приложения.'}
        </p>

        <div className="row" style={{ justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn quiet tiny" onClick={() => setRestored(true)}>
            Восстановить покупки
          </button>
          {canClose ? (
            <button type="button" className="btn quiet tiny" onClick={() => actions.setStage('app')}>
              Продолжить без подписки
            </button>
          ) : null}
        </div>
        {restored ? <p className="tiny muted" style={{ textAlign: 'center' }}>Покупок не найдено — это демо без магазина.</p> : null}
      </div>
    </div>
  );
}
