import { EVIDENCE_LABEL } from '../../domain/articles';
import type { Article, Evidence } from '../../domain/articles';
import { Sheet } from './common';

const EVIDENCE_COLOR: Record<Evidence, string> = {
  established: 'var(--good)',
  likely: 'var(--accent)',
  contested: 'var(--warn)',
  weak: 'var(--ink-3)',
};

export function EvidenceTag({ level }: { level: Evidence }): JSX.Element {
  return (
    <span className="pill" style={{ color: EVIDENCE_COLOR[level] }}>
      {EVIDENCE_LABEL[level]}
    </span>
  );
}

/** The reader. Shared so an article opens identically wherever it is tapped. */
export function ArticleSheet({ article, onClose }: { article: Article; onClose: () => void }): JSX.Element {
  return (
    <Sheet title={article.title} onClose={onClose}>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="pill">{article.category}</span>
        <EvidenceTag level={article.evidence} />
        <span className="pill">{article.minutes} мин</span>
      </div>
      <div className="article-body tiny">
        {article.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </Sheet>
  );
}
