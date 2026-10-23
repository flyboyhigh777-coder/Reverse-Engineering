import { useState } from 'react';
import type { VisionProvider } from '../../domain/vision';

/**
 * The two halves of asking somebody for their own API key.
 *
 * Both the camera sheet and the profile ask for the same key in the same way,
 * and the first version of this screen failed the same way in both places: a
 * password field with `AIza…` in it and a button that went dim without saying
 * why. Someone who has never made an API key reads that as a broken camera.
 */

/** What to do, as steps, with the page itself one tap away. */
export function KeyHowTo({ provider }: { provider: VisionProvider }): JSX.Element {
  return (
    <>
      <p className="banner tiny">
        <strong>{provider.cost}</strong>
      </p>
      <ol className="steps tiny" style={{ gap: 9 }}>
        {provider.steps.map((step) => (
          <li key={step}>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {/* A plain link: the host sends http(s) to the real browser, because
          Google refuses to sign anyone in inside a WebView. */}
      <a className="btn go block" href={provider.url} target="_blank" rel="noreferrer noopener">
        Открыть {hostOf(provider.url)} ↗
      </a>
    </>
  );
}

/** The field itself, readable: a pasted key is worth checking before sending. */
export function KeyField({
  provider,
  id,
  value,
  onChange,
}: {
  provider: VisionProvider;
  id: string;
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const [shown, setShown] = useState(false);
  return (
    <div className="keyfield">
      <input
        id={id}
        // Not `password`: this is pasted once, on the owner's own phone, and
        // hiding it only makes a mis-paste impossible to spot.
        type={shown ? 'text' : 'password'}
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={`Вставьте ключ ${provider.keyHint}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="btn ghost sm"
        aria-pressed={shown}
        aria-label={shown ? 'Скрыть ключ' : 'Показать ключ'}
        onClick={() => setShown((was) => !was)}
      >
        {shown ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  );
}

/** "https://aistudio.google.com/apikey" → "aistudio.google.com". */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
