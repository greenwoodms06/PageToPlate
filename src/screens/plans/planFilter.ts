// Plan filtering predicate (round-2 amendment 3). A plan is SHOWN when it
// satisfies EVERY active filter dimension (AND across dimensions); empty
// filters = all plans. Content filters (keyword / book / category / rating)
// operate over the recipes referenced by ALL of the plan's items — the plan is
// "about" those recipes, so a keyword or book match against any one of them
// keeps the whole plan. These stay PLAN-LEVEL gates: they decide which plans
// appear, they never hide individual rows.
//
// The Made pill is the exception on two counts: it reads item STATE, and in
// per-recipe scope it ALSO hides the rows that don't match its state (amendment
// 3b/3c). evaluatePlan therefore returns both a match flag and the set of
// recipe rows to render.
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

/**
 * A date-window cycle chip (round-2b): 'off' imposes no constraint, 'in' keeps
 * plans accepted WITHIN the window (daysAgo ≤ N), 'out' keeps plans accepted
 * BEYOND it (daysAgo > N). Past month uses N = 30, Past year N = 365. The two
 * chips + any custom range AND together (a plan must satisfy each active one).
 */
export type DateWindowSel = 'off' | 'in' | 'out';
export type RatingMode = 'above' | 'exact' | 'below';
/** Single 3-state Made pill: off (no filter) → made → not-made → off. */
export type MadeSel = 'off' | 'made' | 'notmade';
/** Made-pill scope. 'recipe' (default) hides non-matching rows within a shown
 *  plan; 'plan' keeps every row of a qualifying plan. Only matters when made ≠ off. */
export type MadeScope = 'recipe' | 'plan';

export interface PlanFilters {
  /** "Past month" cycle chip — within/beyond 30 days of acceptedAt. */
  pastMonth: DateWindowSel;
  /** "Past year" cycle chip — within/beyond 365 days of acceptedAt. */
  pastYear: DateWindowSel;
  /** Whether the custom-range panel is active. Its bounds only gate when true. */
  custom: boolean;
  /** Custom range bounds, 'YYYY-MM-DD', inclusive. Only applied when custom. */
  customFrom?: string;
  customTo?: string;
  pills: Pill[];
  bookSel: SelEntry[]; // include/not by book id
  catSel: SelEntry[]; // include/not by category NAME (mirrors Browse)
  rating: { value: number; mode: RatingMode } | null; // value in DISPLAY units
  ratingScale: RatingScale;
  /** 3-state Made pill (round-2 amendment 3b), lives on the count row. */
  made: MadeSel;
  /** Per-recipe (default) vs per-plan row hiding for the Made pill (amendment 3c). */
  madeScope: MadeScope;
}

export const EMPTY_PLAN_FILTERS: PlanFilters = {
  pastMonth: 'off',
  pastYear: 'off',
  custom: false,
  pills: [],
  bookSel: [],
  catSel: [],
  rating: null,
  ratingScale: 10,
  made: 'off',
  madeScope: 'recipe',
};

/** True when no dimension is active — the caller can skip filtering entirely.
 *  madeScope is deliberately ignored: it has no effect while made === 'off'.
 *  An open-but-empty custom panel is treated as active (harmless no-op filter). */
export function isEmptyPlanFilters(f: PlanFilters): boolean {
  return (
    f.pastMonth === 'off' &&
    f.pastYear === 'off' &&
    !f.custom &&
    f.pills.length === 0 &&
    f.bookSel.length === 0 &&
    f.catSel.length === 0 &&
    f.rating === null &&
    f.made === 'off'
  );
}

/**
 * Whole days between an accepted date and today, both 'YYYY-MM-DD'. Parsed at
 * UTC midnight so the result is an exact integer, independent of DST. A plan
 * accepted today → 0; exactly 30 calendar days earlier → 30.
 */
