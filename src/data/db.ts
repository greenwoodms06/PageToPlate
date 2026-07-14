// Thin raw IndexedDB layer over `idb`. No semantics here — the memory-first
// Store (src/data/store.ts, Task 5) owns defaults, invariants, and derived state.
import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type StoreNames,
  type StoreValue,
} from 'idb';
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

interface P2PSchema extends DBSchema {
  books: { key: string; value: Cookbook };
  recipes: { key: string; value: Recipe; indexes: { 'by-book': string } };
  // by-recipe skips orphaned entries (recipeId: null is not a valid index key) — intended.
  madeEntries: { key: string; value: MadeEntry; indexes: { 'by-recipe': string; 'by-date': string } };
  plans: { key: string; value: Plan };
  categories: { key: string; value: Category };
  presets: { key: string; value: Preset };
  attachments: { key: string; value: AttachmentRec };
  // Settings is a single record. The interface has no `id` field, so this store
  // is keyPath-less and the record lives under the explicit literal key 'app'
  // (see getSettings/putSettings). Chosen over adding an artificial id to keep
  // types.ts exactly the shape the rest of the app uses.
  settings: { key: 'app'; value: Settings };
}

export type P2PStoreName = StoreNames<P2PSchema>;

const ID_STORES = ['books', 'recipes', 'madeEntries', 'plans', 'categories', 'presets', 'attachments'] as const;
export const STORE_NAMES: readonly P2PStoreName[] = [...ID_STORES, 'settings'];

let dbPromise: Promise<IDBPDatabase<P2PSchema>> | undefined;

export function getDb(): Promise<IDBPDatabase<P2PSchema>> {
  dbPromise ??= openDB<P2PSchema>('pagetoplate', 1, {
    upgrade(db) {
      db.createObjectStore('books', { keyPath: 'id' });
      const recipes = db.createObjectStore('recipes', { keyPath: 'id' });
      recipes.createIndex('by-book', 'bookId');
      const made = db.createObjectStore('madeEntries', { keyPath: 'id' });
      made.createIndex('by-recipe', 'recipeId');
      made.createIndex('by-date', 'date');
      db.createObjectStore('plans', { keyPath: 'id' });
      db.createObjectStore('categories', { keyPath: 'id' });
      db.createObjectStore('presets', { keyPath: 'id' });
      db.createObjectStore('attachments', { keyPath: 'id' });
      db.createObjectStore('settings'); // out-of-line key: literal 'app'
    },
  });
  return dbPromise;
}

export async function getAll<S extends P2PStoreName>(store: S): Promise<StoreValue<P2PSchema, S>[]> {
  return (await getDb()).getAll(store);
}

export async function put<S extends Exclude<P2PStoreName, 'settings'>>(
  store: S,
  val: StoreValue<P2PSchema, S>,
): Promise<void> {
  await (await getDb()).put(store, val);
}

export async function bulkPut<S extends Exclude<P2PStoreName, 'settings'>>(
  store: S,
  vals: StoreValue<P2PSchema, S>[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store, 'readwrite');
  for (const v of vals) void tx.store.put(v);
  await tx.done;
}

export async function del(store: Exclude<P2PStoreName, 'settings'>, id: string): Promise<void> {
  await (await getDb()).delete(store, id);
}

export async function getSettings(): Promise<Settings | undefined> {
  return (await getDb()).get('settings', 'app');
}

export async function putSettings(settings: Settings): Promise<void> {
  await (await getDb()).put('settings', settings, 'app');
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...STORE_NAMES], 'readwrite');
  for (const name of STORE_NAMES) void tx.objectStore(name).clear();
  await tx.done;
}
