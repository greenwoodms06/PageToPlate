// Task 10 (spec rule 8): deleting a book with "keep history" orphans its
// MadeEntries — recipeId nulled, human-readable snapshot kept — and re-adding
// a similar book offers to reconnect them. Matching is conservative: fuzzy on
// the BOOK title (token-set Jaccard >= 0.5), exact-after-normalization on the
// RECIPE name, page only as a tiebreak. Unmatched entries stay orphaned —
// never guessed.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { findReassociation, orphanBook, titleSimilarity } from './orphans';
import { Store } from '../data/store';
import { clearAll } from '../data/db';
import type { Cookbook, MadeEntry, Recipe } from '../data/types';

const makeBook = (id: string, name: string): Cookbook => ({
  id,
  name,
  tags: [],
  archived: false,
  createdAt: '2026-07-14T00:00:00.000Z',
});

const makeRecipe = (id: string, bookId: string, name: string, page = '1', over: Partial<Recipe> = {}): Recipe => ({
  id,
  bookId,
  name,
  page,
  category: 'Mains',
  tags: [],
  status: 'active',
  isCustom: false,
  attachmentIds: [],
  createdAt: '2026-07-14T00:00:00.000Z',
  ...over,
});

const makeMade = (id: string, recipeId: string | null, date: string, over: Partial<MadeEntry> = {}): MadeEntry => ({
  id,
  recipeId,
  date,
  photoIds: [],
  ...over,
});

const orphanEntry = (id: string, bookTitle: string, recipeName: string, page: string): MadeEntry =>
  makeMade(id, null, '2026-07-01', { orphan: { bookTitle, recipeName, page } });

