import { useState } from 'react';
import { DEFAULT_SLOTS, MEAL_PLANS, PLAN_SECTIONS, dayMacros, planAverage, planRecipes } from '../../domain/mealPlans';
import type { MealPlan } from '../../domain/mealPlans';
import { RECIPE_CATEGORIES, RECIPE_TAGS, REGIONS, recipeById, recipesByRegion } from '../../domain/recipes';
import type { Macros, Recipe, RecipeTag, Region } from '../../domain/recipes';
import { useAppState } from '../../state/store';
import { useContent } from '../../state/content';
import { Diary } from './Diary';
import { ArtTile } from '../components/FoodArt';
import { DishArt } from '../components/DishArt';
import { Sheet } from '../components/common';

export function Recipes({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const [tab, setTab] = useState<'diary' | 'recipes' | 'regions' | 'plans'>('diary');

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Еда">
        <button type="button" role="tab" aria-selected={tab === 'diary'} onClick={() => setTab('diary')}>
          Дневник
        </button>
        <button type="button" role="tab" aria-selected={tab === 'recipes'} onClick={() => setTab('recipes')}>
          Рецепты
        </button>
        <button type="button" role="tab" aria-selected={tab === 'regions'} onClick={() => setTab('regions')}>
          Кухни
        </button>
        <button type="button" role="tab" aria-selected={tab === 'plans'} onClick={() => setTab('plans')}>
          Планы
        </button>
      </div>

      {tab === 'diary' ? <Diary /> : null}
      {tab === 'recipes' ? <RecipeList onRequestPro={onRequestPro} /> : null}
      {tab === 'regions' ? <RegionList onRequestPro={onRequestPro} /> : null}
      {tab === 'plans' ? <PlanList onRequestPro={onRequestPro} /> : null}
    </>
  );
}

function MacroRow({ macros, per }: { macros: Macros; per?: string }): JSX.Element {
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="macro-row">
        <div className="macro"><b>{macros.kcal}</b><span>ккал</span></div>
        <div className="macro"><b>{macros.protein}</b><span>белок, г</span></div>
        <div className="macro"><b>{macros.fat}</b><span>жиры, г</span></div>
        <div className="macro"><b>{macros.carbs}</b><span>углев., г</span></div>
      </div>
      <span className="tiny muted">
        ≈ на {per ?? 'порцию'}, клетчатка {macros.fiber} г. Значения приблизительные: зависят от продуктов и размера порции.
      </span>
    </div>
  );
}

function RecipeTile({ recipe, locked, onOpen }: { recipe: Recipe; locked: boolean; onOpen: () => void }): JSX.Element {
  return (
    <button type="button" className="tile" onClick={onOpen}>
      <span className="art">
        <DishArt id={recipe.id} kind={recipe.art} label={recipe.title} />
        {locked ? <span className="badge-pro">PRO</span> : null}
      </span>
      <span className="tile-title">{recipe.title}</span>
      <span className="tiny muted num">
        {recipe.macros.kcal} ккал · {recipe.macros.protein} г белка · {recipe.minutes} мин
      </span>
    </button>
  );
}

