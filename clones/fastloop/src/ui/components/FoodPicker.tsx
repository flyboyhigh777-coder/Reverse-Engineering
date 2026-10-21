import { useMemo, useRef, useState } from 'react';
import { FOODS, FOOD_TABLE_NOTE, searchFoods } from '../../domain/foods';
import type { Food } from '../../domain/foods';
import { SLOT_LABEL, MEAL_SLOTS, forGrams } from '../../domain/nutrition';
import { OFF_NOTE, lookupBarcode, searchOnline } from '../../domain/openFoodFacts';
import { RECIPES } from '../../domain/recipes';
import type { Macros, Recipe } from '../../domain/recipes';
import type { MealSlot } from '../../domain/types';
import { VISION_NOTE, recogniseFood } from '../../domain/vision';
import type { Guess } from '../../domain/vision';
import { actions } from '../../state/store';
import { readVisionKey } from '../../state/visionKey';
import { ArtTile } from './FoodArt';
import { Sheet } from './common';

type Tab = 'search' | 'online' | 'recipes' | 'manual' | 'photo';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'search', label: 'Продукты' },
  { id: 'online', label: 'В интернете' },
  { id: 'recipes', label: 'Мои рецепты' },
  { id: 'manual', label: 'Вручную' },
  { id: 'photo', label: 'Фото' },
];

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

      {tab === 'search' ? <SearchTab onPick={setChosen} /> : null}
      {tab === 'online' ? <OnlineTab onPick={setChosen} /> : null}
      {tab === 'recipes' ? <RecipeTab onPick={setRecipe} /> : null}
      {tab === 'manual' ? <ManualTab slot={slot} onDone={onClose} /> : null}
      {tab === 'photo' ? <PhotoTab slot={slot} onDone={onClose} /> : null}
    </Sheet>
  );
}

function SearchTab({ onPick }: { onPick: (food: Food) => void }): JSX.Element {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchFoods(query), [query]);

  return (
    <>
      <input
        id="food-search"
        type="search"
        placeholder="Найти продукт или блюдо"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length === 0 ? (
        <p className="tiny muted">
          Ничего не нашлось. Запишите вручную — на соседней вкладке можно указать название и калории.
        </p>
      ) : (
        <div className="col" style={{ gap: 7 }}>
          {results.map((item) => (
            <button key={item.id} type="button" className="foodrow" onClick={() => onPick(item)}>
              <span className="col" style={{ gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{item.name}</strong>
                <span className="tiny num muted">
                  {item.per100g.kcal} ккал / 100 г · Б {item.per100g.protein} · Ж {item.per100g.fat} · У {item.per100g.carbs}
                </span>
              </span>
              <span className="pill">{item.group.split(',')[0]}</span>
            </button>
          ))}
        </div>
      )}
      <p className="tiny muted">
        {FOOD_TABLE_NOTE} В базе {FOODS.length} позиций.
      </p>
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

function RecipeTab({ onPick }: { onPick: (recipe: Recipe) => void }): JSX.Element {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const results = needle === '' ? RECIPES : RECIPES.filter((item) => item.title.toLowerCase().includes(needle));

  return (
    <>
      <input
        id="recipe-search"
        type="search"
        placeholder="Найти среди рецептов приложения"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="col" style={{ gap: 7 }}>
        {results.map((item) => (
          <button key={item.id} type="button" className="foodrow" onClick={() => onPick(item)}>
            <span className="row" style={{ gap: 9 }}>
              <span style={{ width: 40, flex: 'none', borderRadius: 9, overflow: 'hidden' }}>
                <ArtTile kind={item.art} height={40} rounded={9} label="" />
              </span>
              <span className="col" style={{ gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{item.title}</strong>
                <MacroLine macros={item.macros} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="tiny muted">Значения указаны на одну порцию рецепта — её и записываем.</p>
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
  const [servings, setServings] = useState(1);
  const [where, setWhere] = useState<MealSlot>(slot);
  const k = servings;

  return (
    <Sheet title={recipe.title} onClose={onBack}>
      <ArtTile kind={recipe.art} height={110} label="" />
      <div className="row wrap" style={{ gap: 7 }}>
        {[0.5, 1, 1.5, 2].map((count) => (
          <button key={count} type="button" className="chip" aria-pressed={servings === count} onClick={() => setServings(count)}>
            {count === 0.5 ? 'полпорции' : `${count} порц.`}
          </button>
        ))}
      </div>
      <div className="macro-row">
        <div className="macro"><b>{Math.round(recipe.macros.kcal * k)}</b><span>ккал</span></div>
        <div className="macro" style={{ color: 'var(--prot)' }}><b>{Math.round(recipe.macros.protein * k)}</b><span>белок, г</span></div>
        <div className="macro" style={{ color: 'var(--fat)' }}><b>{Math.round(recipe.macros.fat * k)}</b><span>жиры, г</span></div>
        <div className="macro" style={{ color: 'var(--carb)' }}><b>{Math.round(recipe.macros.carbs * k)}</b><span>углев., г</span></div>
      </div>
      <span className="eyebrow">Куда записать</span>
      <SlotPicker slot={where} onChange={setWhere} />
      <button
        type="button"
        className="btn block"
        onClick={() => {
          actions.logFromRecipe(recipe, servings, where);
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

function PhotoTab({ slot, onDone }: { slot: MealSlot; onDone: () => void }): JSX.Element {
  const key = readVisionKey();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<readonly Guess[] | null>(null);
  const [where, setWhere] = useState<MealSlot>(slot);

  if (!key) {
    return (
      <>
        <p className="tiny">
          Распознавание еды по фотографии работает через Claude и требует вашего собственного ключа API. Пока ключа нет,
          приложение не выходит в сеть вообще — ни одного запроса никуда.
        </p>
        <p className="banner tiny">
          Включается в профиле: «ИИ-камера» → вставить ключ с console.anthropic.com. Каждое фото — отдельный платный
          запрос у вас на счету, обычно это доли цента. Снимок уходит в Anthropic и нигде не сохраняется.
        </p>
        <p className="tiny muted">{VISION_NOTE}</p>
      </>
    );
  }

  const run = async (file: File) => {
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
      <input
        ref={input}
        id="food-photo"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void run(file);
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

      {error ? <p className="banner tiny">{error}</p> : null}

      {guesses ? (
        <>
          <span className="eyebrow">Что видно на снимке</span>
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
            Если цифра выглядит не так — запишите и поправьте вручную на соседней вкладке. Оценка по фото всегда
            приблизительная.
          </p>
        </>
      ) : null}

      <p className="tiny muted">{VISION_NOTE}</p>
    </>
  );
}
