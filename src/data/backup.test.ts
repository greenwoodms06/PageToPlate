// Task 10 (spec rules 8, 11): backup is a versioned full export; restore is
// REPLACE, never merge. With photo attachments the export becomes a zip
// (backup.json + photos/<id>) so blobs survive the round trip byte-for-byte.
//
// fake-indexeddb note: attachment blobs are constructed from Uint8Array and
// read back via arrayBuffer() — Blob.text()/stream() behave inconsistently
// across fake-indexeddb's structured-clone, raw bytes do not.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { Store } from './store';
import { clearAll } from './db';
import { exportBackup, markBackedUp, restoreBackup } from './backup';
import { todayISO } from './types';
import type { Cookbook, MadeEntry, Plan, Preset, Recipe } from './types';

const makeBook = (id: string, name = 'The Joy of Cooking'): Cookbook => ({
  id,
  name,
  tags: ['classic'],
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

const makePreset = (id: string): Preset => ({
  id,
  name: 'Weeknight',
  bookIds: ['b1'],
  config: { Mains: { count: 2, pills: [{ text: 'chicken', neg: false }] } },
});

const PHOTO_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 42]);

async function initStore(): Promise<Store> {
  const store = new Store();
  await store.init();
  return store;
}

/** Populate a representative slice of every store. */
async function seed(store: Store): Promise<void> {
  await store.addBook(makeBook('b1'));
  await store.addRecipes([
    // Recipe-level notes (round-1 amendment 1) ride whole-recipe serialization.
    makeRecipe('r1', 'b1', { notes: 'Halve the salt; owner prefers thigh meat.' }),
    makeRecipe('r2', 'b1', { name: 'Beef Bourguignon', page: '90', status: 'excluded' }),
  ]);
  await store.addMadeEntry(makeMade('m1', 'r1', '2026-07-01', { rating: 8, notes: 'great' }));
  await store.addMadeEntry(
    makeMade('m2', null, '2026-06-01', { orphan: { bookTitle: 'Old Book', recipeName: 'Lost Pie', page: '7' } }),
  );
  await store.addPlan(makePlan('p1', [{ recipeId: 'r1', state: 'open' }]));
  await store.savePreset(makePreset('ps1'));
  await store.updateSettings({ theme: 'dark', preferUnmade: false });
}

type Snapshot = ReturnType<typeof snapshot>;
function snapshot(store: Store) {
  return {
    books: store.books,
    recipes: store.recipes,
    madeEntries: store.madeEntries,
    plans: store.plans,
    categories: store.categories,
    presets: store.presets,
    settings: store.settings,
  };
}

function expectMatches(store: Store, expected: Snapshot): void {
  expect(store.books).toEqual(expected.books);
  expect(store.recipes).toEqual(expected.recipes);
  expect(store.madeEntries).toEqual(expected.madeEntries);
  expect(store.plans).toEqual(expected.plans);
  expect(store.categories).toEqual(expected.categories);
  expect(store.presets).toEqual(expected.presets);
  expect(store.settings).toEqual(expected.settings);
}

beforeEach(async () => {
  await clearAll();
});

describe('exportBackup (no attachments → plain JSON)', () => {
  it('produces pagetoplate-backup-YYYY-MM-DD.json carrying schemaVersion 1 and every store', async () => {
    const store = await initStore();
    await seed(store);

    const { blob, filename } = await exportBackup(store);

    // .ptp.txt costume: Chromium Web Share allowlist excludes .json/.zip
    // (P2P-005) — see the force-comment in backup.ts before changing this.
    expect(filename).toBe(`pagetoplate-backup-${todayISO()}.ptp.txt`);
    expect(blob.type).toBe('text/plain');
    const payload = JSON.parse(strFromU8(new Uint8Array(await blob.arrayBuffer())));
    expect(payload.schemaVersion).toBe(1); // Rule 11: backups are versioned
    expect(payload.books).toHaveLength(1);
    expect(payload.recipes).toHaveLength(2);
    expect(payload.madeEntries).toHaveLength(2);
    expect(payload.plans).toHaveLength(1);
    expect(payload.categories).toHaveLength(11);
    expect(payload.presets).toHaveLength(1);
    expect(payload.settings.theme).toBe('dark');
  });

  it('export alone does NOT mark backed up (a cancelled share must keep the nudge)', async () => {
    const store = await initStore();
    await seed(store);
    const changesBefore = store.settings.changesSinceBackup;
    expect(changesBefore).toBeGreaterThan(0);

    await exportBackup(store);

    expect(store.settings.lastBackupAt).toBeUndefined();
    expect(store.settings.changesSinceBackup).toBe(changesBefore);
  });

  it('markBackedUp sets lastBackupAt and resets changesSinceBackup', async () => {
    const store = await initStore();
    await seed(store);

    const { exportedAt } = await exportBackup(store);
    await markBackedUp(store, exportedAt);

    expect(store.settings.lastBackupAt).toBe(exportedAt);
    expect(store.settings.changesSinceBackup).toBe(0);
  });
});

