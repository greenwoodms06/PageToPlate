// Plans tab (plan Task 19; canvas 2c, screenshot 05, dark 3d): List/Calendar
// segment toggle, display-font stat strip, plan cards reverse-chron by
// acceptedAt, and the mark-as-made dialog mounted for whichever row asked.
import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { store, useStore } from '../../data/store';
import { todayISO } from '../../data/types';
import { SegmentToggle } from '../../components/SegmentToggle';
import { avgDisplay } from '../../logic/rating';
import { MarkAsMadeDialog } from '../recipe/MarkAsMadeDialog';
import { RecipeCardSheet } from '../recipe/RecipeCardSheet';
import { PlanCard } from './PlanCard';
import { CalendarView } from './CalendarView';
import { PlanFilterBar } from './PlanFilterBar';
import { EMPTY_PLAN_FILTERS, buildPlanLookups, isEmptyPlanFilters, planMatchesWith } from './planFilter';
import type { PlanFilters } from './planFilter';

type DialogState = { recipeId: string; planId?: string; madeEntryId?: string };

export function PlansTab() {
  useStore((s) => s.version);
  const [view, setView] = useState('List');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [flashPlanId, setFlashPlanId] = useState<string | null>(null);
  const scale = store.settings.ratingScale;
  const [filters, setFilters] = useState<PlanFilters>({ ...EMPTY_PLAN_FILTERS, ratingScale: scale });

  // Calendar → plan handoff (round-1 amendment 4c): a plan line in the
  // day-detail jumps to that plan in List view. The effect runs AFTER the
  // list has rendered (flashPlanId also switches `view`), so the card exists
  // to scroll to; the timeout clears the flag once the 1.2s outline pulse
  // (base.css .flash-plan) has played, so a second tap can re-trigger it.
  const goToPlan = (planId: string) => {
    setView('List');
    setFlashPlanId(planId);
  };
  useEffect(() => {
    if (flashPlanId === null) return;
    document.querySelector(`[data-plan-id="${flashPlanId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFlashPlanId(null), 1300);
    return () => clearTimeout(t);
  }, [flashPlanId]);

  // Stat strip (canvas 2c): "14 made this year · 2 open plans · 7.4 avg rating".
  // Made counts ENTRIES this calendar year (cooking the same recipe twice is
  // two cooks); open plans = plans with ≥1 open item; avg over every rated
  // entry, one decimal.
  const year = todayISO().slice(0, 4);
  const madeThisYear = store.madeEntries.filter((m) => m.date.startsWith(year)).length;
  const openPlans = store.plans.filter((p) => p.items.some((i) => i.state === 'open')).length;
  const ratings = store.madeEntries.map((m) => m.rating).filter((r): r is number => r !== undefined);
  const avgRating =
    ratings.length > 0 ? avgDisplay(ratings.reduce((a, b) => a + b, 0) / ratings.length, scale).toFixed(1) : '—';

  const allPlans = [...store.plans].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));

  // Filter dropdowns are DYNAMIC — only the books/categories actually present in
  // plans (round-2 amendment 3). Ordered by first appearance across plans.
  const { filterBooks, filterCats } = useMemo(() => {
    const seenBook = new Map<string, { id: string; name: string }>();
    const seenCat: string[] = [];
    for (const p of allPlans) {
      for (const item of p.items) {
        const r = store.recipes.find((rr) => rr.id === item.recipeId);
        if (!r) continue;
        if (!seenBook.has(r.bookId)) {
          seenBook.set(r.bookId, { id: r.bookId, name: store.books.find((b) => b.id === r.bookId)?.name ?? 'Unknown book' });
        }
        if (!seenCat.includes(r.category)) seenCat.push(r.category);
      }
    }
    return { filterBooks: [...seenBook.values()], filterCats: seenCat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.version]);

  // Live scale wins over whatever was stamped when the filter state was created.
  const effFilters: PlanFilters = { ...filters, ratingScale: scale };
  const today = todayISO();
  const shownPlans = isEmptyPlanFilters(effFilters)
    ? allPlans
    : (() => {
        const lk = buildPlanLookups(store.recipes, store.books, store.madeEntries);
        return allPlans.filter((p) => planMatchesWith(p, lk, effFilters, today));
      })();

  return (
    <main style={{ padding: '20px 16px 96px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            fontWeight: 600,
          }}
        >
          Page to Plate
        </div>
        <button
          aria-label="Settings"
          onClick={() => {
            window.location.hash = '#/settings';
          }}
          style={{ color: 'var(--ink-soft)', padding: 6, display: 'grid', placeItems: 'center' }}
        >
          <Settings size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 12px' }}>
        <h1 className="screen-title">Plans</h1>
        <SegmentToggle options={['List', 'Calendar']} value={view} onChange={setView} />
      </div>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          gap: 14,
          fontSize: 12.5,
          color: 'var(--ink-mid)',
        }}
      >
        <Stat n={String(madeThisYear)} label="made this year" />
        <Stat n={String(openPlans)} label="open plans" />
        <Stat n={avgRating} label="avg rating" />
      </div>

      {view === 'List' ? (
        allPlans.length === 0 ? (
          <p className="meta" style={{ marginTop: 4 }}>No plans yet — build one from the Generate tab.</p>
        ) : (
          <>
            <PlanFilterBar
              filters={effFilters}
              onChange={setFilters}
              books={filterBooks}
              categories={filterCats}
              scale={scale}
            />
            <div data-testid="plan-count" style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
              {shownPlans.length} plan{shownPlans.length === 1 ? '' : 's'}
              {shownPlans.length !== allPlans.length ? ` of ${allPlans.length}` : ''}
            </div>
            {shownPlans.length === 0 ? (
              <p className="meta" style={{ marginTop: 4 }}>No plans match — loosen a filter.</p>
            ) : (
              shownPlans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  flash={p.id === flashPlanId}
                  onMarkMade={(recipeId) => setDialog({ recipeId, planId: p.id })}
                  onEditEntry={(recipeId, madeEntryId) => setDialog({ recipeId, madeEntryId })}
                  onOpenRecipe={setOpenRecipeId}
                />
              ))
            )}
          </>
        )
      ) : (
        <CalendarView onOpenPlan={goToPlan} />
      )}

      {dialog && <MarkAsMadeDialog {...dialog} onClose={() => setDialog(null)} />}
      {openRecipeId && <RecipeCardSheet recipeId={openRecipeId} onClose={() => setOpenRecipeId(null)} />}
    </main>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <span>
      <b style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{n}</b>{' '}
      {label}
    </span>
  );
}
