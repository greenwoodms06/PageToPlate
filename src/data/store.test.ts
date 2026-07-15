import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store } from './store';
import { clearAll, getSettings, putSettings } from './db';
import { DEFAULT_CATEGORIES } from './categories';
import { DEFAULT_SETTINGS } from './types';
import type {
  AttachmentRec,
  Category,
  Cookbook,
  MadeEntry,
  Plan,
  Preset,
  Recipe,
  Settings,
} from './types';

const makeBook = (id: string, name = 'The Joy of Cooking'): Cookbook => ({
  id,
  name,
  tags: [],
  archived: false,
  createdAt: '2026-07-14T00:00:00.000Z',
});

const makeRecipe = (id: string, bookId: string, over: Partial<Recipe> = {}): Recipe => ({
  id,
  bookId,
  name: 'Coq au Vin',
  page: '112',
  category: 'Mains',
  tags: ['chicken'],
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

const makePlan = (id: string, items: Plan['items']): Plan => ({
  id,
  acceptedAt: '2026-07-14T00:00:00.000Z',
  items,
});

const makePreset = (id: string): Preset => ({ id, name: 'Weeknight', bookIds: ['b1'], config: {} });

const makeCategory = (id: string, name: string, order: number): Category => ({
  id,
  name,
  order,
  isDefault: false,
  chips: [],
});

const makeAttachment = (id: string): AttachmentRec => ({
  id,
  blob: new Blob(['photo-bytes'], { type: 'image/png' }),
  name: 'photo.png',
  type: 'image/png',
});

async function initStore(): Promise<Store> {
  const store = new Store();
  await store.init();
  return store;
}

beforeEach(async () => {
  await clearAll();
});

describe('Store.init seeding', () => {
  it('seeds the 11 default categories and default settings on first run', async () => {
    const store = await initStore();
    const cats = store.categories;
    expect(cats).toHaveLength(11);
    cats.forEach((c, i) => {
      expect(c.name).toBe(DEFAULT_CATEGORIES[i].name);
      expect(c.order).toBe(i);
      expect(c.isDefault).toBe(true);
      expect(c.chips).toEqual(DEFAULT_CATEGORIES[i].chips);
      // chips must be a copy — editing a category later must never mutate DEFAULT_CATEGORIES
      expect(c.chips).not.toBe(DEFAULT_CATEGORIES[i].chips);
      expect(c.id).toBeTruthy();
    });
    expect(store.settings).toEqual(DEFAULT_SETTINGS);
    // seeding is re-derivable, not user data — it must not trip the backup nag
    expect(store.settings.changesSinceBackup).toBe(0);
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('does not re-seed or duplicate categories on a second init against the same DB', async () => {
    const first = await initStore();
    const ids = first.categories.map((c) => c.id).sort();
    const second = await initStore();
    expect(second.categories).toHaveLength(11);
    expect(second.categories.map((c) => c.id).sort()).toEqual(ids);
  });

  it('fills fields missing from persisted settings with defaults (pre-ratingScale DBs)', async () => {
    // Simulate settings written before ratingScale existed (Checkpoint 2):
    // hydration must default it to 10 instead of leaving undefined.
    const legacy: Omit<Settings, 'ratingScale'> = { ...DEFAULT_SETTINGS, preferUnmade: false };
    delete (legacy as Partial<Settings>).ratingScale;
    await putSettings(legacy as Settings);
    const store = await initStore();
    expect(store.settings.ratingScale).toBe(10);
    expect(store.settings.preferUnmade).toBe(false); // stored values still win
  });
});

describe('persistence across re-init', () => {
  it('addBook and addRecipes are visible in a fresh Store instance', async () => {
    const store = await initStore();
    const book = makeBook('b1');
    await store.addBook(book);
    await store.addRecipes([makeRecipe('r1', 'b1'), makeRecipe('r2', 'b1', { name: 'Beef Bourguignon' })]);

    const fresh = await initStore();
    expect(fresh.books).toEqual([book]);
    expect(fresh.recipes.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });
});

describe('changesSinceBackup', () => {
  it('every mutator increments the counter by one and persists it', async () => {
    const store = await initStore();
    let expected = 0;
    const bumps = async (fn: () => Promise<void>) => {
      await fn();
      expected += 1;
      expect(store.settings.changesSinceBackup).toBe(expected);
    };

    await bumps(() => store.addBook(makeBook('b1')));
    await bumps(() => store.updateBook('b1', { name: 'Renamed' }));
    await bumps(() => store.addRecipes([makeRecipe('r1', 'b1')]));
    await bumps(() => store.updateRecipe('r1', { page: '99' }));
    await bumps(() => store.addMadeEntry(makeMade('m1', 'r1', '2026-07-01')));
    await bumps(() => store.updateMadeEntry('m1', { rating: 8 }));
    await bumps(() => store.addPlan(makePlan('p1', [{ recipeId: 'r1', state: 'open' }])));
    await bumps(() => store.updatePlan('p1', { items: [{ recipeId: 'r1', state: 'made', madeEntryId: 'm1' }] }));
    await bumps(() => store.savePreset(makePreset('ps1')));
    await bumps(() => store.deletePreset('ps1'));
    await bumps(() => store.addCategory(makeCategory('c1', 'Snacks', 11)));
    await bumps(() => store.updateCategory('c1', { name: 'Snackz' }));
    await bumps(() => store.deleteCategoryReassign('c1', 'Sides'));
    await bumps(() => store.addAttachment(makeAttachment('a1')));
    await bumps(() => store.deleteAttachment('a1'));
    await bumps(() => store.deleteMadeEntry('m1'));
    await bumps(() => store.deleteRecipe('r1'));
    await bumps(() => store.deleteBookHard('b1'));

    expect((await getSettings())?.changesSinceBackup).toBe(expected);
  });

  it('updateSettings persists but does NOT bump the counter (backup reset must not count as a change)', async () => {
    const store = await initStore();
    await store.addBook(makeBook('b1'));
    expect(store.settings.changesSinceBackup).toBe(1);

    await store.updateSettings({ changesSinceBackup: 0, lastBackupAt: '2026-07-14T12:00:00.000Z' });
    expect(store.settings.changesSinceBackup).toBe(0);
    expect(store.settings.lastBackupAt).toBe('2026-07-14T12:00:00.000Z');

    await store.updateSettings({ theme: 'dark' });
    expect(store.settings.changesSinceBackup).toBe(0);
    const persisted = await getSettings();
    expect(persisted?.theme).toBe('dark');
    expect(persisted?.changesSinceBackup).toBe(0);
  });
});

describe('subscribe', () => {
  it('fires exactly once per mutation and stops after unsubscribe', async () => {
    const store = await initStore();
    let calls = 0;
    const unsub = store.subscribe(() => {
      calls += 1;
    });

    await store.addBook(makeBook('b1'));
    expect(calls).toBe(1);
    await store.updateSettings({ theme: 'dark' });
    expect(calls).toBe(2);

    unsub();
    await store.addBook(makeBook('b2'));
    expect(calls).toBe(2);
  });

  it('bumps version on each mutation (useSyncExternalStore snapshot)', async () => {
    const store = await initStore();
    const v0 = store.version;
    await store.addBook(makeBook('b1'));
    expect(store.version).toBeGreaterThan(v0);
  });
});

describe('deleteCategoryReassign', () => {
  it('moves the deleted category\'s recipes to the target name and persists', async () => {
    const store = await initStore();
    await store.addBook(makeBook('b1'));
    await store.addCategory(makeCategory('c1', 'Snacks', 11));
    await store.addRecipes([
      makeRecipe('r1', 'b1', { category: 'Snacks' }),
      makeRecipe('r2', 'b1', { category: 'Snacks' }),
      makeRecipe('r3', 'b1', { category: 'Mains' }),
    ]);

    await store.deleteCategoryReassign('c1', 'Sides');

    expect(store.categories.some((c) => c.name === 'Snacks')).toBe(false);
    expect(store.recipes.find((r) => r.id === 'r1')?.category).toBe('Sides');
    expect(store.recipes.find((r) => r.id === 'r2')?.category).toBe('Sides');
    expect(store.recipes.find((r) => r.id === 'r3')?.category).toBe('Mains');

    const fresh = await initStore();
    expect(fresh.recipes.find((r) => r.id === 'r1')?.category).toBe('Sides');
    expect(fresh.categories.some((c) => c.name === 'Snacks')).toBe(false);
  });
});

describe('deleteBookHard', () => {
  it('deletes the book, its recipes, their made entries, and all attached blobs', async () => {
    const store = await initStore();
    await store.addBook(makeBook('b1'));
    await store.addBook(makeBook('b2'));
    await store.addAttachment(makeAttachment('a1'));
    await store.addAttachment(makeAttachment('a2'));
    await store.addRecipes([
      makeRecipe('r1', 'b1', { attachmentIds: ['a1'] }),
      makeRecipe('r2', 'b2'),
    ]);
    await store.addMadeEntry(makeMade('m1', 'r1', '2026-07-01', { photoIds: ['a2'] }));
    await store.addMadeEntry(makeMade('m2', 'r2', '2026-07-02'));

    await store.deleteBookHard('b1');

    expect(store.books.map((b) => b.id)).toEqual(['b2']);
    expect(store.recipes.map((r) => r.id)).toEqual(['r2']);
    expect(store.madeEntries.map((m) => m.id)).toEqual(['m2']);
    expect(await store.getAttachment('a1')).toBeUndefined();
    expect(await store.getAttachment('a2')).toBeUndefined();
  });
});

// deleteBookKeepHistory (real since Task 10) is pinned in src/logic/orphans.test.ts
// alongside the orphan transform it delegates to.

describe('attachments', () => {
  it('round-trips a blob through addAttachment/getAttachment', async () => {
    const store = await initStore();
    await store.addAttachment(makeAttachment('a1'));
    const rec = await store.getAttachment('a1');
    expect(rec?.name).toBe('photo.png');
    expect(await rec?.blob.text()).toBe('photo-bytes');
    await store.deleteAttachment('a1');
    expect(await store.getAttachment('a1')).toBeUndefined();
  });
});

describe('derived helpers', () => {
  it('madeCountFor / lastMadeFor / plannedRecipeIds', async () => {
    const store = await initStore();
    await store.addBook(makeBook('b1'));
    await store.addRecipes([
      makeRecipe('r1', 'b1'),
      makeRecipe('r2', 'b1', { name: 'Ratatouille' }),
      makeRecipe('r3', 'b1', { name: 'Tarte Tatin' }),
    ]);
    await store.addMadeEntry(makeMade('m1', 'r1', '2026-07-01'));
    await store.addMadeEntry(makeMade('m2', 'r1', '2026-07-10'));
    // orphaned entry (recipeId null) must not crash or count toward any recipe
    await store.addMadeEntry(
      makeMade('m3', null, '2026-07-05', { orphan: { bookTitle: 'Old Book', recipeName: 'Lost Pie', page: '7' } }),
    );
    await store.addPlan(
      makePlan('p1', [
        { recipeId: 'r1', state: 'open' },
        { recipeId: 'r2', state: 'dismissed' },
        { recipeId: 'r3', state: 'made', madeEntryId: 'm2' },
      ]),
    );
    await store.addPlan(makePlan('p2', [{ recipeId: 'r3', state: 'open' }]));

    expect(store.madeCountFor('r1')).toBe(2);
    expect(store.lastMadeFor('r1')).toBe('2026-07-10');
    expect(store.madeCountFor('r2')).toBe(0);
    expect(store.lastMadeFor('r2')).toBeUndefined();
    // only 'open' items count as planned — dismissed and made are filtered out
    expect(store.plannedRecipeIds()).toEqual(new Set(['r1', 'r3']));
  });
});

describe('getter caching', () => {
  it('recipes getter returns a stable array reference until the next mutation', async () => {
    const store = await initStore();
    await store.addRecipes([makeRecipe('r1', 'b1')]);
    const first = store.recipes;
    expect(store.recipes).toBe(first); // Browse calls this per render — must be cached
    await store.updateRecipe('r1', { page: '2' });
    expect(store.recipes).not.toBe(first);
    expect(store.recipes.find((r) => r.id === 'r1')?.page).toBe('2');
  });
});
