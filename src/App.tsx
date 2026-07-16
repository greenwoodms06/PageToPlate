// App shell (plan Task 12): store-init gate with loading splash, theme applied
// from settings, hand-rolled hash routing, bottom nav, global toast provider,
// and the first-meaningful-use persistent-storage request.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, useStore } from './data/store';
import { requestPersistOnFirstUse } from './data/persist';
import { applyTheme, watchSystemTheme } from './theme';
import { BottomNav, type Tab } from './components/BottomNav';
import { ToastProvider, useToast } from './components/Toast';
import { TabPager } from './components/TabPager';
import { GenerateTab } from './screens/generate/GenerateTab';
import { PlansTab } from './screens/plans/PlansTab';
import { BrowseTab } from './screens/browse/BrowseTab';
import { BooksTab } from './screens/books/BooksTab';
import { BookDetail } from './screens/books/BookDetail';
import { SettingsHome, BACKUP_OVERDUE_DAYS, daysSince } from './screens/settings/SettingsHome';
import { AiImportHelp } from './screens/settings/AiImportHelp';
import { ChipsEditor } from './screens/settings/ChipsEditor';
import { CategoriesEditor } from './screens/settings/CategoriesEditor';
import { PresetsEditor } from './screens/settings/PresetsEditor';
import { BackupRestore } from './screens/settings/BackupRestore';
import { DevGallery } from './screens/DevGallery';
import appIconSvg from './assets/app-icon.svg?raw';

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

type Route = { tab: Tab; sub?: string } | { tab: 'settings'; sub?: string } | { tab: 'dev' };

function parseRoute(hash: string): Route {
  const [seg, sub] = hash.replace(/^#\/?/, '').split('/');
  if (seg === 'plans' || seg === 'browse') return { tab: seg };
  // #/books/<id> is the book-detail sub-route (Task 23) — its own history
  // entry so system back returns to the shelf.
  if (seg === 'books') return { tab: 'books', sub: sub || undefined };
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

// Settings hash-space (Task 26): #/settings plus one sub-segment per screen.
// Unknown sub-segments fall back to the settings home.
function SettingsRoute({ sub }: { sub?: string }) {
  switch (sub) {
    case 'ai-import':
      return <AiImportHelp />;
    case 'chips':
      return <ChipsEditor />;
    case 'categories':
      return <CategoriesEditor />;
    case 'presets':
      return <PresetsEditor />;
    case 'backup':
      return <BackupRestore />;
    default:
      return <SettingsHome />;
  }
}

// ── splash ───────────────────────────────────────────────────────────────────

// Round 3 (owner 2026-07-16): the init gate used to show "PageToPlate" only
// for as long as store.init() took — a barely-visible blink. The splash now
// holds for SPLASH_MIN_MS regardless of init speed (tune the duration here),
// shows the app icon under the wordmark, and fades out over SPLASH_FADE_MS
// once BOTH init and the minimum hold are done. The app mounts underneath
// during the fade, so the content is revealed, not popped.
//
// The icon is INLINED (?raw import, no network fetch): on device, Android's
// own PWA launch screen (icon only) hands off to this splash, and an <img>
// pointing at favicon.svg painted late — owner saw icon → blank → text.
// Inline SVG paints in the same frame as the wordmark, so the OS icon hands
// off to wordmark+icon together (owner round-3 feedback, 2026-07-16).
const SPLASH_MIN_MS = 2000;
const SPLASH_FADE_MS = 1000;

function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div
      // Swipes must not start on the splash: with the overlay on top, a touch
      // hit-tests HERE, so TabPager's guard walk never sees what is underneath
      // (found by e2e — a chip-row swipe during the splash changed tabs).
      data-swipe-inert
      data-testid="splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30, // above everything, toast included (20)
        display: 'grid',
        placeItems: 'center',
        background: 'var(--paper)',
        opacity: leaving ? 0 : 1,
        transition: `opacity ${SPLASH_FADE_MS}ms ease`,
        // While fading, let taps reach the app underneath.
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 18 }}>
        <div className="screen-title">PageToPlate</div>
        {/* Sized by .splash-icon in base.css (the raw SVG carries 1024px attrs). */}
        <div className="splash-icon" dangerouslySetInnerHTML={{ __html: appIconSvg }} />
      </div>
    </div>
  );
}

