import { useState } from 'react';
import { ARTICLES } from '../../domain/articles';
import type { Article } from '../../domain/articles';
import { DISCLAIMER } from '../../domain/phases';
import { useAppState } from '../../state/store';
import { Card, LockPill, Sheet } from '../components/common';

export function Learn({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState<Article | null>(null);
  const categories = ['Основы', 'Практика', 'Осторожно'] as const;

  return (
    <>
      <h1 style={{ fontSize: 21 }}>Статьи</h1>

      {categories.map((category) => {
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
                    <div className="row between" style={{ gap: 10 }}>
                      <span className="col grow" style={{ gap: 3 }}>
                        <strong style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{article.title}</strong>
                        <span className="tiny muted">{article.lede}</span>
                      </span>
                      {locked ? <LockPill /> : <span className="pill">{article.minutes} мин</span>}
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
          <span className="eyebrow">
            {open.category} · {open.minutes} мин
          </span>
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
