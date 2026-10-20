import { useState } from 'react';
import { ARTICLES, CATEGORIES, EVIDENCE_LABEL } from '../../domain/articles';
import type { Article } from '../../domain/articles';
import { DISCLAIMER } from '../../domain/phases';
import { useAppState } from '../../state/store';
import { ArticleSheet, EvidenceTag } from '../components/ArticleSheet';
import { BeginnerCard } from '../components/BeginnerGuide';
import { ArtTile } from '../components/FoodArt';
import type { ArtKind } from '../components/FoodArt';
import { Card, LockPill } from '../components/common';

/** Art for the featured strip — one per category, so it stays recognisable. */
const CATEGORY_ART: Record<string, ArtKind> = {
  'Основы': 'sunrise',
  'Практика': 'clock',
  'Питание': 'bowl',
  'Движение': 'protein',
  'Сон': 'return',
  'Кето': 'avocado',
  'Осторожно': 'berry',
};

const FEATURED = ['water-practice', 'breaking', 'protein', 'start-training', 'red-flags'];

export function Learn({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState<Article | null>(null);
  const [filter, setFilter] = useState<string>('Все');

  const shownCategories = filter === 'Все' ? CATEGORIES : CATEGORIES.filter((c) => c === filter);

  return (
    <>
      <h1 style={{ fontSize: 21 }}>Статьи</h1>
      <p className="tiny muted">
        У каждой статьи стоит метка того, насколько надёжны данные под ней — включая «спорно» на материалах про саму эту тему.
      </p>

      <BeginnerCard />

      <div className="col" style={{ gap: 10 }}>
        <div className="section-head">
          <h2>Стоит прочитать</h2>
        </div>
        <div className="carousel">
          {FEATURED.map((id) => {
            const article = ARTICLES.find((item) => item.id === id);
            if (!article) return null;
            const locked = article.premium && !state.premium;
            return (
              <button
                key={id}
                type="button"
                className="tile"
                onClick={() => (locked ? onRequestPro('Эта статья входит в PRO.') : setOpen(article))}
              >
                <span className="art">
                  <ArtTile kind={CATEGORY_ART[article.category] ?? 'bowl'} label={article.title} />
                  {locked ? <span className="badge-pro">PRO</span> : null}
                </span>
                <span className="tile-title">{article.title}</span>
                <span className="tiny muted">{article.minutes} мин · {EVIDENCE_LABEL[article.evidence]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="carousel chiprow">
        {['Все', ...CATEGORIES].map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={filter === name} onClick={() => setFilter(name)}>
            {name}
          </button>
        ))}
      </div>

      {shownCategories.map((category) => {
        const items = ARTICLES.filter((article) => article.category === category);
        if (items.length === 0) return null;
        return (
          <div className="col" key={category} style={{ gap: 10 }}>
            <span className="eyebrow">{category}</span>
            {items.map((article) => {
              const locked = article.premium && !state.premium;
              return (
                <button
                  key={article.id}
                  type="button"
                  className="lockbtn"
                  onClick={() => (locked ? onRequestPro('Эта статья входит в PRO.') : setOpen(article))}
                >
                  <Card>
                    <div className="row between" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <span className="col grow" style={{ gap: 4 }}>
                        <strong style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{article.title}</strong>
                        <span className="tiny muted">{article.lede}</span>
                        <span className="row wrap" style={{ gap: 6 }}>
                          <EvidenceTag level={article.evidence} />
                          <span className="pill">{article.minutes} мин</span>
                        </span>
                      </span>
                      {locked ? <LockPill /> : null}
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        );
      })}

      <p className="banner">{DISCLAIMER}</p>

      {open ? <ArticleSheet article={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