function RecipeList({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const RECIPES = useContent().recipes;
  const [open, setOpen] = useState<Recipe | null>(null);
  const [tag, setTag] = useState<RecipeTag | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pool = tag ? RECIPES.filter((recipe) => recipe.tags.includes(tag)) : RECIPES;
  const hero = recipeById('tuna-bean');

  const openRecipe = (recipe: Recipe) => {
    if (recipe.premium && !state.premium) onRequestPro('Этот рецепт входит в PRO.');
    else setOpen(recipe);
  };

  return (
    <>
      {hero ? (
        <button type="button" className="hero" onClick={() => openRecipe(hero)}>
          <DishArt id={hero.id} kind="fish" height={150} rounded={18} label="" variant="hero" credit={false} />
          <span className="hero-text">
            <strong>Нечего готовить?</strong>
            <span>Две банки из шкафа, десять минут и 29 г белка</span>
          </span>
        </button>
      ) : null}

      <div className="carousel chiprow">
        <button type="button" className="chip" aria-pressed={tag === null} onClick={() => setTag(null)}>
          всё
        </button>
        {RECIPE_TAGS.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={tag === name} onClick={() => setTag(tag === name ? null : name)}>
            {name}
          </button>
        ))}
      </div>

      {RECIPE_CATEGORIES.map((category) => {
        const items = pool.filter((recipe) => recipe.category === category);
        if (items.length === 0) return null;
        const isOpen = expanded === category;
        return (
          <div className="col" key={category} style={{ gap: 10 }}>
            <div className="section-head">
              <h2>{category}</h2>
              {items.length > 2 ? (
                <button type="button" onClick={() => setExpanded(isOpen ? null : category)}>
                  {isOpen ? 'Свернуть' : 'Смотреть все ›'}
                </button>
              ) : null}
            </div>
            {isOpen ? (
              <div className="grid2">
                {items.map((recipe) => (
                  <RecipeTile
                    key={recipe.id}
                    recipe={recipe}
                    locked={recipe.premium && !state.premium}
                    onOpen={() => openRecipe(recipe)}
                  />
                ))}
              </div>
            ) : (
              <div className="carousel">
                {items.map((recipe) => (
                  <RecipeTile
                    key={recipe.id}
                    recipe={recipe}
                    locked={recipe.premium && !state.premium}
                    onOpen={() => openRecipe(recipe)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="banner">
        Рецепты собраны под правила, которые вытащила клиническая разведка: около 1,6 г белка на кг в сутки, клетчатка в
        каждом приёме, никакого сахара первым блюдом. Это не лечебное питание и не замена назначениям врача.
      </p>

      {open ? <RecipeSheet recipe={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function RecipeSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }): JSX.Element {
  return (
    <Sheet title={recipe.title} onClose={onClose}>
      <DishArt id={recipe.id} kind={recipe.art} height={130} label={recipe.title} />
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="pill accent">{recipe.minutes} мин</span>
        <span className="pill">{recipe.servings === 1 ? '1 порция' : `${recipe.servings} порции`}</span>
        {recipe.tags.map((name) => (
          <span key={name} className="pill">{name}</span>
        ))}
      </div>
      <p className="tiny">{recipe.why}</p>
      {recipe.region ? (
        <p className="banner tiny">
          <strong>{recipe.region}.</strong> {recipe.adapted}
        </p>
      ) : null}
      <MacroRow macros={recipe.macros} />

      <div className="col" style={{ gap: 7 }}>
        <span className="eyebrow">Продукты</span>
        <ul className="col" style={{ gap: 5, listStyle: 'none', padding: 0, margin: 0 }}>
          {recipe.ingredients.map((item) => (
            <li key={item} className="tiny row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ color: 'var(--accent)' }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="col" style={{ gap: 7 }}>
        <span className="eyebrow">Приготовление</span>
        <ol className="col" style={{ gap: 7, listStyle: 'none', padding: 0, margin: 0 }}>
          {recipe.steps.map((step, index) => (
            <li key={step} className="tiny row" style={{ gap: 9, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 19, height: 19, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)', marginTop: 1,
                }}
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}

/**
 * Regional cooking.
 *
 * The dishes people around them actually cook, with the one change that makes
 * each fit a short eating window — stated on the card, not hidden. A library
 * of chicken breast and broccoli gets closed after a week.
 */
function RegionList({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState<Recipe | null>(null);
  const [region, setRegion] = useState<Region>('Узбекистан');

  const items = recipesByRegion(region);

  const openRecipe = (recipe: Recipe) => {
    if (recipe.premium && !state.premium) onRequestPro('Этот рецепт входит в PRO.');
    else setOpen(recipe);
  };

  return (
    <>
      <p className="tiny muted">
        Традиционные блюда, пересобранные под короткое окно: меньше жира и теста, больше белка и овощей. На каждой
        карточке написано, что именно изменено против привычного рецепта.
      </p>

      <div className="carousel chiprow">
        {REGIONS.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={region === name} onClick={() => setRegion(name)}>
            {name}
          </button>
        ))}
      </div>

      <div className="grid2">
        {items.map((recipe) => (
          <RecipeTile
            key={recipe.id}
            recipe={recipe}
            locked={recipe.premium && !state.premium}
            onOpen={() => openRecipe(recipe)}
          />
        ))}
      </div>

      <p className="banner">
        Калорийность и белок посчитаны по таблицам состава для указанных граммовок. Домашняя порция почти всегда больше
        расчётной — это нормально, но учитывайте при подсчёте.
      </p>

      {open ? <RecipeSheet recipe={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function PlanList({ onRequestPro }: { onRequestPro: (reason: string) => void }): JSX.Element {
  const state = useAppState();
  const [open, setOpen] = useState<MealPlan | null>(null);

  const openPlan = (plan: MealPlan) => {
    if (plan.premium && !state.premium) onRequestPro('Этот план питания входит в PRO.');
    else setOpen(plan);
  };

  const first = MEAL_PLANS[0];

  return (
    <>
      <button type="button" className="hero" onClick={() => openPlan(first)}>
        <ArtTile kind={first.art} height={150} rounded={18} label="" variant="hero" />
        <span className="hero-text">
          <strong>{first.title}</strong>
          <span>{first.lede}</span>
        </span>
      </button>

      {PLAN_SECTIONS.map((section) => {
        const items = MEAL_PLANS.filter((plan) => plan.section === section);
        if (items.length === 0) return null;
        return (
          <div className="col" key={section} style={{ gap: 10 }}>
            <div className="section-head">
              <h2>{section}</h2>
            </div>
            <div className="carousel">
              {items.map((plan) => {
                const locked = plan.premium && !state.premium;
                const avg = planAverage(plan);
                return (
                  <button key={plan.id} type="button" className="tile wide" onClick={() => openPlan(plan)}>
                    <span className="art">
                      <ArtTile kind={plan.art} height={110} label={plan.title} />
                      {locked ? <span className="badge-pro">PRO</span> : null}
                    </span>
                    <span className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <span className="tile-title grow">{plan.title}</span>
                      <span className="pill accent">{plan.goal}</span>
                    </span>
                    <span className="tiny muted">{plan.lede}</span>
                    <span className="tiny muted num">
                      7 дней · ≈ {avg.kcal} ккал, {avg.protein} г белка, {avg.fiber} г клетчатки
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="banner">
        Калорийность в планах — это базовые порции, а не ваша норма. Большинству взрослых нужно больше: добавьте перекус
        или увеличьте порцию под свой расход. Разумный коридор снижения веса — 0,5–1 кг в неделю.
      </p>

      {open ? <PlanSheet plan={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function PlanSheet({ plan, onClose }: { plan: MealPlan; onClose: () => void }): JSX.Element {
  const [day, setDay] = useState(0);
  const current = plan.days[day];
  const macros = dayMacros(current);
  const names = (id?: string) => (id ? recipeById(id)?.title ?? '' : '');
  const slots = plan.slots ?? DEFAULT_SLOTS;

  return (
    <Sheet title={plan.title} onClose={onClose}>
      <ArtTile kind={plan.art} height={110} label="" />
      <p className="tiny">{plan.about}</p>

      <div className="carousel" style={{ marginInline: 0, paddingInline: 0 }}>
        {plan.days.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className="chip"
            aria-pressed={index === day}
            onClick={() => setDay(index)}
          >
            {item.label.slice(0, 2)}
          </button>
        ))}
      </div>

      <div className="col" style={{ gap: 9 }}>
        <span className="eyebrow">{current.label}</span>
        {([
          [slots[0], current.breakfast],
          [slots[1], current.lunch],
          [slots[2], current.dinner],
          [slots[3], current.snack],
        ] as const).map(([slot, id]) =>
          id ? (
            <div className="row between" key={slot} style={{ gap: 10 }}>
              <span className="tiny muted" style={{ minWidth: 96 }}>{slot}</span>
              <span className="tiny grow" style={{ fontWeight: 600, textAlign: 'right' }}>{names(id)}</span>
            </div>
          ) : null,
        )}
      </div>

      <MacroRow macros={macros} per="день" />

      <p className="banner tiny">
        Это базовые порции, а не ваша норма. Большинству взрослых нужно больше: добавьте перекус или увеличьте порцию
        белка и гарнира под свой расход. Разумный коридор снижения веса — 0,5–1 кг в неделю, быстрее не стоит.
      </p>

      {current.note ? <p className="banner tiny">{current.note}</p> : null}

      <p className="tiny muted">
        За неделю план использует {planRecipes(plan).length} рецептов — их можно открыть во вкладке «Рецепты».
      </p>
    </Sheet>
  );
}
