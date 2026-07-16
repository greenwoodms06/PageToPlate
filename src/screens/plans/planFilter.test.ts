// Plan filter predicate tests (round-2b): cyclable date-window boundaries (Past
// month at 30 days, Past year at 365, the two ANDing into a day band), keyword
// via book-tag inheritance, book/category include+not, rating over the best
// entry, the 3-state Made pill + per-recipe/per-plan visible rows, empty = all.
import { describe, expect, it } from 'vitest';
import type { Cookbook, MadeEntry, Plan, Recipe } from '../../data/types';
import { EMPTY_PLAN_FILTERS, daysAgo, evaluatePlanFrom, isEmptyPlanFilters, planMatches } from './planFilter';
import type { PlanFilters } from './planFilter';

const TODAY = '2026-07-16';

const book = (id: string, name: string, tags: string[] = []): Cookbook => ({
  id,
  name,
  tags,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const recipe = (id: string, bookId: string, name: string, category: string, tags: string[] = []): Recipe => ({
  id,
  bookId,
  name,
  page: '1',
  category,
  tags,
  status: 'active',
  isCustom: false,
  attachmentIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

const made = (recipeId: string, date: string, rating?: number): MadeEntry => ({
  id: `m-${recipeId}-${date}`,
  recipeId,
  date,
  rating,
  photoIds: [],
});

// ── fixtures ──────────────────────────────────────────────────────────────
const books: Cookbook[] = [book('bk1', 'Weeknight', ['quick']), book('bk2', 'Baking', ['vegetarian'])];
const recipes: Recipe[] = [
  recipe('r-chicken', 'bk1', 'Skillet Chicken Thighs', 'Mains', ['chicken']),
  recipe('r-broccoli', 'bk1', 'Charred Broccoli', 'Sides', ['vegetable']),
  recipe('r-cake', 'bk2', 'Lemon Cake', 'Desserts', ['cake']),
];
const madeEntries: MadeEntry[] = [made('r-chicken', '2026-07-10', 9), made('r-cake', '2026-06-01', 4)];

// Plan accepted this month with one made + two open items (bk1 recipes only).
const planThisMonth: Plan = {
  id: 'p1',
  acceptedAt: '2026-07-05',
  items: [
    { recipeId: 'r-chicken', state: 'made', madeEntryId: 'm-r-chicken-2026-07-10' },
    { recipeId: 'r-broccoli', state: 'open' },
  ],
};
// Plan accepted 4 months ago (this year, well outside the rolling 30 days), all made, bk2.
const planOld: Plan = {
  id: 'p2',
  acceptedAt: '2026-03-16',
  items: [{ recipeId: 'r-cake', state: 'made', madeEntryId: 'm-r-cake-2026-06-01' }],
};
// 3 recipes, exactly ONE made — the per-recipe row-hiding fixture (amendment 3c).
const planTrio: Plan = {
  id: 'p5',
  acceptedAt: '2026-07-05',
  items: [
    { recipeId: 'r-chicken', state: 'made', madeEntryId: 'm-r-chicken-2026-07-10' },
    { recipeId: 'r-broccoli', state: 'open' },
    { recipeId: 'r-cake', state: 'open' },
  ],
};

const match = (plan: Plan, patch: Partial<PlanFilters>) =>
  planMatches(plan, recipes, books, madeEntries, { ...EMPTY_PLAN_FILTERS, ...patch }, TODAY);
const evaluate = (plan: Plan, patch: Partial<PlanFilters>) =>
  evaluatePlanFrom(plan, recipes, books, madeEntries, { ...EMPTY_PLAN_FILTERS, ...patch }, TODAY);

// ── empty = all ─────────────────────────────────────────────────────────
describe('empty filters', () => {
  it('is detected by isEmptyPlanFilters', () => {
    expect(isEmptyPlanFilters(EMPTY_PLAN_FILTERS)).toBe(true);
    expect(isEmptyPlanFilters({ ...EMPTY_PLAN_FILTERS, made: 'made' })).toBe(false);
    // madeScope alone never counts as active — it only matters when made ≠ off.
    expect(isEmptyPlanFilters({ ...EMPTY_PLAN_FILTERS, madeScope: 'plan' })).toBe(true);
  });
  it('match every plan when no dimension is active', () => {
    expect(match(planThisMonth, {})).toBe(true);
    expect(match(planOld, {})).toBe(true);
  });
});

// ── date windows: cyclable Past month / Past year + custom (round-2b) ───────
describe('daysAgo helper', () => {
  it('counts whole calendar days, DST-independent', () => {
    expect(daysAgo('2026-07-16', TODAY)).toBe(0); // today
    expect(daysAgo('2026-06-16', TODAY)).toBe(30); // exactly 30 days ago
    expect(daysAgo('2026-06-15', TODAY)).toBe(31); // 31 days ago
    expect(daysAgo('2025-07-16', TODAY)).toBe(365); // exactly a year ago
    expect(daysAgo('2025-07-15', TODAY)).toBe(366);
  });
});

describe('date windows', () => {
  it('Past month "in" keeps ≤30-day plans, "out" keeps >30-day plans', () => {
    expect(match(planThisMonth, { pastMonth: 'in' })).toBe(true); // 07-05 → 11 days
    expect(match(planOld, { pastMonth: 'in' })).toBe(false); // 03-16 → 122 days
    expect(match(planThisMonth, { pastMonth: 'out' })).toBe(false);
    expect(match(planOld, { pastMonth: 'out' })).toBe(true);
  });

  it('Past month boundary sits at 30 days (30 in, 31 out)', () => {
    const at30: Plan = { ...planThisMonth, acceptedAt: '2026-06-16' }; // daysAgo 30
    const at31: Plan = { ...planThisMonth, acceptedAt: '2026-06-15' }; // daysAgo 31
    expect(match(at30, { pastMonth: 'in' })).toBe(true);
    expect(match(at30, { pastMonth: 'out' })).toBe(false);
    expect(match(at31, { pastMonth: 'in' })).toBe(false);
    expect(match(at31, { pastMonth: 'out' })).toBe(true);
  });

  it('Past year boundary sits at 365 days', () => {
    const at365: Plan = { ...planOld, acceptedAt: '2025-07-16' }; // daysAgo 365
    const at366: Plan = { ...planOld, acceptedAt: '2025-07-15' }; // daysAgo 366
    expect(match(at365, { pastYear: 'in' })).toBe(true);
    expect(match(at366, { pastYear: 'in' })).toBe(false);
    expect(match(at366, { pastYear: 'out' })).toBe(true);
  });

  it('not-Past-month + Past-year AND into a 30–365-day band', () => {
    const band = { pastMonth: 'out' as const, pastYear: 'in' as const };
    expect(match(planOld, band)).toBe(true); // 122 days → inside the band
    expect(match(planThisMonth, band)).toBe(false); // 11 days → too recent (fails not-Past-month)
    const ancient: Plan = { ...planOld, acceptedAt: '2024-01-01' }; // >365 days → fails Past-year
    expect(match(ancient, band)).toBe(false);
  });

  it('a contradictory combo (Past-month in + Past-year out) yields no plans', () => {
    const impossible = { pastMonth: 'in' as const, pastYear: 'out' as const };
    expect(match(planThisMonth, impossible)).toBe(false);
    expect(match(planOld, impossible)).toBe(false);
  });

  it('custom range applies both bounds inclusively when active', () => {
    expect(match(planOld, { custom: true, customFrom: '2026-03-01', customTo: '2026-03-31' })).toBe(true);
    expect(match(planOld, { custom: true, customFrom: '2026-03-17' })).toBe(false); // acceptedAt 03-16
    expect(match(planOld, { custom: true, customTo: '2026-03-15' })).toBe(false);
    // bounds are inert unless the custom panel is active.
    expect(match(planOld, { custom: false, customFrom: '2026-03-17' })).toBe(true);
  });

  it('custom range ANDs with a window chip', () => {
    // Past-year in (≤365) AND a March window → planOld (122 days, 03-16) passes;
    // Past-month in (≤30) would contradict the 122-day plan → drops it.
    expect(match(planOld, { pastYear: 'in', custom: true, customFrom: '2026-03-01', customTo: '2026-03-31' })).toBe(true);
    expect(match(planOld, { pastMonth: 'in', custom: true, customFrom: '2026-03-01', customTo: '2026-03-31' })).toBe(false);
  });
});

// ── keyword pills (with book-tag inheritance) ────────────────────────────
describe('keyword pills', () => {
  it('matches a plan when ≥1 recipe name/tag matches', () => {
    expect(match(planThisMonth, { pills: [{ text: 'chicken', neg: false }] })).toBe(true);
    expect(match(planOld, { pills: [{ text: 'chicken', neg: false }] })).toBe(false);
  });

  it('inherits book tags (book "Baking" tagged vegetarian → its cake plan matches)', () => {
    // r-cake has no "vegetarian" tag of its own; only book bk2 does.
    expect(match(planOld, { pills: [{ text: 'vegetarian', neg: false }] })).toBe(true);
    expect(match(planThisMonth, { pills: [{ text: 'vegetarian', neg: false }] })).toBe(false);
  });

  it('honors a negated pill (plan matches if ≥1 recipe lacks the term)', () => {
    // planThisMonth has broccoli (no "chicken") → "not chicken" is satisfiable.
    expect(match(planThisMonth, { pills: [{ text: 'chicken', neg: true }] })).toBe(true);
  });
});

// ── books / categories include + not ─────────────────────────────────────
describe('book and category filters', () => {
  it('include keeps plans with ≥1 recipe in an included book', () => {
    expect(match(planThisMonth, { bookSel: [{ id: 'bk1', neg: false }] })).toBe(true);
    expect(match(planOld, { bookSel: [{ id: 'bk1', neg: false }] })).toBe(false);
  });
  it('not-book drops a plan that touches the excluded book', () => {
    expect(match(planThisMonth, { bookSel: [{ id: 'bk1', neg: true }] })).toBe(false);
    expect(match(planOld, { bookSel: [{ id: 'bk1', neg: true }] })).toBe(true);
  });
  it('category include/not works by name', () => {
    expect(match(planThisMonth, { catSel: [{ id: 'Mains', neg: false }] })).toBe(true);
    expect(match(planOld, { catSel: [{ id: 'Mains', neg: false }] })).toBe(false);
    expect(match(planOld, { catSel: [{ id: 'Desserts', neg: true }] })).toBe(false);
  });
});

// ── rating (over the best entry) ─────────────────────────────────────────
describe('rating filter', () => {
  it('matches when ≥1 recipe max rating is at/above the threshold', () => {
    // r-chicken best is 9.
    expect(match(planThisMonth, { rating: { value: 8, mode: 'above' } })).toBe(true);
    expect(match(planThisMonth, { rating: { value: 10, mode: 'above' } })).toBe(false);
  });
  it('below is inclusive in UI terms (cake best 4 passes "≤4")', () => {
    expect(match(planOld, { rating: { value: 4, mode: 'below' } })).toBe(true);
    expect(match(planOld, { rating: { value: 3, mode: 'below' } })).toBe(false);
  });
  it('an unrated recipe never satisfies a rating filter', () => {
    const noRatings: Plan = { id: 'p3', acceptedAt: '2026-07-05', items: [{ recipeId: 'r-broccoli', state: 'open' }] };
    expect(match(noRatings, { rating: { value: 1, mode: 'above' } })).toBe(false);
  });
});

// ── made pill: plan-level gate ─────────────────────────────────────────────
describe('made pill (plan-level gate)', () => {
  it('not-made keeps plans with ≥1 open item', () => {
    expect(match(planThisMonth, { made: 'notmade' })).toBe(true); // has an open item
    expect(match(planOld, { made: 'notmade' })).toBe(false); // all made
  });
  it('made keeps plans with ≥1 made item', () => {
    expect(match(planThisMonth, { made: 'made' })).toBe(true);
    expect(match(planOld, { made: 'made' })).toBe(true);
    const allOpen: Plan = { id: 'p4', acceptedAt: '2026-07-05', items: [{ recipeId: 'r-broccoli', state: 'open' }] };
    expect(match(allOpen, { made: 'made' })).toBe(false);
  });
  it('off applies no made gate', () => {
    expect(match(planThisMonth, { made: 'off' })).toBe(true);
    expect(match(planOld, { made: 'off' })).toBe(true);
  });
});

// ── made pill: per-recipe vs per-plan visible rows (amendment 3c) ───────────
describe('made pill scope (visible rows)', () => {
  it('off leaves every row visible (no row hiding)', () => {
    const r = evaluate(planTrio, { made: 'off' });
    expect(r.match).toBe(true);
    expect(r.visibleRecipeIds.size).toBe(3);
  });
  it('per-recipe "not Made" on a 3-recipe/1-made plan shows exactly the 2 open rows', () => {
    const r = evaluate(planTrio, { made: 'notmade', madeScope: 'recipe' });
    expect(r.match).toBe(true);
    expect([...r.visibleRecipeIds].sort()).toEqual(['r-broccoli', 'r-cake']);
  });
  it('per-plan "not Made" shows ALL 3 rows', () => {
    const r = evaluate(planTrio, { made: 'notmade', madeScope: 'plan' });
    expect(r.match).toBe(true);
    expect(r.visibleRecipeIds.size).toBe(3);
  });
  it('per-recipe "Made" shows only the one made row', () => {
    const r = evaluate(planTrio, { made: 'made', madeScope: 'recipe' });
    expect(r.match).toBe(true);
    expect([...r.visibleRecipeIds]).toEqual(['r-chicken']);
  });
  it('a fully-made plan under per-recipe "not Made" disappears', () => {
    const r = evaluate(planOld, { made: 'notmade', madeScope: 'recipe' });
    expect(r.match).toBe(false);
    expect(r.visibleRecipeIds.size).toBe(0);
  });
});

// ── cross-dimension AND ──────────────────────────────────────────────────
describe('cross-dimension', () => {
  it('requires ALL active dimensions to pass', () => {
    // Past month + chicken → planThisMonth passes; adding a rating floor above 9 drops it.
    expect(match(planThisMonth, { pastMonth: 'in', pills: [{ text: 'chicken', neg: false }] })).toBe(true);
    expect(
      match(planThisMonth, {
        pastMonth: 'in',
        pills: [{ text: 'chicken', neg: false }],
        rating: { value: 10, mode: 'above' },
      }),
    ).toBe(false);
  });
});
