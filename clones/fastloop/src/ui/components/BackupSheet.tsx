import { useMemo, useState } from 'react';
import { backupFileName, buildBackup, describeRecords, parseRestore } from '../../domain/backup';
import { actions, useAppState } from '../../state/store';
import { Sheet } from './common';

const BOX = {
  width: '100%',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  lineHeight: 1.45,
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  resize: 'vertical' as const,
};

/**
 * Copy out, paste back in.
 *
 * Uninstalling an Android app erases its storage, and this build has no
 * account to sync with, so the only way records survive a reinstall is if
 * the person can take them with them. Both directions live in one sheet so
 * that whoever opens it sees that the copy is worth making.
 */
export function BackupSheet({ onClose }: { onClose: () => void }): JSX.Element {
  const state = useAppState();
  const now = Date.now();
  const backup = useMemo(() => buildBackup(state, now), [state, now]);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backup);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  const restore = () => {
    const parsed = parseRestore(text);
    if (parsed.kind === 'error') {
      setResult(parsed.reason);
      return;
    }
    if (parsed.kind === 'backup') {
      actions.restoreBackup(parsed.state);
      onClose();
      return;
    }
    actions.mergeRecords(parsed.records);
    setResult(`Восстановлено из CSV — ${describeRecords(parsed.records)}. Ответы анкеты в CSV не попадают: профиль придётся заполнить заново.`);
    setText('');
  };

  return (
    <Sheet title="Резервная копия" onClose={onClose}>
      <span className="eyebrow">Сохранить</span>
      <p className="tiny muted">
        Сюда попадает всё: голодания, вес, вода, шаги, ответы анкеты и настройки. Скопируйте текст и сохраните его
        в заметках или отправьте себе — переустановка приложения стирает данные без следа.
      </p>
      <textarea
        id="backup-out"
        readOnly
        value={backup}
        rows={5}
        onFocus={(event) => event.currentTarget.select()}
        style={BOX}
      />
      <button type="button" className="btn block" onClick={copy}>
        {copied === 'ok' ? 'Скопировано' : `Скопировать ${backupFileName(now)}`}
      </button>
      {copied === 'fail' ? (
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Браузер не дал доступ к буферу. Выделите текст выше и скопируйте вручную.
        </p>
      ) : null}

      <hr className="divider" />

      <span className="eyebrow">Восстановить</span>
      <p className="tiny muted">
        Вставьте копию целиком. Подойдёт и старый экспорт в CSV — из него вернутся голодания, вес, вода и шаги,
        но не ответы анкеты.
      </p>
      <textarea
        id="backup-in"
        value={text}
        rows={4}
        placeholder="Вставьте сюда текст копии или CSV"
        onChange={(event) => {
          setText(event.target.value);
          setResult(null);
        }}
        style={BOX}
      />
      <button type="button" className="btn ghost block" disabled={text.trim() === ''} onClick={restore}>
        Восстановить
      </button>
      {result ? <p className="banner tiny">{result}</p> : null}
    </Sheet>
  );
}