export function daysAgo(acceptedAt: string, today: string): number {
  const a = Date.parse(`${acceptedAt}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  return Math.round((t - a) / 86_400_000);
}

/** A single window chip's verdict. 'off' never constrains; 'in' = daysAgo ≤ n
 *  (within/last), 'out' = daysAgo > n (beyond). */
function windowOk(sel: DateWindowSel, days: number, n: number): boolean {
  if (sel === 'off') return true;
  return sel === 'in' ? days <= n : days > n;
}

export interface PlanLookups {
  recipeById: Map<string, Recipe>;
  bookById: Map<string, Cookbook>;
  /** recipeId → best (max) stored rating 1–10 across its made entries. */
  maxRating: Map<string, number>;
}

/** Build the per-render lookup maps once; reuse across every evaluatePlan call. */
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

export interface PlanMatch {
  /** Passes every plan-level gate (date, keyword, book, category, rating, made). */
  match: boolean;
  /**
   * recipeIds to render for a matching plan. Equals ALL of the plan's items
   * unless the Made pill is active in per-recipe scope, in which case only the
   * rows in the pill's state (made→'made', not-made→'open') are kept. Empty
   * when match is false. Threaded to PlanCard to hide non-matching rows.
   */
  visibleRecipeIds: Set<string>;
}

const NO_MATCH: PlanMatch = { match: false, visibleRecipeIds: new Set() };

/**
 * Evaluate a plan against the filters: does it show, and if so which of its
 * recipe rows are visible. Plan-level gates (date / keyword / book / category /
 * rating / made) decide visibility; only the Made pill in per-recipe scope
 * hides individual rows (round-2 amendment 3b/3c).
 */
export function evaluatePlan(plan: Plan, lk: PlanLookups, f: PlanFilters, today: string): PlanMatch {
  // ── date constraints on acceptedAt — the two window chips AND with the
  //    optional custom range; each active constraint must pass (round-2b). ──
  const days = daysAgo(plan.acceptedAt, today);
  if (!windowOk(f.pastMonth, days, 30)) return NO_MATCH;
  if (!windowOk(f.pastYear, days, 365)) return NO_MATCH;
  if (f.custom) {
    if (f.customFrom && plan.acceptedAt < f.customFrom) return NO_MATCH;
    if (f.customTo && plan.acceptedAt > f.customTo) return NO_MATCH;
  }

  // ── made-status plan-level gate: ≥1 item in the pill's state ──
  // "made" = an item with state 'made'; "not made" = state 'open' (dismissed
  // items are neither).
  if (f.made === 'made' && !plan.items.some((i) => i.state === 'made')) return NO_MATCH;
  if (f.made === 'notmade' && !plan.items.some((i) => i.state === 'open')) return NO_MATCH;

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
    if (!ok) return NO_MATCH;
  }

  // ── books include / not ──
  const bookIncl = new Set(f.bookSel.filter((e) => !e.neg).map((e) => e.id));
  const bookExcl = new Set(f.bookSel.filter((e) => e.neg).map((e) => e.id));
  if (bookIncl.size > 0 && !recipes.some((r) => bookIncl.has(r.bookId))) return NO_MATCH;
  if (bookExcl.size > 0 && recipes.some((r) => bookExcl.has(r.bookId))) return NO_MATCH;

  // ── categories include / not (keyed by category name) ──
  const catIncl = new Set(f.catSel.filter((e) => !e.neg).map((e) => e.id));
  const catExcl = new Set(f.catSel.filter((e) => e.neg).map((e) => e.id));
  if (catIncl.size > 0 && !recipes.some((r) => catIncl.has(r.category))) return NO_MATCH;
  if (catExcl.size > 0 && recipes.some((r) => catExcl.has(r.category))) return NO_MATCH;

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
    if (!ok) return NO_MATCH;
  }

  // ── which rows render: per-recipe scope keeps only the pill's state ──
  const visibleRecipeIds =
    f.made !== 'off' && f.madeScope === 'recipe'
      ? new Set(
          plan.items.filter((i) => i.state === (f.made === 'made' ? 'made' : 'open')).map((i) => i.recipeId),
        )
      : new Set(plan.items.map((i) => i.recipeId));

  return { match: true, visibleRecipeIds };
}

/** Boolean-only view of evaluatePlan — keeps terse call sites and existing tests. */
export function planMatchesWith(plan: Plan, lk: PlanLookups, f: PlanFilters, today: string): boolean {
  return evaluatePlan(plan, lk, f, today).match;
}

/**
 * Pure plan-filter predicate (round-2 amendment 3). Builds the lookup maps from
 * the passed arrays, so it is self-contained for unit tests. Components should
 * build lookups once via buildPlanLookups + call evaluatePlan per plan.
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

/** evaluatePlan variant that builds its own lookups — self-contained for tests. */
export function evaluatePlanFrom(
  plan: Plan,
  recipes: Recipe[],
  books: Cookbook[],
  made: MadeEntry[],
  filters: PlanFilters,
  today: string = todayISO(),
): PlanMatch {
  return evaluatePlan(plan, buildPlanLookups(recipes, books, made), filters, today);
}
