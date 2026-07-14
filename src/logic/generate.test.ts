import { describe, expect, it } from 'vitest';
import type { CatConfig, Cookbook } from '../data/types';
import type { Candidate, GenGroup } from './generate';
import { availability, eligible, generate, pick, regenerate } from './generate';

// Deterministic rng so shuffle order is reproducible across runs.
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const book = (id: string, over: Partial<Cookbook> = {}): Cookbook => ({
  id, name: id, tags: [], archived: false, createdAt: '2026-07-14T00:00:00.000Z', ...over,
});

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, bookId: 'b1', name: id, page: '1', category: 'Mains', tags: [],
  status: 'active', isCustom: false, attachmentIds: [],
  createdAt: '2026-07-14T00:00:00.000Z', madeCount: 0, ...over,
});

const ids = (cards: GenGroup['cards']) => cards.map(c => c.recipe.id);
const cfg = (count: number, pills: CatConfig['pills'] = []): CatConfig => ({ count, pills });

describe('eligible (Rules 2, 3)', () => {
  it('excludes excluded recipes, archived books, unselected books, wrong category', () => {
    const books = [book('b1'), book('b2', { archived: true }), book('b3')];
    const bookIds = ['b1', 'b2']; // b3 not selected
    const recipes = [
      cand('ok'),
      cand('excluded-status', { status: 'excluded' }),
      cand('in-archived-book', { bookId: 'b2' }),
      cand('in-unselected-book', { bookId: 'b3' }),
      cand('wrong-category', { category: 'Desserts' }),
    ];
    expect(eligible(recipes, books, bookIds, 'Mains', []).map(r => r.id)).toEqual(['ok']);
  });

  it('excludes recipes that do not match the pills', () => {
    const books = [book('b1')];
    const recipes = [
      cand('beef-stew', { name: 'Beef Stew' }),
      cand('tofu-bowl', { name: 'Tofu Bowl' }),
      cand('beef-tagged', { name: 'Mystery Braise', tags: ['beef'] }),
    ];
    const out = eligible(recipes, books, ['b1'], 'Mains', [{ text: 'beef', neg: false }]);
    expect(out.map(r => r.id)).toEqual(['beef-stew', 'beef-tagged']);
  });
});

describe('pick', () => {
  it('prefer-unmade takes all unmade first (3 unmade + 3 made, count 3)', () => {
    const pool = [
      cand('made-1', { madeCount: 2, lastMade: '2026-01-01' }),
      cand('unmade-1'),
      cand('made-2', { madeCount: 1, lastMade: '2026-02-01' }),
      cand('unmade-2'),
      cand('made-3', { madeCount: 4, lastMade: '2026-03-01' }),
      cand('unmade-3'),
    ];
    const picked = pick(pool, 3, true, mulberry32(1));
    expect(picked.map(r => r.id).sort()).toEqual(['unmade-1', 'unmade-2', 'unmade-3']);
  });

  it('all-made pool orders by oldest lastMade first (Rule 5)', () => {
    const pool = [
      cand('jan', { madeCount: 1, lastMade: '2026-01-05' }),
      cand('mar', { madeCount: 2, lastMade: '2026-03-01' }),
      cand('dec', { madeCount: 1, lastMade: '2025-12-25' }),
      cand('feb', { madeCount: 3, lastMade: '2026-02-10' }),
    ];
    // distinct dates ⇒ deterministic regardless of rng (stable sort after shuffle)
    expect(pick(pool, 2, true, mulberry32(7)).map(r => r.id)).toEqual(['dec', 'jan']);
    expect(pick(pool, 4, true, mulberry32(42)).map(r => r.id)).toEqual(['dec', 'jan', 'feb', 'mar']);
  });
});

