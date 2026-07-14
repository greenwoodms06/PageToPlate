import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bulkDel, bulkPut, clearAll, del, get, getAll, getDb, getSettings, put, putSettings } from './db';
import { DEFAULT_SETTINGS, type Recipe } from './types';

const sampleRecipe = (id: string, name = 'Coq au Vin'): Recipe => ({
  id,
  bookId: 'book-1',
  name,
  page: '112',
  category: 'mains',
  tags: ['chicken'],
  status: 'active',
  isCustom: false,
  attachmentIds: [],
  createdAt: '2026-07-14T00:00:00.000Z',
});

beforeEach(async () => {
  await clearAll();
});

describe('db schema', () => {
  it('opening the DB creates all 8 object stores', async () => {
    const db = await getDb();
    expect([...db.objectStoreNames].sort()).toEqual([
      'attachments',
      'books',
      'categories',
      'madeEntries',
      'plans',
      'presets',
      'recipes',
      'settings',
    ]);
  });

  it('creates the expected indexes', async () => {
    const db = await getDb();
    const recipes = db.transaction('recipes').store;
    expect([...recipes.indexNames]).toContain('by-book');
    const made = db.transaction('madeEntries').store;
    expect([...made.indexNames].sort()).toEqual(['by-date', 'by-recipe']);
  });
});

describe('raw CRUD helpers', () => {
  it('put/getAll round-trips a Recipe', async () => {
    const recipe = sampleRecipe('r1');
    await put('recipes', recipe);
    expect(await getAll('recipes')).toEqual([recipe]);
  });

  it('bulkPut/getAll round-trips multiple Recipes', async () => {
    const recipes = [sampleRecipe('r1'), sampleRecipe('r2', 'Beef Bourguignon')];
    await bulkPut('recipes', recipes);
    const all = await getAll('recipes');
    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining(recipes));
  });

  it('del removes a record by id', async () => {
    await put('recipes', sampleRecipe('r1'));
    await del('recipes', 'r1');
    expect(await getAll('recipes')).toEqual([]);
  });

  it('get fetches a single record by id', async () => {
    const recipe = sampleRecipe('r1');
    await put('recipes', recipe);
    expect(await get('recipes', 'r1')).toEqual(recipe);
    expect(await get('recipes', 'missing')).toBeUndefined();
  });

  it('bulkDel removes many records in one transaction', async () => {
    await bulkPut('recipes', [sampleRecipe('r1'), sampleRecipe('r2'), sampleRecipe('r3')]);
    await bulkDel('recipes', ['r1', 'r3']);
    expect((await getAll('recipes')).map((r) => r.id)).toEqual(['r2']);
  });

  it('stores settings under the literal key "app"', async () => {
    expect(await getSettings()).toBeUndefined();
    await putSettings({ ...DEFAULT_SETTINGS, preferUnmade: false });
    const settings = await getSettings();
    expect(settings?.preferUnmade).toBe(false);
    const db = await getDb();
    expect(await db.getKey('settings', 'app')).toBe('app');
  });

  it('clearAll empties every store', async () => {
    await put('recipes', sampleRecipe('r1'));
    await putSettings(DEFAULT_SETTINGS);
    await clearAll();
    expect(await getAll('recipes')).toEqual([]);
    expect(await getSettings()).toBeUndefined();
  });
});