describe('orphanBook (pure transform)', () => {
  it("nulls recipeId on the book's entries and snapshots {bookTitle, recipeName, page}", () => {
    const book = makeBook('b1', 'Joy of Cooking');
    const recipes = [makeRecipe('r1', 'b1', 'Coq au Vin', '112'), makeRecipe('r2', 'b1', 'Brownies', '200')];
    const entries = [
      makeMade('m1', 'r1', '2026-07-01', { rating: 8 }),
      makeMade('m2', 'r2', '2026-07-02', { photoIds: ['a1'] }),
      makeMade('m3', 'other-recipe', '2026-07-03'), // different book — untouched
      orphanEntry('m4', 'Older Book', 'Lost Pie', '7'), // already orphaned — untouched
    ];

    const orphaned = orphanBook(book, recipes, entries);

    expect(orphaned.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
    const m1 = orphaned.find((m) => m.id === 'm1')!;
    expect(m1.recipeId).toBeNull();
    expect(m1.orphan).toEqual({ bookTitle: 'Joy of Cooking', recipeName: 'Coq au Vin', page: '112' });
    expect(m1.rating).toBe(8); // history fields survive
    const m2 = orphaned.find((m) => m.id === 'm2')!;
    expect(m2.orphan).toEqual({ bookTitle: 'Joy of Cooking', recipeName: 'Brownies', page: '200' });
    expect(m2.photoIds).toEqual(['a1']); // cooked-photo references survive

    // Pure: the inputs are not mutated.
    expect(entries[0].recipeId).toBe('r1');
    expect(entries[0].orphan).toBeUndefined();
  });
});

describe('titleSimilarity (token-set Jaccard, threshold 0.5)', () => {
  it("matches 'Joy of Cooking' vs 'The Joy of Cooking (1975)'", () => {
    // tokens {joy, cooking} vs {joy, cooking, 1975} → 2/3
    expect(titleSimilarity('Joy of Cooking', 'The Joy of Cooking (1975)')).toBeGreaterThanOrEqual(0.5);
  });

  it("does not match 'Joy of Cooking' vs 'Moosewood Cookbook'", () => {
    expect(titleSimilarity('Joy of Cooking', 'Moosewood Cookbook')).toBeLessThan(0.5);
  });

  it('is case- and punctuation-insensitive', () => {
    expect(titleSimilarity('JOY, OF COOKING!!!', 'joy of cooking')).toBe(1);
  });

  it('ignores the stopwords: the a an of book cookbook', () => {
    expect(titleSimilarity('The Bread Book', 'An Of A Bread Cookbook')).toBe(1);
  });
});

describe('findReassociation', () => {
  const newBook = makeBook('nb1', 'The Joy of Cooking (1975)');

  it('pairs orphan entries to new recipes by normalized name when the book title fuzzy-matches', () => {
    const orphans = [
      orphanEntry('m1', 'Joy of Cooking', '  Coq  au  VIN ', '112'), // messy whitespace/case still pairs
      orphanEntry('m2', 'Joy of Cooking', 'Vanished Terrine', '55'), // no such recipe → stays orphaned
    ];
    const newRecipes = [makeRecipe('nr1', 'nb1', 'Coq au Vin', '108'), makeRecipe('nr2', 'nb1', 'Brownies', '200')];

    const { titleMatch, pairs } = findReassociation(orphans, newBook, newRecipes);

    expect(titleMatch).toBe(true);
    expect(pairs).toEqual([{ entryId: 'm1', recipeId: 'nr1' }]); // m2 never guessed
  });

  it('breaks recipe-name ties by page', () => {
    const orphans = [orphanEntry('m1', 'Joy of Cooking', 'Brownies', '200')];
    const newRecipes = [makeRecipe('nr1', 'nb1', 'Brownies', '10'), makeRecipe('nr2', 'nb1', 'Brownies', '200')];

    const { pairs } = findReassociation(orphans, newBook, newRecipes);

    expect(pairs).toEqual([{ entryId: 'm1', recipeId: 'nr2' }]);
  });

  it('returns titleMatch false and no pairs for an unrelated book', () => {
    const orphans = [orphanEntry('m1', 'Moosewood Cookbook', 'Coq au Vin', '112')];
    const newRecipes = [makeRecipe('nr1', 'nb1', 'Coq au Vin', '112')];

    const { titleMatch, pairs } = findReassociation(orphans, newBook, newRecipes);

    expect(titleMatch).toBe(false);
    expect(pairs).toEqual([]);
  });

  it('ignores entries that are not orphaned', () => {
    const live = makeMade('m1', 'some-live-recipe', '2026-07-01');
    const newRecipes = [makeRecipe('nr1', 'nb1', 'Coq au Vin', '112')];

    const { titleMatch, pairs } = findReassociation([live], newBook, newRecipes);

    expect(titleMatch).toBe(false);
    expect(pairs).toEqual([]);
  });
});

describe('store.deleteBookKeepHistory (wiring)', () => {
  beforeEach(async () => {
    await clearAll();
  });

  async function seededStore(): Promise<Store> {
    const store = new Store();
    await store.init();
    await store.addBook(makeBook('b1', 'Joy of Cooking'));
    await store.addBook(makeBook('b2', 'Moosewood Cookbook'));
    await store.addAttachment({ id: 'att-recipe', blob: new Blob([new Uint8Array([1])]), name: 'clip.jpg', type: 'image/jpeg' });
    await store.addAttachment({ id: 'att-photo', blob: new Blob([new Uint8Array([2])]), name: 'dinner.jpg', type: 'image/jpeg' });
    await store.addRecipes([
      makeRecipe('r1', 'b1', 'Coq au Vin', '112', { attachmentIds: ['att-recipe'] }),
      makeRecipe('r2', 'b2', 'Lentil Soup', '30'),
    ]);
    await store.addMadeEntry(makeMade('m1', 'r1', '2026-07-01', { rating: 9, photoIds: ['att-photo'] }));
    await store.addMadeEntry(makeMade('m2', 'r2', '2026-07-02'));
    return store;
  }

  it('deletes the book and its recipes but converts their MadeEntries to orphans, and persists', async () => {
    const store = await seededStore();
    const changesBefore = store.settings.changesSinceBackup;

    await store.deleteBookKeepHistory('b1');

    expect(store.books.map((b) => b.id)).toEqual(['b2']);
    expect(store.recipes.map((r) => r.id)).toEqual(['r2']);

    const m1 = store.madeEntries.find((m) => m.id === 'm1')!;
    expect(m1.recipeId).toBeNull();
    expect(m1.orphan).toEqual({ bookTitle: 'Joy of Cooking', recipeName: 'Coq au Vin', page: '112' });
    expect(m1.rating).toBe(9);
    // Other books' history untouched.
    expect(store.madeEntries.find((m) => m.id === 'm2')?.recipeId).toBe('r2');

    // Deleting is a backup-worthy change.
    expect(store.settings.changesSinceBackup).toBe(changesBefore + 1);

    // Persisted: a fresh Store sees the orphaned entry, not the book.
    const fresh = new Store();
    await fresh.init();
    expect(fresh.books.map((b) => b.id)).toEqual(['b2']);
    const freshM1 = fresh.madeEntries.find((m) => m.id === 'm1')!;
    expect(freshM1.recipeId).toBeNull();
    expect(freshM1.orphan?.recipeName).toBe('Coq au Vin');
  });

  it('keeps made-entry photos (they ARE history) but deletes dead recipe attachments', async () => {
    const store = await seededStore();

    await store.deleteBookKeepHistory('b1');

    expect(await store.getAttachment('att-photo')).toBeDefined(); // cooked photo survives with the entry
    expect(await store.getAttachment('att-recipe')).toBeUndefined(); // its recipe is gone — no leak
  });

  it('is a no-op for an unknown book id', async () => {
    const store = await seededStore();
    await expect(store.deleteBookKeepHistory('nope')).resolves.toBeUndefined();
    expect(store.books).toHaveLength(2);
  });
});
