import { describe, expect, it } from 'vitest';
import {
  applyBookFilters,
  cuisineOptions,
  emptyBookFilter,
  isFilterActive,
  yearBounds,
  type BookFilterState,
  type FilterableItem,
} from './BookFilters';

const ITEMS: FilterableItem[] = [
  { id: 'atk', title: 'ATK TV Show Cookbook', author: "America's Test Kitchen", year: 2025, cuisines: ['american'] },
  { id: 'esc', title: 'A Guide to Modern Cookery', author: 'Escoffier', year: 1907, cuisines: ['french'] },
  { id: 'chin', title: 'The Chinese Cook Book', author: 'Chan', year: 1917, cuisines: ['chinese'] },
  { id: 'user', title: 'My Recipe Notebook', cuisines: [] }, // user book: no year, no cuisine
];

const filter = (over: Partial<BookFilterState>): BookFilterState => ({ ...emptyBookFilter, ...over });
const ids = (items: FilterableItem[]) => items.map((i) => i.id).sort();

describe('applyBookFilters', () => {
  it('empty filter shows everything', () => {
    expect(applyBookFilters(ITEMS, emptyBookFilter)).toHaveLength(4);
  });

  it('text search matches title, author and cuisine', () => {
    expect(ids(applyBookFilters(ITEMS, filter({ q: 'escoffier' })))).toEqual(['esc']);
    expect(ids(applyBookFilters(ITEMS, filter({ q: 'chinese' })))).toEqual(['chin']); // cuisine + title
    expect(ids(applyBookFilters(ITEMS, filter({ q: 'american' })))).toEqual(['atk']); // cuisine only
    expect(ids(applyBookFilters(ITEMS, filter({ q: 'notebook' })))).toEqual(['user']);
  });

  it('cuisine include keeps items carrying an included cuisine (OR)', () => {
    expect(ids(applyBookFilters(ITEMS, filter({ cuisine: [{ id: 'french', neg: false }] })))).toEqual(['esc']);
    expect(
      ids(applyBookFilters(ITEMS, filter({ cuisine: [{ id: 'french', neg: false }, { id: 'chinese', neg: false }] }))),
    ).toEqual(['chin', 'esc']);
  });

  it('cuisine not excludes items carrying that cuisine', () => {
    expect(ids(applyBookFilters(ITEMS, filter({ cuisine: [{ id: 'american', neg: true }] })))).toEqual([
      'chin',
      'esc',
      'user',
    ]);
  });

  it('full year span keeps no-year books; narrowing the span drops them', () => {
    // yearFrom/yearTo null = full span → the user book (no year) is still shown.
    expect(applyBookFilters(ITEMS, filter({ yearFrom: null, yearTo: null }))).toHaveLength(4);
    // Narrow the low end to 1910: esc (1907) out, user (no year) out, atk + chin in.
    expect(ids(applyBookFilters(ITEMS, filter({ yearFrom: 1910 })))).toEqual(['atk', 'chin']);
    // Narrow the high end to 1920: atk (2025) out, user out; esc + chin in.
    expect(ids(applyBookFilters(ITEMS, filter({ yearTo: 1920 })))).toEqual(['chin', 'esc']);
    // A tight window around the two historical books.
    expect(ids(applyBookFilters(ITEMS, filter({ yearFrom: 1900, yearTo: 1918 })))).toEqual(['chin', 'esc']);
  });

  it('combines text + cuisine + year predicates (AND)', () => {
    const f = filter({ q: 'cook', cuisine: [{ id: 'chinese', neg: false }], yearFrom: 1910, yearTo: 1920 });
    expect(ids(applyBookFilters(ITEMS, f))).toEqual(['chin']);
  });
});

describe('cuisineOptions / yearBounds', () => {
  it('lists distinct cuisines alphabetically (dynamic, no static list)', () => {
    expect(cuisineOptions(ITEMS)).toEqual(['american', 'chinese', 'french']);
  });

  it('derives real min/max years from the list', () => {
    expect(yearBounds(ITEMS)).toEqual({ min: 1907, max: 2025 });
  });

  it('returns null bounds when no item carries a year', () => {
    expect(yearBounds([{ id: 'u', title: 'x', cuisines: [] }])).toBeNull();
  });
});

describe('isFilterActive', () => {
  it('is false only for the empty filter', () => {
    expect(isFilterActive(emptyBookFilter)).toBe(false);
    expect(isFilterActive(filter({ q: 'x' }))).toBe(true);
    expect(isFilterActive(filter({ cuisine: [{ id: 'french', neg: false }] }))).toBe(true);
    expect(isFilterActive(filter({ yearFrom: 1950 }))).toBe(true);
  });
});
