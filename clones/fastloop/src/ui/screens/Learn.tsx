import { useState } from 'react';
import { ARTICLES, CATEGORIES, EVIDENCE_LABEL } from '../../domain/articles';
import type { Article, Evidence } from '../../domain/articles';
import { DISCLAIMER } from '../../domain/phases';
import { useAppState } from '../../state/store';
import { Card, LockPill, Sheet } from '../components/common';

const EVIDENCE_COLOR: Record<Evidence, string> = {
  established: 'var(--good)',
  likely: 'var(--accent)',
  contested: 'var(--warn)',
  weak: 'var(--ink-3)',
};

function EvidenceTag({ level }: { level: Evidence }): JSX.Element {
  return (
    <span className="pill" style={{ color: EVIDENCE_COLOR[level] }}>
      {EVIDENCE_LABEL[level]}
    </span>
  );
}

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

      <div className="row wrap" style={{ gap: 7 }}>
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

      {open ? (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="pill">{open.category}</span>
            <EvidenceTag level={open.evidence} />
            <span className="pill">{open.minutes} мин</span>
          </div>
          <div className="article-body tiny">
            {open.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
