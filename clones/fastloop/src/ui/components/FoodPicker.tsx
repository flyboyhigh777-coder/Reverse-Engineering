import { useEffect, useMemo, useRef, useState } from 'react';
import { FOODS, FOOD_TABLE_NOTE } from '../../domain/foods';
import type { Food } from '../../domain/foods';
import { searchLibrary } from '../../domain/foodSearch';
import { compositionFor, macrosOfKept } from '../../domain/ingredients';
import type { ResolvedItem } from '../../domain/ingredients';
import { SLOT_LABEL, MEAL_SLOTS, forGrams } from '../../domain/nutrition';
import { OFF_NOTE, lookupBarcode, searchOnline } from '../../domain/openFoodFacts';
import type { Macros, Recipe } from '../../domain/recipes';
import type { MealSlot } from '../../domain/types';
import { DEFAULT_PROVIDER, TOO_SLOW, VISION_NOTE, VISION_PROVIDERS, providerById, scaleGuess, withoutPart } from '../../domain/vision';
import type { Guess, ProviderId, ShotContext, VisionResult } from '../../domain/vision';
import { useContent } from '../../state/content';
import { actions, useAppState } from '../../state/store';
import { readVisionAccess, writeVisionAccess } from '../../state/visionKey';
import type { VisionAccess } from '../../state/visionKey';
import { DishArt } from './DishArt';
import { Sheet } from './common';
import { MealTimeProvider, WhenPicker, useMealAt } from './MealTime';
import { KeyField, KeyHowTo } from './VisionKey';

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
    return (
      <MealTimeProvider>
        <PortionSheet food={chosen} slot={slot} onBack={() => setChosen(null)} onDone={onClose} />
      </MealTimeProvider>
    );
  }
  if (recipe) {
    return (
      <MealTimeProvider>
        <RecipeSheet recipe={recipe} slot={slot} onBack={() => setRecipe(null)} onDone={onClose} />
      </MealTimeProvider>
    );
  }

  return (
    <MealTimeProvider>
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
      {tab === 'ai' ? <AiTab slot={slot} seed={seed} onDone={onClose} onSwitch={setTab} /> : null}
      {tab === 'manual' ? <ManualTab slot={slot} onDone={onClose} /> : null}
    </Sheet>
    </MealTimeProvider>
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
                    <DishArt id={hit.recipe.id} kind={hit.recipe.art} height={38} rounded={9} label="" credit={false} />
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
  const mealAt = useMealAt();
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

      <WhenPicker />

      <button
        type="button"
        className="btn block"
        disabled={grams <= 0}
        onClick={() => {
          actions.logFromFood(food, grams, where, mealAt());
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
  const mealAt = useMealAt();
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
      <DishArt id={recipe.id} kind={recipe.art} height={100} label={recipe.title} />

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

      <WhenPicker />

      <button
        type="button"
        className="btn block"
        onClick={() => {
          actions.logManual(name, 0, macros, where, 'recipe', mealAt());
          onDone();
        }}
      >
        Записать
      </button>
    </Sheet>
  );
}

function ManualTab({ slot, onDone }: { slot: MealSlot; onDone: () => void }): JSX.Element {
  const mealAt = useMealAt();
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

      <WhenPicker />

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
            'manual',
            mealAt(),
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

/**
 * The key, asked for at the point it is actually needed.
 *
 * It used to stand in front of the whole tab, so a person who opened the app
 * to photograph breakfast met an API key instead of a camera. Now it appears
 * underneath the thing that is waiting on it — a photograph already taken,
 * or a description already written — and says which.
 */
function KeyGate({
  need,
  onReady,
  onSwitch,
}: {
  need: string;
  onReady: (access: VisionAccess) => void;
  onSwitch: (tab: Tab) => void;
}): JSX.Element {
  const [chosen, setChosen] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = providerById(chosen);
  const empty = draft.trim() === '';

  const save = async () => {
    const candidate = draft.trim();
    setChecking(true);
    setError(null);
    const result = await provider.check(candidate);
    setChecking(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    const access: VisionAccess = { provider: chosen, key: candidate, model: result.model ?? null };
    writeVisionAccess(access);
    onReady(access);
  };

  return (
    <>
      <p className="tiny">
        <strong>{need}</strong> Считает не приложение, а модель, и для неё нужен ваш собственный ключ. Пока ключа
        нет, никуда ничего не уходит.
      </p>
      <div className="row wrap" style={{ gap: 7 }}>
        {VISION_PROVIDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={chosen === item.id}
            onClick={() => {
              setChosen(item.id);
              setError(null);
            }}
          >
            {item.title}
            <span className={item.free ? 'pill accent' : 'pill'} style={{ fontSize: 10 }}>
              {item.free ? 'бесплатно' : 'платно'}
            </span>
          </button>
        ))}
      </div>
      <KeyHowTo provider={provider} />
      <KeyField
        provider={provider}
        id="photo-key"
        value={draft}
        onChange={(next) => {
          setDraft(next);
          setError(null);
        }}
      />
      {/* The label carries the reason. A button that only goes dim reads as
          something broken to anyone who has not made an API key before. */}
      <button type="button" className="btn block" disabled={empty || checking} onClick={() => void save()}>
        {checking ? 'Проверяю ключ…' : empty ? 'Сначала вставьте ключ ↑' : 'Сохранить и посчитать'}
      </button>
      {error ? <p className="banner tiny" style={{ color: 'var(--warn)' }}>{error}</p> : null}
      {/* Nobody should be stuck on this screen. The rest of the sheet needs
          no key at all, and the meal can be written down right now. */}
      <button type="button" className="btn quiet block" onClick={() => onSwitch('manual')}>
        Не сейчас — записать вручную
      </button>
      <p className="tiny muted">{VISION_NOTE}</p>
    </>
  );
}

type AiMode = 'text' | 'photo';

/**
 * Which of the two the person used last.
 *
 * Somebody who photographs breakfast photographs lunch too, and landing on
 * the text box every time costs them a tap at every meal. Stored outside the
 * app state because it is a habit, not data: losing it costs nothing.
 */
const MODE_KEY = 'fastloop.ai.mode';

function lastMode(): AiMode {
  try {
    return globalThis.localStorage?.getItem(MODE_KEY) === 'photo' ? 'photo' : 'text';
  } catch {
    return 'text';
  }
}

function rememberMode(mode: AiMode): void {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode);
  } catch {
    /* Storage unavailable — the habit simply does not stick. */
  }
}