// Backup nudge (plan Task 26 Step 3): at most ONE toast per browser session —
// a module flag, not state, so re-mounts/navigation can't re-fire it.
let nudgedThisSession = false;

function BackupNudge() {
  const showToast = useToast();
  const settings = useStore((s) => s.settings);
  const hasData = useStore((s) => s.books.length > 0 || s.recipes.length > 0);

  useEffect(() => {
    if (nudgedThisSession) return;
    if (!settings.backupReminder || settings.changesSinceBackup === 0) return;
    const days = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
    // Overdue = older than 30 days; never-backed-up counts once real data exists.
    const due = days === null ? hasData : days > BACKUP_OVERDUE_DAYS;
    if (!due) return;
    nudgedThisSession = true;
    showToast(
      days === null ? 'You haven’t backed up yet' : `You haven’t backed up in ${days} days`,
      () => {
        window.location.hash = '#/settings/backup';
      },
      'Back up',
    );
  }, [settings, hasData, showToast]);

  return null;
}

// The four main tab screens, rendered by the pager (both the active screen
// and, mid-drag, the neighboring preview).
function renderMainTab(tab: Tab) {
  switch (tab) {
    case 'generate':
      return <GenerateTab />;
    case 'plans':
      return <PlansTab />;
    case 'browse':
      return <BrowseTab />;
    case 'books':
      return <BooksTab />;
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [minSplashShown, setMinSplashShown] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    initPromise ??= store.init().then(() => {
      requestPersistOnFirstUse(store);
    });
    void initPromise.then(() => setReady(true));
    const id = setTimeout(() => setMinSplashShown(true), SPLASH_MIN_MS);
    // No cleanup for watchSystemTheme (no unsubscribe); a StrictMode double
    // registration only means applyTheme runs twice — it is idempotent.
    watchSystemTheme(() => store.settings.theme);
    return () => clearTimeout(id);
  }, []);

  // Applies the stored pref once init flips `theme`, and again whenever the
  // Settings screen changes it later.
  useEffect(() => applyTheme(theme), [theme]);

  // Unmount the splash only after its fade-out finishes.
  const splashLeaving = ready && minSplashShown;
  useEffect(() => {
    if (!splashLeaving) return;
    const id = setTimeout(() => setSplashGone(true), SPLASH_FADE_MS);
    return () => clearTimeout(id);
  }, [splashLeaving]);

  const route = parseRoute(useHash());

  // Swipe tab navigation (round-1 amendment 3; interactive pager since
  // round 3) — armed only on the four main tab screens; settings, book
  // detail (#/books/<id>) and the dev gallery keep swipes inert (they
  // aren't bottom-nav siblings, and book detail's back-arrow mental model
  // would fight a sideways jump).
  const swipeTab: Tab | null =
    route.tab !== 'settings' && route.tab !== 'dev' && !('sub' in route && route.sub) ? route.tab : null;

  if (!ready) return <Splash leaving={false} />;

  return (
    <ToastProvider>
      <BackupNudge />
      {swipeTab !== null ? (
        <TabPager active={swipeTab} render={renderMainTab} />
      ) : (
        <>
          {route.tab === 'books' && route.sub && <BookDetail bookId={route.sub} />}
          {route.tab === 'settings' && <SettingsRoute sub={route.sub} />}
          {route.tab === 'dev' && <DevGallery />}
        </>
      )}
      {/* Settings has no bottom nav in the design (canvas 4a: back arrow
          instead); the dev gallery isn't a tab either. Book detail (5c) also
          renders back-arrow-only, like settings. */}
      {swipeTab !== null && <BottomNav active={swipeTab} />}
      {!splashGone && <Splash leaving={splashLeaving} />}
    </ToastProvider>
  );
}
