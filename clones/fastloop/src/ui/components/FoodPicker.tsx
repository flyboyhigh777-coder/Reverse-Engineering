import { useMemo, useRef, useState } from 'react';
import { FOODS, FOOD_TABLE_NOTE } from '../../domain/foods';
import type { Food } from '../../domain/foods';
import { searchLibrary } from '../../domain/foodSearch';
import { compositionFor, macrosOfKept } from '../../domain/ingredients';
import type { ResolvedItem } from '../../domain/ingredients';
import { SLOT_LABEL, MEAL_SLOTS, forGrams } from '../../domain/nutrition';
import { OFF_NOTE, lookupBarcode, searchOnline } from '../../domain/openFoodFacts';
import type { Macros, Recipe } from '../../domain/recipes';
import type { MealSlot } from '../../domain/types';
import { VISION_NOTE, checkKey, describeFood, recogniseFood } from '../../domain/vision';
import type { Guess } from '../../domain/vision';
import { useContent } from '../../state/content';
import { actions } from '../../state/store';
import { readVisionKey, writeVisionKey } from '../../state/visionKey';
import { ArtTile } from './FoodArt';
import { Sheet } from './common';

type Tab = 'search' | 'online' | 'ai' | 'manual';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'search', label: 'Поиск' },
  { id: 'online', label: 'В интернете' },
  { id: 'ai', label: 'ИИ' },
  { id: 'manual', label: 'Вручную' },
];

function TickGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4.5 4.5L19 7" />
    </svg>
  );
}

function MacroLine({ macros }: { macros: Macros }): JSX.Element {
  return (
    <span className="tiny num muted">
      {macros.kcal} ккал · Б {macros.protein} · Ж {macros.fat} · У {macros.carbs}
    </span>
  );
}

function SlotPicker({ slot, onChange }: { slot: MealSlot; onChange: (slot: MealSlot) => void }): JSX.Element {
  return (
    <div className="row wrap" style={{ gap: 7 }}>
      {MEAL_SLOTS.map((id) => (
        <button key={id} type="button" className="chip" aria-pressed={slot === id} onClick={() => onChange(id)}>
          {SLOT_LABEL[id]}
        </button>
      ))}
    </div>
  );
}

/** The whole add-food flow: find something, set the portion, write it down. */
export function FoodPicker({ slot, onClose }: { slot: MealSlot; onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<Tab>('search');
  const [chosen, setChosen] = useState<Food | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  /** Carried over when a search finds nothing and the person asks the model. */
  const [seed, setSeed] = useState('');

  if (chosen) {
    return <PortionSheet food={chosen} slot={slot} onBack={() => setChosen(null)} onDone={onClose} />;
  }
  if (recipe) {
    return <RecipeSheet recipe={recipe} slot={slot} onBack={() => setRecipe(null)} onDone={onClose} />;
  }

  return (
    <Sheet title={`Записать: ${SLOT_LABEL[slot].toLowerCase()}`} onClose={onClose}>
      <div className="carousel chiprow">
        {TABS.map((item) => (
          <button key={item.id} type="button" className="chip" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <SearchTab
          onPickFood={setChosen}
          onPickRecipe={setRecipe}
          onAskModel={(query) => {
            setSeed(query);
            setTab('ai');
          }}
        />
      ) : null}
      {tab === 'online' ? <OnlineTab onPick={setChosen} /> : null}
      {tab === 'ai' ? <AiTab slot={slot} seed={seed} onDone={onClose} /> : null}
      {tab === 'manual' ? <ManualTab slot={slot} onDone={onClose} /> : null}
    </Sheet>
  );
}

function SearchTab({
  onPickFood,
  onPickRecipe,
  onAskModel,
}: {
  onPickFood: (food: Food) => void;
  onPickRecipe: (recipe: Recipe) => void;
  onAskModel: (query: string) => void;
}): JSX.Element {
  const recipes = useContent().recipes;
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchLibrary(query, recipes), [query, recipes]);

  return (
    <>
      <input
        id="food-search"
        type="search"
        placeholder="Продукт или блюдо: творог, плов, шакшука"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {results.length === 0 ? (
        <>
          <p className="tiny muted">
            Ни в таблице продуктов, ни среди рецептов такого нет.
          </p>
          <button type="button" className="btn block" onClick={() => onAskModel(query)}>
            Описать словами и посчитать
          </button>
          <p className="tiny muted">
            Напишите блюдо и из чего оно — «шакшука: 2 яйца, помидоры, перец, ложка масла» — и ИИ посчитает порцию
            целиком. Либо занесите вручную на соседней вкладке.
          </p>
        </>
      ) : (
        <div className="col" style={{ gap: 7 }}>
          {results.map((hit) =>
            hit.kind === 'recipe' ? (
              <button key={`r-${hit.recipe.id}`} type="button" className="foodrow" onClick={() => onPickRecipe(hit.recipe)}>
                <span className="row" style={{ gap: 9 }}>
                  <span style={{ width: 38, flex: 'none', borderRadius: 9, overflow: 'hidden' }}>
                    <ArtTile kind={hit.recipe.art} height={38} rounded={9} label="" />
                  </span>
                  <span className="col" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 14 }}>{hit.recipe.title}</strong>
                    <MacroLine macros={hit.recipe.macros} />
                  </span>
                </span>
                <span className="pill accent">рецепт</span>
              </button>
            ) : (
              <button key={`f-${hit.food.id}`} type="button" className="foodrow" onClick={() => onPickFood(hit.food)}>
                <span className="col" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 14 }}>{hit.food.name}</strong>
                  <span className="tiny num muted">
                    {hit.food.per100g.kcal} ккал / 100 г · Б {hit.food.per100g.protein} · Ж {hit.food.per100g.fat} · У{' '}
                    {hit.food.per100g.carbs}
                  </span>
                </span>
                <span className="pill">{hit.food.group.split(',')[0]}</span>
              </button>
            ),
          )}
        </div>
      )}

      {results.length > 0 ? (
        <p className="tiny muted">
          {FOOD_TABLE_NOTE} В таблице {FOODS.length} позиций, рядом ищутся и рецепты приложения — у них значения на
          порцию.
        </p>
      ) : null}
    </>
  );
}

