// Guard logic for the persistent-storage request (plan Task 12 Step 3).
// The browser side (navigator.storage.persist actually being called by a real
// browser) is not runnable here — jsdom/node has no navigator.storage — so the
// persist function is injected and only the guards are under test.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from './store';
import { clearAll } from './db';
import { requestPersistOnFirstUse, resetPersistGuardForTests } from './persist';
import type { Cookbook } from './types';

const makeBook = (id: string): Cookbook => ({
  id,
  name: 'The Joy of Cooking',
  tags: [],
  archived: false,
  createdAt: '2026-07-14T00:00:00.000Z',
});

async function freshStore(): Promise<Store> {
  const store = new Store();
  await store.init();
  return store;
}

describe('requestPersistOnFirstUse', () => {
  beforeEach(async () => {
    await clearAll();
    resetPersistGuardForTests();
  });

  it('does not request while no book exists', async () => {
    const store = await freshStore();
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    requestPersistOnFirstUse(store, persist);
    await store.updateSettings({ preferUnmade: false }); // unrelated change
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests once when the first book appears and stores the result', async () => {
    const store = await freshStore();
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    requestPersistOnFirstUse(store, persist);

    await store.addBook(makeBook('b1'));
    expect(persist).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(store.settings.persistGranted).toBe(true));

    await store.addBook(makeBook('b2')); // more changes: still once per session
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('requests immediately when data already exists at call time', async () => {
    const store = await freshStore();
    await store.addBook(makeBook('b1'));
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    requestPersistOnFirstUse(store, persist);
    expect(persist).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(store.settings.persistGranted).toBe(false));
  });

  it('never asks again once granted (across sessions)', async () => {
    const store = await freshStore();
    await store.addBook(makeBook('b1'));
    await store.updateSettings({ persistGranted: true });
    resetPersistGuardForTests(); // simulate a new session
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    requestPersistOnFirstUse(store, persist);
    await store.addBook(makeBook('b2'));
    expect(persist).not.toHaveBeenCalled();
  });

  it('trips the session guard even when the API is unavailable', async () => {
    const store = await freshStore();
    await store.addBook(makeBook('b1'));
    // persist === undefined (no navigator.storage): must not throw, and the
    // result stays unset so a capable session can ask later.
    requestPersistOnFirstUse(store, undefined);
    await store.addBook(makeBook('b2'));
    expect(store.settings.persistGranted).toBeUndefined();
  });
});
