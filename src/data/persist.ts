// Persistent-storage request on first meaningful use (plan Task 12 Step 3,
// spec Rule 11): once the user has real data (the first book exists), ask the
// browser to protect IndexedDB from eviction. Guards:
//   - at most one request per session (module flag),
//   - never re-asks once granted (settings.persistGranted),
//   - no-ops where the API is missing (jsdom/node, older browsers) — the flag
//     still trips so the session doesn't re-check on every store change.
// The result (granted OR denied) is stored via updateSettings; a denied result
// leaves persistGranted false, so a later session asks again — persist() is
// promptless in Chromium and heuristic-gated elsewhere, so retrying is cheap.
import type { Store } from './store';

type PersistFn = () => Promise<boolean>;

let requestedThisSession = false;

/** Test seam: clears the once-per-session guard between tests. */
export function resetPersistGuardForTests(): void {
  requestedThisSession = false;
}

const browserPersist: PersistFn | undefined =
  typeof navigator !== 'undefined' && navigator.storage?.persist
    ? () => navigator.storage.persist()
    : undefined;

/**
 * Call once after store.init(). Checks immediately (data may already exist)
 * and re-checks on every store change (catches the first book/import).
 * `persist` is injectable for tests; defaults to navigator.storage.persist.
 */
export function requestPersistOnFirstUse(store: Store, persist: PersistFn | undefined = browserPersist): void {
  const check = () => {
    if (requestedThisSession) return;
    if (store.settings.persistGranted) return;
    if (store.books.length === 0) return;
    requestedThisSession = true;
    void persist?.().then(
      (granted) => store.updateSettings({ persistGranted: granted }),
      () => {}, // request itself failed: leave unset, retry next session
    );
  };
  check();
  store.subscribe(check);
}
