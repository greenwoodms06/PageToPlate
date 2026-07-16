// Plan filter predicate tests (round-2 amendment 3): date-range boundaries,
// keyword via book-tag inheritance, book/category include+not, rating over the
// best entry, made vs not-yet-made state, and empty = all.
import { describe, expect, it } from 'vitest';
import type { Cookbook, MadeEntry, Plan, Recipe } from '../../data/types';
import { EMPTY_PLAN_FILTERS, isEmptyPlanFilters, planMatches, resolveDateRange } from './planFilter';
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
// Plan accepted 4 months ago (this year, outside last-3-months), all made, bk2.
const planOld: Plan = {
  id: 'p2',
  acceptedAt: '2026-03-16',
  items: [{ recipeId: 'r-cake', state: 'made', madeEntryId: 'm-r-cake-2026-06-01' }],
};

const match = (plan: Plan, patch: Partial<PlanFilters>) =>
  planMatches(plan, recipes, books, madeEntries, { ...EMPTY_PLAN_FILTERS, ...patch }, TODAY);

// ── empty = all ─────────────────────────────────────────────────────────
describe('empty filters', () => {
  it('is detected by isEmptyPlanFilters', () => {
    expect(isEmptyPlanFilters(EMPTY_PLAN_FILTERS)).toBe(true);
    expect(isEmptyPlanFilters({ ...EMPTY_PLAN_FILTERS, madeStatus: ['made'] })).toBe(false);
  });
  it('match every plan when no dimension is active', () => {
    expect(match(planThisMonth, {})).toBe(true);
    expect(match(planOld, {})).toBe(true);
  });
});

// ── date range boundaries ───────────────────────────────────────────────
describe('date range', () => {
  it('resolves preset lower bounds against the injected today', () => {
    expect(resolveDateRange({ ...EMPTY_PLAN_FILTERS, datePreset: 'thisMonth' }, TODAY)).toEqual({ from: '2026-07-01' });
    expect(resolveDateRange({ ...EMPTY_PLAN_FILTERS, datePreset: 'last3Months' }, TODAY)).toEqual({ from: '2026-04-16' });
    expect(resolveDateRange({ ...EMPTY_PLAN_FILTERS, datePreset: 'thisYear' }, TODAY)).toEqual({ from: '2026-01-01' });
    expect(resolveDateRange({ ...EMPTY_PLAN_FILTERS, datePreset: 'all' }, TODAY)).toEqual({});
  });

  it('this month keeps a plan accepted this month, drops an older one', () => {
    expect(match(planThisMonth, { datePreset: 'thisMonth' })).toBe(true);
    expect(match(planOld, { datePreset: 'thisMonth' })).toBe(false);
  });

  it('this month boundary is inclusive on the 1st', () => {
    const onFirst: Plan = { ...planThisMonth, acceptedAt: '2026-07-01' };
    const dayBefore: Plan = { ...planThisMonth, acceptedAt: '2026-06-30' };
    expect(match(onFirst, { datePreset: 'thisMonth' })).toBe(true);
    expect(match(dayBefore, { datePreset: 'thisMonth' })).toBe(false);
  });

  it('last 3 months boundary is inclusive on the from-date', () => {
    const onBoundary: Plan = { ...planThisMonth, acceptedAt: '2026-04-16' };
    const dayBefore: Plan = { ...planThisMonth, acceptedAt: '2026-04-15' };
    expect(match(onBoundary, { datePreset: 'last3Months' })).toBe(true);
    expect(match(dayBefore, { datePreset: 'last3Months' })).toBe(false);
  });

  it('this year keeps the 4-months-ago plan but drops last year', () => {
    expect(match(planOld, { datePreset: 'thisYear' })).toBe(true);
    const lastYear: Plan = { ...planOld, acceptedAt: '2025-12-31' };
    expect(match(lastYear, { datePreset: 'thisYear' })).toBe(false);
  });

  it('custom range applies both bounds inclusively', () => {
    expect(match(planOld, { datePreset: 'custom', customFrom: '2026-03-01', customTo: '2026-03-31' })).toBe(true);
    expect(match(planOld, { datePreset: 'custom', customFrom: '2026-03-17' })).toBe(false); // acceptedAt 03-16
    expect(match(planOld, { datePreset: 'custom', customTo: '2026-03-15' })).toBe(false);
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

// ── made-status ──────────────────────────────────────────────────────────
describe('made status', () => {
  it('not-yet-made keeps plans with ≥1 open item', () => {
    expect(match(planThisMonth, { madeStatus: ['notmade'] })).toBe(true); // has an open item
    expect(match(planOld, { madeStatus: ['notmade'] })).toBe(false); // all made
  });
  it('made keeps plans with ≥1 made item', () => {
    expect(match(planThisMonth, { madeStatus: ['made'] })).toBe(true);
    expect(match(planOld, { madeStatus: ['made'] })).toBe(true);
    const allOpen: Plan = { id: 'p4', acceptedAt: '2026-07-05', items: [{ recipeId: 'r-broccoli', state: 'open' }] };
    expect(match(allOpen, { madeStatus: ['made'] })).toBe(false);
  });
  it('both chips AND together → only partially-cooked plans (≥1 made AND ≥1 open)', () => {
    expect(match(planThisMonth, { madeStatus: ['made', 'notmade'] })).toBe(true); // has both
    expect(match(planOld, { madeStatus: ['made', 'notmade'] })).toBe(false); // no open item
  });
});

// ── cross-dimension AND ──────────────────────────────────────────────────
describe('cross-dimension', () => {
  it('requires ALL active dimensions to pass', () => {
    // this month + chicken → planThisMonth passes; adding a rating floor above 9 drops it.
    expect(match(planThisMonth, { datePreset: 'thisMonth', pills: [{ text: 'chicken', neg: false }] })).toBe(true);
    expect(
      match(planThisMonth, {
        datePreset: 'thisMonth',
        pills: [{ text: 'chicken', neg: false }],
        rating: { value: 10, mode: 'above' },
      }),
    ).toBe(false);
  });
});
