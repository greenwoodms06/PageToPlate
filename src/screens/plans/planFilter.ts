// Plan filtering predicate (round-2 amendment 3). A plan is SHOWN when it
// satisfies EVERY active filter dimension (AND across dimensions); empty
// filters = all plans. Content filters (keyword / book / category / rating)
// operate over the recipes referenced by ALL of the plan's items — the plan is
// "about" those recipes, so a keyword or book match against any one of them
// keeps the whole plan. Made-status is the exception: it reads item STATE.
//
// Mirrors Browse (src/screens/browse/BrowseTab.tsx): same include→not chip
// semantics, the same book-tag inheritance in the keyword hay, and the same
// bin-aware `below → value+1` inclusive rating adjustment.
import type { Cookbook, MadeEntry, Pill, Plan, Recipe } from '../../data/types';
import { todayISO } from '../../data/types';
import type { SelEntry } from '../../components/FilterControls';
import type { RatingScale } from '../../logic/rating';
import { ratingMatches } from '../../logic/rating';
import { recipeMatches } from '../../logic/pills';
import { fromISO } from '../../logic/dates';

export type DatePreset = 'all' | 'thisMonth' | 'last3Months' | 'thisYear' | 'custom';
export type RatingMode = 'above' | 'exact' | 'below';
export type MadeStatus = 'made' | 'notmade';

export interface PlanFilters {
  datePreset: DatePreset;
  /** Only meaningful when datePreset === 'custom'. 'YYYY-MM-DD'. */
  customFrom?: string;
  customTo?: string;
  pills: Pill[];
  bookSel: SelEntry[]; // include/not by book id
  catSel: SelEntry[]; // include/not by category NAME (mirrors Browse)
  rating: { value: number; mode: RatingMode } | null; // value in DISPLAY units
  ratingScale: RatingScale;
  /** Made / Not-yet-made chips, each an independent AND predicate. */
  madeStatus: MadeStatus[];
}

export const EMPTY_PLAN_FILTERS: PlanFilters = {
  datePreset: 'all',
  pills: [],
  bookSel: [],
  catSel: [],
  rating: null,
  ratingScale: 10,
  madeStatus: [],
};

/** True when no dimension is active — the caller can skip filtering entirely. */
export function isEmptyPlanFilters(f: PlanFilters): boolean {
  return (
    f.datePreset === 'all' &&
    f.pills.length === 0 &&
    f.bookSel.length === 0 &&
    f.catSel.length === 0 &&
    f.rating === null &&
    f.madeStatus.length === 0
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Resolve a preset to an inclusive {from,to} range on plan.acceptedAt. Anchored
 * presets only set a lower bound — plans can't be accepted in the future, so no
 * upper bound is needed. Boundaries are INCLUSIVE (a plan accepted exactly on
 * `from` passes). `today` is injected for deterministic tests.
 */
export function resolveDateRange(f: PlanFilters, today: string): { from?: string; to?: string } {
  switch (f.datePreset) {
    case 'all':
      return {};
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01` };
    case 'last3Months': {
      const d = fromISO(today);
      d.setMonth(d.getMonth() - 3);
      return { from: toISO(d) };
    }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01` };
    case 'custom':
      return { from: f.customFrom || undefined, to: f.customTo || undefined };
  }
}

export interface PlanLookups {
  recipeById: Map<string, Recipe>;
  bookById: Map<string, Cookbook>;
  /** recipeId → best (max) stored rating 1–10 across its made entries. */
  maxRating: Map<string, number>;
}

/** Build the per-render lookup maps once; reuse across every planMatchesWith call. */
export function buildPlanLookups(recipes: Recipe[], books: Cookbook[], made: MadeEntry[]): PlanLookups {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const bookById = new Map(books.map((b) => [b.id, b]));
  const maxRating = new Map<string, number>();
  for (const e of made) {
    if (e.recipeId === null || e.rating === undefined) continue;
    if ((maxRating.get(e.recipeId) ?? 0) < e.rating) maxRating.set(e.recipeId, e.rating);
  }
  return { recipeById, bookById, maxRating };
}

export function planMatchesWith(plan: Plan, lk: PlanLookups, f: PlanFilters, today: string): boolean {
  // ── date range on acceptedAt ──
  const { from, to } = resolveDateRange(f, today);
  if (from && plan.acceptedAt < from) return false;
  if (to && plan.acceptedAt > to) return false;

  // ── made-status: each selected chip is one more AND predicate ──
  for (const s of f.madeStatus) {
    if (s === 'notmade' && !plan.items.some((i) => i.state === 'open')) return false;
    if (s === 'made' && !plan.items.some((i) => i.state === 'made')) return false;
  }

  // Content filters run over every item's live recipe (deleted recipes drop out).
  const recipes = plan.items
    .map((i) => lk.recipeById.get(i.recipeId))
    .filter((r): r is Recipe => r !== undefined);

  // ── keyword pills: ≥1 recipe matches over name + tags + book tags ──
  if (f.pills.length > 0) {
    const ok = recipes.some((r) => {
      const bookTags = lk.bookById.get(r.bookId)?.tags ?? [];
      return recipeMatches({ name: r.name, tags: [...r.tags, ...bookTags] }, f.pills);
    });
    if (!ok) return false;
  }

  // ── books include / not ──
  const bookIncl = new Set(f.bookSel.filter((e) => !e.neg).map((e) => e.id));
  const bookExcl = new Set(f.bookSel.filter((e) => e.neg).map((e) => e.id));
  if (bookIncl.size > 0 && !recipes.some((r) => bookIncl.has(r.bookId))) return false;
  if (bookExcl.size > 0 && recipes.some((r) => bookExcl.has(r.bookId))) return false;

  // ── categories include / not (keyed by category name) ──
  const catIncl = new Set(f.catSel.filter((e) => !e.neg).map((e) => e.id));
  const catExcl = new Set(f.catSel.filter((e) => e.neg).map((e) => e.id));
  if (catIncl.size > 0 && !recipes.some((r) => catIncl.has(r.category))) return false;
  if (catExcl.size > 0 && recipes.some((r) => catExcl.has(r.category))) return false;

  // ── rating: ≥1 recipe's max rating satisfies the (bin-aware) threshold ──
  const rating = f.rating;
  if (rating) {
    // "and below" reads inclusively in the UI ("★ ≤3" keeps a display-3 recipe);
    // ratingMatches' 'below' is the strict complement of 'above', so +1 shifts
    // it to inclusive — identical to Browse (pinned in rating.test.ts).
    const threshold = rating.mode === 'below' ? rating.value + 1 : rating.value;
    const ok = recipes.some((r) => {
      const max = lk.maxRating.get(r.id);
      return max !== undefined && ratingMatches(max, threshold, rating.mode, f.ratingScale);
    });
    if (!ok) return false;
  }

  return true;
}

/**
 * Pure plan-filter predicate (round-2 amendment 3). Builds the lookup maps from
 * the passed arrays, so it is self-contained for unit tests. Components should
 * build lookups once via buildPlanLookups + call planMatchesWith per plan.
 */
export function planMatches(
  plan: Plan,
  recipes: Recipe[],
  books: Cookbook[],
  made: MadeEntry[],
  filters: PlanFilters,
  today: string = todayISO(),
): boolean {
  return planMatchesWith(plan, buildPlanLookups(recipes, books, made), filters, today);
}
