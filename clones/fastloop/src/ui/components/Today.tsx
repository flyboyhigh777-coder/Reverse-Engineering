import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { dailyBrief, dailyProgress, dailyTasks, taskRatio } from '../../domain/daily';
import type { DailyTask, TaskId } from '../../domain/daily';
import { useAppState } from '../../state/store';
import { ArticleSheet, EvidenceTag } from './ArticleSheet';
import { ArtTile } from './FoodArt';
import { Card, DropIcon, ScaleIcon, StepIcon, TimerIcon } from './common';

function TaskIcon({ task }: { task: DailyTask }): JSX.Element {
  if (task.tone === 'water') return <DropIcon />;
  if (task.tone === 'steps') return <StepIcon />;
  if (task.tone === 'weight') return <ScaleIcon />;
  if (task.tone === 'rate') return <HeartIcon />;
  return <TimerIcon />;
}

function HeartIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8.3 3.9 3.9 0 0 1 19 10.8c0 4.8-7 9.2-7 9.2z" />
    </svg>
  );
}

function Tick(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4.5 4.5L19 7" />
    </svg>
  );
}

function formatValue(task: DailyTask): string {
  if (task.note) return task.note;
  if (task.target === 1 && task.unit === '') return task.done ? 'сделано' : 'не отмечено';
  const current = task.current.toLocaleString('ru-RU');
  const target = task.target.toLocaleString('ru-RU');
  return `${current} / ${target}${task.unit ? ` ${task.unit}` : ''}`;
}

/**
 * Today's checklist.
 *
 * Four or five lines, each one a record the person can actually make right
 * now. Tapping a line opens the same control that line is about, so the card
 * is a shortcut bar as much as a list.
 */
export function TodayCard({
  onPick,
  controls,
}: {
  onPick: (id: TaskId) => void;
  /** Per-task actions rendered inside the tile — the tile is the only place
   *  these live, so the home screen does not repeat water and steps twice. */
  controls?: Partial<Record<TaskId, ReactNode>>;
}): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const tasks = useMemo(() => dailyTasks(state, now), [state, now]);
  const { done, total } = dailyProgress(tasks);

  return (
    <Card>
      <div className="row between">
        <span className="eyebrow">Задание на сегодня</span>
        <span className={done === total ? 'pill accent num' : 'pill num'}>
          {done}/{total}
        </span>
      </div>

      <div className="progressbar">
        <div style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
      </div>

      <div className="grid2">
        {tasks.map((task) => (
          <div key={task.id} className={task.done ? 'task done' : 'task'}>
            <button type="button" className="task-main" title={task.hint} onClick={() => onPick(task.id)}>
              <span className="row between">
                <span className="row" style={{ gap: 6, color: 'var(--ink-2)' }}>
                  <TaskIcon task={task} />
                  <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>{task.title}</strong>
                </span>
                <span className="tick">{task.done ? <Tick /> : null}</span>
              </span>
              <span className="tiny num muted">{formatValue(task)}</span>
              {task.target > 1 ? (
                <span className="progressbar">
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${taskRatio(task) * 100}%`,
                      background: 'var(--accent)',
                      borderRadius: 999,
                    }}
                  />
                </span>
              ) : null}
            </button>
            {controls?.[task.id] ?? null}
          </div>
        ))}
      </div>

      <p className="tiny muted">
        {done === total
          ? 'Всё на сегодня закрыто. Серия считается по завершённым голоданиям, а не по этому списку.'
          : 'Список считается из ваших записей и обнуляется в полночь.'}
      </p>
    </Card>
  );
}

/**
 * One short note and one article, chosen by the date.
 *
 * It is deliberately not a feed from the internet: the app has no network
 * access and no editor, so a "daily from the web" card would either lie or
 * break offline. The deck is the library, cut to a size that fits a morning.
 */
export function DailyBriefCard(): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const brief = useMemo(() => dailyBrief(Date.now(), state.premium), [state.premium]);

  return (
    <>
      <Card>
        <div className="row between">
          <span className="eyebrow">Сегодня о голодании</span>
          <span className="pill">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
        </div>
        <p className="tiny">{brief.note.text}</p>
        <span className="tiny muted">{brief.note.source}</span>

        <hr className="divider" />

        <button type="button" className="row" style={{ gap: 10, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }} onClick={() => setOpen(true)}>
          <span style={{ width: 64, flex: 'none', borderRadius: 10, overflow: 'hidden' }}>
            <ArtTile kind="clock" label={brief.article.title} />
          </span>
          <span className="col grow" style={{ gap: 3 }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 15 }}>{brief.article.title}</strong>
            <span className="tiny muted">{brief.article.lede}</span>
            <span className="row wrap" style={{ gap: 6 }}>
              <EvidenceTag level={brief.article.evidence} />
              <span className="pill">{brief.article.minutes} мин</span>
            </span>
          </span>
        </button>
      </Card>

      {open ? <ArticleSheet article={brief.article} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
