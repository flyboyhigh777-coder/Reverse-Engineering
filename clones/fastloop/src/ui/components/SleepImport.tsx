import { useState } from 'react';
import { actions, useAppState } from '../../state/store';
import { askHealthPermission, healthStatus, mergeNights, readWatchSleep } from '../../state/health';
import type { HealthStatus } from '../../state/health';

const DAY = 86_400_000;
/** Far enough back to fill a new phone, short enough to stay one request. */
const WINDOW_DAYS = 30;

/** "1 ночь", "2 ночи", "5 ночей" — the count is read, so it has to agree. */
function nights(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return `${count} ночей`;
  if (ones === 1) return `${count} ночь`;
  if (ones >= 2 && ones <= 4) return `${count} ночи`;
  return `${count} ночей`;
}

/**
 * Importing what the watch already recorded.
 *
 * There is nothing to pair here. The watch writes to its own companion app,
 * that app writes to Health Connect if its owner let it, and this reads what
 * is there. So every outcome worth distinguishing is about which of those
 * links is missing — and each gets its own sentence and its own next step,
 * rather than one button that sometimes does nothing.
 */
export function SleepImport(): JSX.Element | null {
  const state = useAppState();
  const [status, setStatus] = useState<HealthStatus>(() => healthStatus());
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // No host, or a build without it: nothing is offered rather than offered
  // and broken.
  if (status === 'absent') return null;

  const recheck = () => setStatus(healthStatus());

  const run = async () => {
    setBusy(true);
    setFailed(false);
    setSaid(null);
    try {
      const now = Date.now();
      const found = await readWatchSleep(now - WINDOW_DAYS * DAY, now);
      const merge = mergeNights(found, state.sleep);
      for (const entry of [...merge.added, ...merge.updated]) actions.logSleep(entry);

      if (found.length === 0) {
        setSaid(
          'Health Connect открылся, но ночей в нём нет. Значит часы туда пока ничего не писали — проверьте в приложении часов, включена ли передача в Health Connect.',
        );
      } else {
        const changed = merge.added.length + merge.updated.length;
        const parts = [`В Health Connect ${nights(found.length)}.`];
        parts.push(changed === 0 ? 'Нового ничего нет.' : `Записано: ${changed}.`);
        if (merge.keptManual > 0) {
          parts.push(`${nights(merge.keptManual)} вы занесли руками — оставил как есть.`);
        }
        if (merge.sources.length > 0) parts.push(`Источник: ${merge.sources.join(', ')}.`);
        setSaid(parts.join(' '));
      }
      setStatus(healthStatus());
    } catch (failure) {
      setFailed(true);
      setSaid(failure instanceof Error ? failure.message : 'Не получилось прочитать.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <hr className="divider" />
      <span className="eyebrow">Часы</span>

      {status === 'unavailable' ? (
        <p className="banner tiny">
          На этом телефоне нет Health Connect. На Android 14 и новее он встроен, на более старых ставится из Google
          Play. Без него часы передать сон не могут.
        </p>
      ) : null}

      {status === 'needs_update' ? (
        <p className="banner tiny">Health Connect на телефоне слишком старый — обновите его в Google Play.</p>
      ) : null}

      {status === 'no_permission' ? (
        <>
          <p className="tiny muted">
            Сон лежит в Health Connect — туда его пишет приложение ваших часов. Читать его приложение не может, пока
            вы не разрешите; разрешение даётся на экране самого Health Connect, не здесь.
          </p>
          <button type="button" className="btn block" onClick={() => askHealthPermission()}>
            Разрешить чтение сна
          </button>
          {/* The answer is given to Health Connect, not to us, so there is
              nothing to wait for — only to ask again afterwards. */}
          <button type="button" className="btn ghost sm" onClick={recheck}>
            Разрешил — проверить
          </button>
        </>
      ) : null}

      {status === 'ready' ? (
        <>
          <button type="button" className="btn block" disabled={busy} onClick={() => void run()}>
            {busy ? 'Читаю Health Connect…' : `Импортировать сон за ${WINDOW_DAYS} дней`}
          </button>
          <p className="tiny muted">
            Фазы берутся как есть: если часы их не измеряли, останется только время засыпания и подъёма. Оценку
            самочувствия не трогаю — её не измеряет ни одна модель часов.
          </p>
        </>
      ) : null}

      {said ? (
        <p className="banner tiny" style={failed ? { color: 'var(--warn)' } : undefined}>
          {said}
        </p>
      ) : null}
    </div>
  );
}