/**
 * Packaged goods from the open product database.
 *
 * Kept apart from the built-in table rather than mixed into it: one is a
 * reference table of dishes that does not change, the other is a network
 * call to crowd-sourced records that can be absent, wrong or offline. The
 * person should be able to tell which of the two a number came from.
 */
function OnlineTab({ onPick }: { onPick: (food: Food) => void }): JSX.Element {
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<readonly Food[] | null>(null);

  const run = async (task: Promise<ReturnType<typeof searchOnline> extends Promise<infer R> ? R : never>) => {
    setBusy(true);
    setError(null);
    setResults(null);
    const outcome = await task;
    setBusy(false);
    if (outcome.kind === 'error') setError(outcome.reason);
    else if (outcome.kind === 'empty') setError('Ничего не нашлось. Попробуйте другое слово или запишите вручную.');
    else setResults(outcome.foods);
  };

  return (
    <>
      <form
        className="row"
        style={{ gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(searchOnline(query));
        }}
      >
        <input
          id="online-search"
          type="search"
          className="grow"
          placeholder="Название продукта на упаковке"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn sm" disabled={busy || query.trim().length < 2}>
          Найти
        </button>
      </form>

      <form
        className="row"
        style={{ gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(lookupBarcode(barcode));
        }}
      >
        <input
          id="online-barcode"
          type="text"
          inputMode="numeric"
          className="grow"
          placeholder="или штрихкод с упаковки"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
        />
        <button type="submit" className="btn ghost sm" disabled={busy || barcode.replace(/\D/g, '').length < 8}>
          Найти
        </button>
      </form>

      {busy ? <p className="tiny muted">Ищу…</p> : null}
      {error ? <p className="banner tiny">{error}</p> : null}

      {results ? (
        <div className="col" style={{ gap: 7 }}>
          {results.map((item) => (
            <button key={item.id} type="button" className="foodrow" onClick={() => onPick(item)}>
              <span className="col" style={{ gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{item.name}</strong>
                <span className="tiny num muted">
                  {item.per100g.kcal} ккал / 100 г · Б {item.per100g.protein} · Ж {item.per100g.fat} · У {item.per100g.carbs}
                </span>
              </span>
              <span className="pill">из сети</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="tiny muted">{OFF_NOTE}</p>
    </>
  );
}

function PortionSheet({
  food,
  slot,
  onBack,
  onDone,
}: {
  food: Food;
  slot: MealSlot;
  onBack: () => void;
  onDone: () => void;
}): JSX.Element {
  const [grams, setGrams] = useState(food.portions[0]?.grams ?? 100);
  const [where, setWhere] = useState<MealSlot>(slot);
  const macros = forGrams(food.per100g, grams);

  return (
    <Sheet title={food.name} onClose={onBack}>
      <div className="row wrap" style={{ gap: 7 }}>
        {food.portions.map((portion) => (
          <button
            key={portion.label}
            type="button"
            className="chip"
            aria-pressed={grams === portion.grams}
            onClick={() => setGrams(portion.grams)}
          >
            {portion.label}
          </button>
        ))}
      </div>

      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Сколько, грамм</span>
        <input
          id="portion-grams"
          type="number"
          inputMode="numeric"
          min={1}
          value={grams}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            setGrams(Number.isFinite(next) && next > 0 ? next : 0);
          }}
        />
      </div>

      <div className="macro-row">
        <div className="macro"><b>{macros.kcal}</b><span>ккал</span></div>
        <div className="macro" style={{ color: 'var(--prot)' }}><b>{macros.protein}</b><span>белок, г</span></div>
        <div className="macro" style={{ color: 'var(--fat)' }}><b>{macros.fat}</b><span>жиры, г</span></div>
        <div className="macro" style={{ color: 'var(--carb)' }}><b>{macros.carbs}</b><span>углев., г</span></div>
      </div>

      <span className="eyebrow">Куда записать</span>
      <SlotPicker slot={where} onChange={setWhere} />

      <button
        type="button"
        className="btn block"
        disabled={grams <= 0}
        onClick={() => {
          actions.logFromFood(food, grams, where);
          onDone();
        }}
      >
        Записать
      </button>
    </Sheet>
  );
}

/**
 * Logging a recipe, with its composition open for editing.
 *
 * A recipe describes one way of making a dish and nobody cooks it exactly.
 * Each ingredient carries its own weight and its own calories, so switching
 * one off is exact arithmetic: the dish is the sum of what is left.
 */
function RecipeSheet({
  recipe,
  slot,
  onBack,
  onDone,
}: {
  recipe: Recipe;
  slot: MealSlot;
  onBack: () => void;
  onDone: () => void;
}): JSX.Element {
  const composition = useMemo(() => compositionFor(recipe), [recipe]);
  const [servings, setServings] = useState(1);
  const [where, setWhere] = useState<MealSlot>(slot);
  const [out, setOut] = useState<readonly string[]>([]);

  const isOut = (entry: ResolvedItem) => out.includes(entry.item.name);
  const kept = composition.filter((entry) => !isOut(entry));
  const removed = composition.filter(isOut);
  const macros = composition.length > 0 ? macrosOfKept(recipe, kept, servings) : recipe.macros;
  const name =
    removed.length === 0
      ? recipe.title
      : `${recipe.title} (без: ${removed.map((entry) => entry.item.name.toLowerCase()).join(', ')})`;

  const toggle = (entry: ResolvedItem) =>
    setOut((current) =>
      current.includes(entry.item.name)
        ? current.filter((name_) => name_ !== entry.item.name)
        : [...current, entry.item.name],
    );

  return (
    <Sheet title={recipe.title} onClose={onBack}>
      <ArtTile kind={recipe.art} height={100} label="" />

      <span className="eyebrow">Состав · {recipe.servings === 1 ? 'на 1 порцию' : `на ${recipe.servings} порции`}</span>
      <div className="col" style={{ gap: 6 }}>
        {composition.map((entry) => {
          const kept_ = !isOut(entry);
          const m = entry.macros;
          return (
            <button
              key={entry.item.name}
              type="button"
              className="optcard"
              aria-pressed={kept_}
              style={{ minHeight: 0, padding: '9px 11px', borderWidth: 1, opacity: kept_ ? 1 : 0.55 }}
              onClick={() => toggle(entry)}
            >
              <span className="bullet" style={{ width: 26, height: 26, borderRadius: 9 }}>
                {kept_ ? <TickGlyph /> : null}
              </span>
              <span className="col grow" style={{ gap: 1 }}>
                <span className="row between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13.5, textDecoration: kept_ ? 'none' : 'line-through' }}>
                    {entry.item.name}
                  </span>
                  <span className="tiny num muted">{entry.item.grams > 0 ? `${entry.item.grams} г` : '—'}</span>
                </span>
                {m ? (
                  <span className="tiny num muted">
                    {Math.round(m.kcal)} ккал · Б {Math.round(m.protein)} · Ж {Math.round(m.fat)} · У {Math.round(m.carbs)}
                  </span>
                ) : (
                  <span className="tiny muted">специи — на счёт не влияют</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <hr className="divider" />

      <span className="eyebrow">Сколько порций</span>
      <div className="row wrap" style={{ gap: 7 }}>
        {[0.5, 1, 1.5, 2].map((count) => (
          <button key={count} type="button" className="chip" aria-pressed={servings === count} onClick={() => setServings(count)}>
            {count === 0.5 ? 'полпорции' : `${count} порц.`}
          </button>
        ))}
      </div>

      <div className="macro-row">
        <div className="macro"><b>{macros.kcal}</b><span>ккал</span></div>
        <div className="macro" style={{ color: 'var(--prot)' }}><b>{macros.protein}</b><span>белок, г</span></div>
        <div className="macro" style={{ color: 'var(--fat)' }}><b>{macros.fat}</b><span>жиры, г</span></div>
        <div className="macro" style={{ color: 'var(--carb)' }}><b>{macros.carbs}</b><span>углев., г</span></div>
      </div>
      <p className="tiny muted">
        Это сумма того, что отмечено, делённая на порции. Варка и жарка её не меняют, кроме случаев, когда часть
        остаётся в кастрюле — например снятый с бульона жир.
      </p>

      <span className="eyebrow">Куда записать</span>
      <SlotPicker slot={where} onChange={setWhere} />

      <button
        type="button"
        className="btn block"
        onClick={() => {
          actions.logManual(name, 0, macros, where, 'recipe');
          onDone();
        }}
      >
        Записать
      </button>
    </Sheet>
  );
}

function ManualTab({ slot, onDone }: { slot: MealSlot; onDone: () => void }): JSX.Element {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [grams, setGrams] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [where, setWhere] = useState<MealSlot>(slot);

  const number = (value: string) => {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const ready = name.trim() !== '' && number(kcal) > 0;

  return (
    <>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Что это было</span>
        <input id="manual-name" type="text" placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid2">
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Калории</span>
          <input id="manual-kcal" type="number" inputMode="numeric" placeholder="ккал" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Вес, г</span>
          <input id="manual-grams" type="number" inputMode="numeric" placeholder="необязательно" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </div>
      </div>
      <div className="grid3">
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ color: 'var(--prot)' }}>Белок</span>
          <input id="manual-protein" type="number" inputMode="decimal" placeholder="г" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ color: 'var(--fat)' }}>Жиры</span>
          <input id="manual-fat" type="number" inputMode="decimal" placeholder="г" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ color: 'var(--carb)' }}>Углеводы</span>
          <input id="manual-carbs" type="number" inputMode="decimal" placeholder="г" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
      </div>
      <p className="tiny muted">
        Калорий достаточно, чтобы запись имела смысл. Белки, жиры и углеводы можно не заполнять — тогда они просто не
        попадут в дневные полоски, а не будут посчитаны нулями по умолчанию где-то ещё.
      </p>

      <span className="eyebrow">Куда записать</span>
      <SlotPicker slot={where} onChange={setWhere} />

      <button
        type="button"
        className="btn block"
        disabled={!ready}
        onClick={() => {
          actions.logManual(
            name.trim(),
            number(grams),
            {
              kcal: Math.round(number(kcal)),
              protein: number(protein),
              fat: number(fat),
              carbs: number(carbs),
              fiber: 0,
            },
            where,
          );
          onDone();
        }}
      >
        Записать
      </button>
    </>
  );
}

/** Downscaled hard: a 640 px JPEG is plenty to recognise a plate. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
}

/** Turning the camera on where the camera is, rather than in a settings screen. */
function KeySetup({ onReady }: { onReady: (key: string) => void }): JSX.Element {
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const candidate = draft.trim();
    setChecking(true);
    setError(null);
    const result = await checkKey(candidate);
    setChecking(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    writeVisionKey(candidate);
    onReady(candidate);
  };

  return (
    <>
      <p className="tiny">
        Распознавание еды по фотографии делает Claude, и для него нужен ваш собственный ключ. Пока ключа нет,
        приложение не обращается к нему вообще.
      </p>
      <p className="banner tiny">
        console.anthropic.com → Settings → API keys → Create key. Пополнить баланс на минимальную сумму и скопировать
        строку, которая начинается на sk-ant-. Одно фото стоит доли цента.
      </p>
      <input
        id="photo-key"
        type="password"
        autoComplete="off"
        placeholder="sk-ant-..."
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
      />
      <button type="button" className="btn block" disabled={draft.trim() === '' || checking} onClick={() => void save()}>
        {checking ? 'Проверяю ключ…' : 'Включить камеру'}
      </button>
      {error ? <p className="banner tiny" style={{ color: 'var(--warn)' }}>{error}</p> : null}
      <p className="tiny muted">{VISION_NOTE}</p>
    </>
  );
}

type AiMode = 'text' | 'photo';

/**
 * One tab, two ways to ask the model: describe the meal, or photograph it.
 *
 * Words are usually the better of the two. A photo cannot show how much oil
 * went into the pan or how fatty the meat was; a sentence can, and it costs
 * a fraction as much to send.
 */
function AiTab({ slot, seed, onDone }: { slot: MealSlot; seed: string; onDone: () => void }): JSX.Element {
  const [key, setKey] = useState<string | null>(() => readVisionKey());
  const [mode, setMode] = useState<AiMode>('text');
  const [text, setText] = useState(seed);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<readonly Guess[] | null>(null);
  const [where, setWhere] = useState<MealSlot>(slot);

  if (!key) return <KeySetup onReady={setKey} />;

  const handle = async (task: Promise<ReturnType<typeof describeFood> extends Promise<infer R> ? R : never>) => {
    setError(null);
    setGuesses(null);
    setBusy(true);
    const result = await task;
    setBusy(false);
    if (result.kind === 'error') setError(result.reason);
    else setGuesses(result.guesses);
  };

  const shoot = async (file: File) => {
    setError(null);
    setGuesses(null);
    setBusy(true);
    try {
      const dataUrl = await toDataUrl(file);
      setPreview(dataUrl);
      const result = await recogniseFood(key, dataUrl);
      if (result.kind === 'error') setError(result.reason);
      else setGuesses(result.guesses);
    } catch {
      setError('Снимок не удалось обработать на телефоне.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="chip grow" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
          Описать словами
        </button>
        <button type="button" className="chip grow" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>
          Сфотографировать
        </button>
      </div>

      {mode === 'text' ? (
        <>
          <textarea
            id="ai-text"
            rows={3}
            placeholder="Шакшука: 2 яйца, помидоры, болгарский перец, зелень, ложка оливкового масла"
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: 'inherit',
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            className="btn block"
            disabled={busy || text.trim().length < 3}
            onClick={() => void handle(describeFood(key, text))}
          >
            {busy ? 'Считаю…' : 'Посчитать'}
          </button>
          <p className="tiny muted">
            Пишите как говорите: блюдо и из чего оно. Количество можно не указывать — тогда возьмётся обычная домашняя
            порция, и модель об этом скажет.
          </p>
        </>
      ) : (
        <>
          <input
            ref={input}
            id="food-photo"
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void shoot(file);
              event.target.value = '';
            }}
          />
          {preview ? (
            <img
              src={preview}
              alt="Снимок блюда"
              style={{ width: '100%', borderRadius: 14, display: 'block', maxHeight: 220, objectFit: 'cover' }}
            />
          ) : null}
          <button type="button" className="btn block" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Смотрю на снимок…' : preview ? 'Другой снимок' : 'Сфотографировать блюдо'}
          </button>
        </>
      )}

      {error ? <p className="banner tiny">{error}</p> : null}

      {guesses ? (
        <>
          <span className="eyebrow">Что получилось</span>
          <div className="col" style={{ gap: 7 }}>
            {guesses.map((guess, index) => (
              <div key={`${guess.name}-${index}`} className="foodrow" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="col" style={{ gap: 3 }}>
                  <span className="row wrap" style={{ gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{guess.name}</strong>
                    <span className="pill num">{guess.grams} г</span>
                    {guess.confidence === 'low' ? <span className="pill" style={{ color: 'var(--warn)' }}>не уверен</span> : null}
                  </span>
                  <MacroLine macros={guess.macros} />
                  {guess.note ? <span className="tiny muted">{guess.note}</span> : null}
                </span>
              </div>
            ))}
          </div>

          <span className="eyebrow">Куда записать</span>
          <SlotPicker slot={where} onChange={setWhere} />

          <button
            type="button"
            className="btn block"
            onClick={() => {
              for (const guess of guesses) {
                actions.logManual(guess.name, guess.grams, guess.macros, where, 'photo');
              }
              onDone();
            }}
          >
            Записать {guesses.length === 1 ? 'запись' : `все ${guesses.length}`}
          </button>
          <p className="tiny muted">
            Если цифра выглядит не так — запишите и поправьте вручную. Любая оценка здесь приблизительная.
          </p>
        </>
      ) : null}

      <p className="tiny muted">{VISION_NOTE}</p>
    </>
  );
}