describe('generate (Rules 2, 9)', () => {
  it('returns partial pool with the exact availability note (Rule 9)', () => {
    const books = [book('b1')];
    const recipes = [cand('only-beef', { name: 'Beef Stew' }), cand('tofu', { name: 'Tofu Bowl' })];
    const groups = generate(recipes, books, ['b1'],
      { Mains: cfg(3, [{ text: 'beef', neg: false }]) }, true, mulberry32(1));
    expect(groups).toHaveLength(1);
    expect(ids(groups[0].cards)).toEqual(['only-beef']);
    expect(groups[0].note).toBe('Only 1 of 3 requested match your filters — showing what\'s available.');
  });

  it('has no note when the pool covers the request', () => {
    const books = [book('b1')];
    const recipes = [cand('a'), cand('b'), cand('c')];
    const [g] = generate(recipes, books, ['b1'], { Mains: cfg(2) }, true, mulberry32(1));
    expect(g.cards).toHaveLength(2);
    expect(g.note).toBeNull();
  });

  it('skips categories with count 0', () => {
    const books = [book('b1')];
    const recipes = [cand('a'), cand('d', { category: 'Desserts' })];
    const groups = generate(recipes, books, ['b1'],
      { Mains: cfg(0), Desserts: cfg(1) }, true, mulberry32(1));
    expect(groups.map(g => g.category)).toEqual(['Desserts']);
  });

  it('scopes pills per category: a beef pill on Mains never affects Desserts (Rule 2)', () => {
    const books = [book('b1')];
    const recipes = [
      cand('beef-stew', { name: 'Beef Stew' }),
      cand('tofu-bowl', { name: 'Tofu Bowl' }),
      cand('choc-cake', { name: 'Chocolate Cake', category: 'Desserts' }),
      cand('apple-pie', { name: 'Apple Pie', category: 'Desserts' }),
    ];
    const groups = generate(recipes, books, ['b1'], {
      Mains: cfg(2, [{ text: 'beef', neg: false }]),
      Desserts: cfg(2),
    }, true, mulberry32(1));
    const mains = groups.find(g => g.category === 'Mains')!;
    const desserts = groups.find(g => g.category === 'Desserts')!;
    expect(ids(mains.cards)).toEqual(['beef-stew']);
    expect(ids(desserts.cards).sort()).toEqual(['apple-pie', 'choc-cake']);
    expect(desserts.note).toBeNull();
  });
});

describe('regenerate (Rule 3)', () => {
  const books = [book('b1')];
  const group = (cards: GenGroup['cards'], note: string | null = null): GenGroup =>
    ({ category: 'Mains', want: cards.length, cards, note });

  it('replaces only rejected cards; kept cards stay put', () => {
    const a = cand('a'), b = cand('b'), c = cand('c');
    const groups = [group([{ recipe: a, status: 'kept' }, { recipe: b, status: 'rejected' }])];
    const out = regenerate(groups, [a, b, c], books, ['b1'],
      { Mains: cfg(2) }, new Set(['b']), true, mulberry32(1));
    expect(ids(out[0].cards)).toEqual(['a', 'c']);
    expect(out[0].cards.every(card => card.status === 'kept')).toBe(true);
    expect(out[0].note).toBeNull();
  });

  it('leaves groups without rejections untouched', () => {
    const a = cand('a'), b = cand('b');
    const g = group([{ recipe: a, status: 'kept' }]);
    const out = regenerate([g], [a, b], books, ['b1'],
      { Mains: cfg(1) }, new Set(), true, mulberry32(1));
    expect(out[0]).toBe(g);
  });

  it('never re-deals session-rejected or currently-shown recipes', () => {
    const a = cand('a'), b = cand('b'), c = cand('c'), d = cand('d');
    const groups = [group([{ recipe: a, status: 'kept' }, { recipe: b, status: 'rejected' }])];
    // a is shown, b and d are session-rejected ⇒ only c is dealable
    const out = regenerate(groups, [a, b, c, d], books, ['b1'],
      { Mains: cfg(2) }, new Set(['b', 'd']), true, mulberry32(1));
    expect(ids(out[0].cards)).toEqual(['a', 'c']);
  });

  it('emits the exact pool-exhausted note when dry', () => {
    const a = cand('a'), b = cand('b');
    const groups = [group([{ recipe: a, status: 'kept' }, { recipe: b, status: 'rejected' }])];
    const out = regenerate(groups, [a, b], books, ['b1'],
      { Mains: cfg(2) }, new Set(['b']), true, mulberry32(1));
    expect(ids(out[0].cards)).toEqual(['a']);
    expect(out[0].note).toBe('No more matches to replace 1 rejected — pool exhausted.');
  });
});

describe('availability', () => {
  it('counts eligible recipes for a category and pill set', () => {
    const books = [book('b1')];
    const recipes = [
      cand('beef-stew', { name: 'Beef Stew' }),
      cand('tofu-bowl', { name: 'Tofu Bowl' }),
      cand('choc-cake', { name: 'Chocolate Cake', category: 'Desserts' }),
    ];
    expect(availability(recipes, books, ['b1'], 'Mains', [])).toBe(2);
    expect(availability(recipes, books, ['b1'], 'Mains', [{ text: 'beef', neg: false }])).toBe(1);
    expect(availability(recipes, books, ['b1'], 'Desserts', [])).toBe(1);
  });
});
