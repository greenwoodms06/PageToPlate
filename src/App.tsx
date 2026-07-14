// App shell (plan Task 12): store-init gate with loading splash, theme applied
// from settings, hand-rolled hash routing, bottom nav, global toast provider,
// and the first-meaningful-use persistent-storage request.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, useStore } from './data/store';
import { requestPersistOnFirstUse } from './data/persist';
import { applyTheme, watchSystemTheme } from './theme';
import { BottomNav, type Tab } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import { GenerateTab } from './screens/generate/GenerateTab';
import { PlansTab } from './screens/plans/PlansTab';
import { BrowseTab } from './screens/browse/BrowseTab';
import { BooksTab } from './screens/books/BooksTab';
import { SettingsHome } from './screens/settings/SettingsHome';
import { DevGallery } from './screens/DevGallery';

// ── hash routing ────────────────────────────────────────────────────────────

function useHash(): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    },
    () => window.location.hash,
  );
}

type Route = { tab: Tab } | { tab: 'settings'; sub?: string } | { tab: 'dev' };

function parseRoute(hash: string): Route {
  const [seg, sub] = hash.replace(/^#\/?/, '').split('/');
  if (seg === 'plans' || seg === 'browse' || seg === 'books') return { tab: seg };
  if (seg === 'settings') return { tab: 'settings', sub: sub || undefined };
  // Component gallery (Task 13) — kept in production: harmless and useful.
  if (seg === 'dev') return { tab: 'dev' };
  return { tab: 'generate' }; // default for '', '#/generate' and unknown hashes
}

// ── init gate ────────────────────────────────────────────────────────────────

// Shared across mounts: StrictMode runs effects twice in dev, and init()'s
// first-run category seeding is guarded only by store emptiness — two
// concurrent init() calls would double-seed. One promise, however many mounts.
let initPromise: Promise<void> | null = null;

// DEV-only escape hatch for Playwright/manual console assertions against live
// state (e.g. "recipe X is status excluded"). Compile-time false in prod.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __store?: typeof store }).__store = store;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    initPromise ??= store.init().then(() => {
      requestPersistOnFirstUse(store);
    });
    void initPromise.then(() => setReady(true));
    // No cleanup: watchSystemTheme has no unsubscribe; a StrictMode double
    // registration only means applyTheme runs twice — it is idempotent.
    watchSystemTheme(() => store.settings.theme);
  }, []);

  // Applies the stored pref once init flips `theme`, and again whenever the
  // Settings screen changes it later.
  useEffect(() => applyTheme(theme), [theme]);

  const route = parseRoute(useHash());

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--paper)',
        }}
      >
        <div className="screen-title">PageToPlate</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      {route.tab === 'generate' && <GenerateTab />}
      {route.tab === 'plans' && <PlansTab />}
      {route.tab === 'browse' && <BrowseTab />}
      {route.tab === 'books' && <BooksTab />}
      {route.tab === 'settings' && <SettingsHome sub={route.sub} />}
      {route.tab === 'dev' && <DevGallery />}
      {/* Settings has no bottom nav in the design (canvas 4a: back arrow
          instead); the dev gallery isn't a tab either. */}
      {route.tab !== 'settings' && route.tab !== 'dev' && <BottomNav active={route.tab} />}
    </ToastProvider>
  );
}