describe('restoreBackup (JSON round trip)', () => {
  it('export → pollute → restore reproduces every store exactly (restore is replace)', async () => {
    const store = await initStore();
    await seed(store);

    const { blob, exportedAt } = await exportBackup(store);
    await markBackedUp(store, exportedAt); // file "delivered" — restore compares against marked state
    const expected = snapshot(store);

    // Pollute: data added after the backup must vanish on restore.
    await store.addBook(makeBook('junk', 'Junk Book'));
    await store.addRecipes([makeRecipe('junk-r', 'junk')]);

    await restoreBackup(store, blob);

    expectMatches(store, expected);
    expect(store.books.some((b) => b.id === 'junk')).toBe(false);
    // Recipe notes survive the round trip (round-1 amendment 1) — pinned
    // explicitly, not just via toEqual, so this fails loudly if notes are
    // ever split out of whole-recipe serialization.
    expect(store.recipes.find((r) => r.id === 'r1')?.notes).toBe('Halve the salt; owner prefers thigh meat.');

    // And it actually hit IndexedDB — a fresh Store sees the restored state.
    const fresh = await initStore();
    expectMatches(fresh, expected);
  });

  it('rejects an unsupported schemaVersion without touching existing data', async () => {
    const store = await initStore();
    await seed(store);
    const before = snapshot(store);

    const bad = new Blob([JSON.stringify({ schemaVersion: 2, books: [] })], { type: 'application/json' });
    await expect(restoreBackup(store, bad)).rejects.toThrow(/schemaVersion/);

    expectMatches(store, before);
  });
});

describe('backup with attachments (zip round trip)', () => {
  it('exports a .zip containing backup.json + photos/<id>, detected by PK magic bytes', async () => {
    const store = await initStore();
    await seed(store);
    await store.addAttachment({
      id: 'a1',
      blob: new Blob([PHOTO_BYTES], { type: 'image/jpeg' }),
      name: 'dinner.jpg',
      type: 'image/jpeg',
    });

    const { blob, filename } = await exportBackup(store);

    // Zip content wearing the same .ptp.txt name — restore sniffs PK bytes.
    expect(filename).toBe(`pagetoplate-backup-${todayISO()}.ptp.txt`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'

    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(['backup.json', 'photos/a1']);
    const payload = JSON.parse(strFromU8(entries['backup.json']));
    expect(payload.schemaVersion).toBe(1);
    expect(Array.from(entries['photos/a1'])).toEqual(Array.from(PHOTO_BYTES));
  });

  it('restoring the zip restores attachment blobs byte-for-byte with name and type', async () => {
    const store = await initStore();
    await seed(store);
    await store.addAttachment({
      id: 'a1',
      blob: new Blob([PHOTO_BYTES], { type: 'image/jpeg' }),
      name: 'dinner.jpg',
      type: 'image/jpeg',
    });
    await store.updateRecipe('r1', { attachmentIds: ['a1'] });

    const { blob, exportedAt } = await exportBackup(store);
    await markBackedUp(store, exportedAt); // file "delivered" — restore compares against marked state
    const expected = snapshot(store);

    // Wipe attachment + pollute, then restore the zip.
    await store.deleteAttachment('a1');
    await store.addBook(makeBook('junk', 'Junk Book'));
    expect(await store.getAttachment('a1')).toBeUndefined();

    await restoreBackup(store, blob);

    expectMatches(store, expected);
    const rec = await store.getAttachment('a1');
    expect(rec).toBeDefined();
    expect(rec?.name).toBe('dinner.jpg');
    expect(rec?.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await rec!.blob.arrayBuffer()))).toEqual(Array.from(PHOTO_BYTES));
  });
});