/**
 * One tab, two ways to ask the model: describe the meal, or photograph it.
 *
 * Words are usually the better of the two. A photo cannot show how much oil
 * went into the pan or how fatty the meat was; a sentence can, and it costs
 * a fraction as much to send.
 */
function AiTab({
  slot,
  seed,
  onDone,
  onSwitch,
}: {
  slot: MealSlot;
  seed: string;
  onDone: () => void;
  onSwitch: (tab: Tab) => void;
}): JSX.Element {
  const mealAt = useMealAt();
  const state = useAppState();
  const [access, setAccess] = useState<VisionAccess | null>(() => readVisionAccess());
  const [mode, setMode] = useState<AiMode>(lastMode);
  const [text, setText] = useState(seed);
  /** Said beside the photograph: what the camera cannot see. */
  const [hint, setHint] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The model's own answer is kept apart from the edited one, so scaling a
  // portion up and back down lands exactly where it started.
  const [guesses, setGuesses] = useState<readonly Guess[] | null>(null);
  const [items, setItems] = useState<readonly Guess[] | null>(null);
  const [where, setWhere] = useState<MealSlot>(slot);

  // No key is no reason to keep someone out of the camera. The shot is the
  // part that cannot wait — breakfast gets cold, and the plate gets eaten —
  // while a key can be fetched afterwards with the photograph already taken.
  // Recognition is the only step that actually needs one.
  const provider = providerById(access?.provider ?? DEFAULT_PROVIDER);
  const model = access?.model ?? provider.model;

  const handle = async (task: Promise<VisionResult>) => {
    setError(null);
    setGuesses(null);
    setItems(null);
    setBusy(true);
    const result = await task;
    setBusy(false);
    if (result.kind === 'error') setError(result.reason);
    else {
      setGuesses(result.guesses);
      setItems(result.guesses);
    }
  };

  /**
   * What the app knows without asking: which meal, what time, and — being a
   * fasting tracker — how long the pause was. None of it costs a tap.
   */
  const shotContext = (): ShotContext => {
    const now = Date.now();
    const fasted = state.current ? (now - state.current.startedAt) / 3_600_000 : null;
    return {
      meal: SLOT_LABEL[where],
      time: new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      fastedHours: fasted !== null && fasted >= 1 ? fasted : null,
      hint,
    };
  };

  /** Sends one frame off, with whatever the person added about it. */
  const look = async (shot: string, said?: string, key?: VisionAccess, brief = false) => {
    const use = key ?? access;
    if (!use) return;
    await handle(provider.recognise(use.key, model, shot, { ...shotContext(), hint: said ?? hint }, undefined, brief));
  };

  /**
   * Asks again with the dish named.
   *
   * Misreading the dish poisons everything after it — the wrong dish is
   * costed, and someone who only edits the calories is fixing the symptom.
   * In a trial of 42 people, offering the model's top three names and
   * letting the person pick raised correct identification from 68% to 86%:
   * the right answer is usually in the list, just not always first.
   */
  const askAs = async (dish: string) => {
    if (!preview) return;
    await look(preview, `на фото это ${dish}${hint.trim() === '' ? '' : `. ${hint.trim()}`}`);
  };

  /** The frame is almost never useless: two words from the person fix it. */
  const reshoot = async () => {
    if (preview) await look(preview);
  };

  /**
   * The picture is kept whether or not it can be read yet.
   *
   * Someone photographing breakfast has a plate in front of them and no
   * interest in API keys. The frame is taken and held; if a key arrives
   * later it is read then, and nothing has to be photographed twice.
   */
  const shoot = async (file: File) => {
    setError(null);
    setGuesses(null);
    setItems(null);
    setBusy(true);
    let dataUrl: string;
    try {
      dataUrl = await toDataUrl(file);
    } catch {
      setBusy(false);
      setError('Снимок не удалось обработать на телефоне.');
      return;
    }
    setPreview(dataUrl);
    setBusy(false);
    if (access) await look(dataUrl);
  };

  // A hard plate can take most of a minute. A button that says nothing for
  // that long reads as frozen, and the person shoots again — which starts
  // the wait over. So the wait is shown.
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!busy) {
      setWaited(0);
      return undefined;
    }
    const since = Date.now();
    const tick = window.setInterval(() => setWaited(Math.round((Date.now() - since) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [busy]);

  const pick = (next: AiMode) => {
    setMode(next);
    rememberMode(next);
  };

  /** A key saved with a photograph already waiting reads it straight away. */
  const keyArrived = (next: VisionAccess) => {
    setAccess(next);
    if (preview) void look(preview, undefined, next);
  };

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="chip grow" aria-pressed={mode === 'text'} onClick={() => pick('text')}>
          Описать словами
        </button>
        <button type="button" className="chip grow" aria-pressed={mode === 'photo'} onClick={() => pick('photo')}>
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
          {access ? (
            <button
              type="button"
              className="btn block"
              disabled={busy || text.trim().length < 3}
              onClick={() => void handle(provider.describe(access.key, model, text))}
            >
              {busy ? `Считаю… ${waited}с` : 'Посчитать'}
            </button>
          ) : null}
          {!access ? (
            <KeyGate need="Чтобы посчитать по описанию, нужен ключ." onReady={keyArrived} onSwitch={onSwitch} />
          ) : null}
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
          ) : (
            <p className="tiny muted">
              Вся тарелка в кадре, съёмка сверху под углом примерно 45°, рядом вилка или ложка — по ним считается размер
              порции. Эти три вещи дают больше точности, чем любая модель.
            </p>
          )}
          {/* Never disabled by a missing key: the frame is the part that
              cannot wait, and it is kept whether or not it can be read. */}
          <button type="button" className="btn block" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? `Смотрю на снимок… ${waited}с` : preview ? 'Другой снимок' : 'Сфотографировать блюдо'}
          </button>

          {!access ? (
            <KeyGate
              need={preview ? 'Снимок сохранён — чтобы его прочитать, нужен ключ.' : 'Чтобы прочитать снимок, нужен ключ.'}
              onReady={keyArrived}
              onSwitch={onSwitch}
            />
          ) : null}

          <input
            id="ai-hint"
            type="text"
            placeholder="Необязательно: что это и как готовили"
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
          <p className="tiny muted">
            Масло в сковороде, жирность молока, заправка в салате — этого на снимке нет, а в калориях это больше
            половины ошибки. Одна фраза здесь весит больше, чем ещё один кадр.
          </p>
          {access && preview && !busy ? (
            <button type="button" className="btn ghost sm" onClick={() => void reshoot()}>
              Спросить ещё раз с этим же снимком
            </button>
          ) : null}
        </>
      )}

      {error ? (
        <>
          <p className="banner tiny">{error}</p>
          {/* Offered under the sentence that explains it, and only where it
              is the answer: most of the reply, and so most of the wait, is
              the ingredient breakdown. Without it the same plate comes back
              in a fraction of the time. */}
          {access && preview && !busy && error === TOO_SLOW ? (
            <button type="button" className="btn block" onClick={() => void look(preview, undefined, undefined, true)}>
              Спросить короче — без разбора по ингредиентам
            </button>
          ) : null}
          {/* The whole history, with the model and the server's own reply,
              is one screen away — worth saying when a message is not
              enough to act on. */}
          <p className="tiny muted">Что именно не прошло — в Профиле, «Что происходило».</p>
        </>
      ) : null}

      {items && guesses ? (
        <>
          <span className="eyebrow">Что получилось</span>
          <p className="tiny muted">
            Поправьте вес до записи, а не после. Оценки по фотографии в среднем занижают порцию, и несколько
            несохранённых граммов здесь превращаются в заметную разницу за неделю.
          </p>
          <div className="col" style={{ gap: 7 }}>
            {items.map((item, index) => {
              const origin = guesses[index];
              const scalable = origin.grams > 0;
              return (
                <div key={`${origin.name}-${index}`} className="guess">
                  <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <span className="col grow" style={{ gap: 3 }}>
                      <span className="row wrap" style={{ gap: 6 }}>
                        <strong style={{ fontSize: 14 }}>{item.name}</strong>
                        {item.confidence === 'low' ? (
                          <span className="pill" style={{ color: 'var(--warn)' }}>не уверен</span>
                        ) : null}
                      </span>
                      <MacroLine macros={item.macros} />
                      {item.note ? <span className="tiny muted">{item.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="closebtn"
                      aria-label={`Убрать «${item.name}»`}
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </div>

                  <div className="row wrap" style={{ gap: 7, alignItems: 'center' }}>
                    <label className="tiny muted" htmlFor={`guess-grams-${index}`}>Вес</label>
                    <input
                      id={`guess-grams-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={5000}
                      step={10}
                      value={item.grams}
                      onChange={(event) => {
                        const grams = Number(event.target.value);
                        if (!Number.isFinite(grams)) return;
                        setItems(items.map((row, i) => (i === index ? scaleGuess(origin, grams) : row)));
                      }}
                      style={{ width: 92 }}
                    />
                    <span className="tiny muted">г</span>
                    {scalable
                      ? [0.5, 1, 1.5, 2].map((factor) => (
                          <button
                            key={factor}
                            type="button"
                            className="chip"
                            aria-pressed={item.grams === Math.round(origin.grams * factor)}
                            onClick={() => setItems(items.map((row, i) => (i === index ? scaleGuess(origin, origin.grams * factor) : row)))}
                          >
                            ×{factor}
                          </button>
                        ))
                      : <span className="tiny muted">вес не определён — впишите свой</span>}
                  </div>

                  {item.alternatives.length > 0 && preview ? (
                    <div className="row wrap" style={{ gap: 6, alignItems: 'center' }}>
                      <span className="tiny muted">Не то блюдо?</span>
                      {item.alternatives.map((alt) => (
                        <button key={alt} type="button" className="chip" disabled={busy} onClick={() => void askAs(alt)}>
                          {alt}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {item.parts.length > 0 ? (
                    <div className="parts">
                      <span className="tiny muted">
                        Состав{item.partsAddUp ? '' : ' — приблизительный, суммы не сходятся, поэтому вычёркивать нельзя'}
                      </span>
                      <ul>
                        {item.parts.map((part, pi) => (
                          <li key={`${part.name}-${pi}`}>
                            <span className="grow">
                              {part.name}
                              {part.kind === 'по рецепту' ? <span className="guessed">по рецепту</span> : null}
                            </span>
                            <span className="num muted">
                              {part.grams > 0 ? `${part.grams} г · ` : ''}
                              {part.macros.kcal} ккал
                            </span>
                            {item.partsAddUp ? (
                              <button
                                type="button"
                                aria-label={`Убрать «${part.name}»`}
                                onClick={() => {
                                  const next = withoutPart(item, pi);
                                  setItems(items.map((row, i) => (i === index ? next : row)));
                                  // The reduced dish becomes the new baseline, so
                                  // scaling afterwards does not bring it back.
                                  setGuesses(guesses.map((row, i) => (i === index ? next : row)));
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <span className="tiny muted">
                        «По рецепту» значит, что этого на снимке не видно — так обычно готовят. Вычеркните то, чего у вас
                        не было.
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {items.length === 0 ? (
            <p className="banner tiny">Вы убрали все записи. Снимите ещё раз или опишите словами.</p>
          ) : (
            <>
              <span className="eyebrow">Куда записать</span>
              <SlotPicker slot={where} onChange={setWhere} />

              <WhenPicker />

              <button
                type="button"
                className="btn block"
                onClick={() => {
                  const at = mealAt();
                  for (const item of items) {
                    if (item.grams <= 0 && item.macros.kcal <= 0) continue;
                    actions.logManual(item.name, item.grams, item.macros, where, mode === 'photo' ? 'photo' : 'manual', at);
                  }
                  onDone();
                }}
              >
                {items.length === 1 ? 'Записать' : `Записать все ${items.length}`}
              </button>
            </>
          )}
        </>
      ) : null}

      <p className="tiny muted">{VISION_NOTE}</p>
    </>
  );
}
