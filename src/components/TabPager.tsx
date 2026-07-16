// Interactive swipe tab navigation (round 3, owner 2026-07-16) — supersedes
// useSwipeTabs' flick-then-snap: the current screen now pans WITH the finger
// while the adjacent tab slides in as a live preview; release either commits
// the switch or springs back. Same four-tab scope as before (App.tsx decides
// where the pager mounts).
//
// Commit rules (either one):
//   - drag ≥ 35% of the column width, any speed — the new interactive rule
//   - the ORIGINAL deliberate-flick rule (|dx| ≥ 70px under 600ms), kept so
//     fast flicks that release early still navigate (e2e pins this)
// No wrap at the ends (unchanged): dragging outward on Generate/Books gets
// 1/3 resistance and can never commit — wrapping would make the gesture's
// direction meaningless.
//
// MUST-NOT-FIRE guards carried over verbatim from useSwipeTabs (round-1
// amendment 3's misfire clause; e2e/swipe-nav.spec.ts pins #3):
//   1. An overlay (Sheet/Dialog) is open — overlay.ts's module stack is the
//      single source of truth, exposed as overlayOpen().
//   2. The touch started in an input/textarea/select/contenteditable.
//   3. The touch started inside a horizontally scrollable element (e.g.
//      Browse's filter-chip row) — scrolling it must never change tabs.
// The old |dy| ≤ 50 diagonal rule is replaced by an axis lock: the first
// ~10px of movement decide horizontal pan (pager takes the touch and
// preventDefaults vertical scroll) vs vertical scroll (pager stands down
// for the rest of the touch).
//
// Layering: the preview overlay is z-index 5 — UNDER the bottom nav (10),
// which stays put while screens slide, and under every overlay/toast.
//
// Transform caveat (why cleanup is instant when an overlay opens
// mid-gesture): a transformed ancestor becomes the containing block for
// position:fixed descendants, and Sheets/Dialogs render inline, not in a
// portal. The pan transform must therefore never linger once an overlay
// could be open — cancelDrag() resets styles synchronously, no animation.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Tab } from './BottomNav';
import { overlayOpen } from './overlay';

const TAB_ORDER: Tab[] = ['generate', 'plans', 'browse', 'books'];
const LOCK_PX = 10; // movement before the gesture's axis is decided
const FLICK_MIN_DX = 70;
const FLICK_MAX_MS = 600;
const COMMIT_FRACTION = 0.35;
const END_RESISTANCE = 3; // finger-to-offset divisor when there is no neighbor
const ANIM_MS = 220;

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Any ancestor guard (form field / horizontal scroller / element that
 * declared itself swipe-inert, e.g. the splash overlay)? Walks the plain
 * parent chain — the app renders no shadow DOM, so this equals composedPath. */
function startsInGuardedElement(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (FORM_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable) return true;
    if (el.hasAttribute('data-swipe-inert')) return true;
    if (el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

type Drag = {
  x0: number;
  y0: number;
  t0: number;
  axis: 'h' | 'v' | null;
  dx: number; // applied offset (post-resistance), not raw finger delta
  width: number; // column width captured at touchstart — the slide distance
};

export function TabPager({ active, render }: { active: Tab; render: (tab: Tab) => ReactNode }) {
  const currentRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const animating = useRef(false); // commit/spring-back transition in flight
  const pendingTab = useRef<Tab | null>(null); // committed target awaiting the route swap
  // State mounts the preview screen; the ref mirror lets native handlers read
  // it without re-registering listeners every drag frame.
  const [preview, setPreview] = useState<Tab | null>(null);
  const previewShown = useRef<Tab | null>(null);

  const showPreview = (tab: Tab | null) => {
    previewShown.current = tab;
    setPreview(tab);
  };

  // Place a freshly mounted preview at its offscreen start before paint —
  // touchmove keeps it in sync afterwards.
  useLayoutEffect(() => {
    const d = drag.current;
    const el = previewRef.current;
    if (preview === null || !el || !d) return;
    el.style.transform = `translateX(${d.dx + (d.dx < 0 ? d.width : -d.width)}px)`;
  }, [preview]);

  // Route swap after a committed slide: the hash change re-renders us with
  // the new active tab already in normal flow; clear the leftover transform
  // and drop the preview overlay in the same pre-paint pass so there is no
  // visible seam.
  useLayoutEffect(() => {
    if (pendingTab.current !== active) return;
    pendingTab.current = null;
    const cur = currentRef.current;
    if (cur) {
      cur.style.transition = '';
      cur.style.transform = '';
    }
    showPreview(null);
    animating.current = false;
  }, [active]);

  useEffect(() => {
    const resetStyles = () => {
      const cur = currentRef.current;
      if (cur) {
        cur.style.transition = '';
        cur.style.transform = '';
      }
    };

    /** Instant reset — used when an overlay opens or a second finger lands
     * mid-gesture (see transform caveat in the header). */
    const cancelDrag = () => {
      drag.current = null;
      resetStyles();
      showPreview(null);
    };

    const springBack = (d: Drag) => {
      const cur = currentRef.current;
      const pre = previewRef.current;
      if (!cur || Math.abs(d.dx) < 1) {
        // No transition would run → no transitionend; clean up directly.
        resetStyles();
        showPreview(null);
        return;
      }
      animating.current = true;
      const ease = `transform ${ANIM_MS}ms ease-out`;
      cur.style.transition = ease;
      cur.style.transform = 'translateX(0px)';
      if (pre) {
        pre.style.transition = ease;
        pre.style.transform = `translateX(${d.dx < 0 ? d.width : -d.width}px)`;
      }
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        cur.removeEventListener('transitionend', done);
        resetStyles();
        showPreview(null);
        animating.current = false;
      };
      cur.addEventListener('transitionend', done);
      setTimeout(done, ANIM_MS + 100); // transitionend can be swallowed (hidden tab)
    };

    const commit = (d: Drag, target: Tab) => {
      const cur = currentRef.current;
      const pre = previewRef.current;
      if (!cur || !pre) {
        // Ultra-fast flick released before React mounted the preview: snap
        // exactly like the old hook did.
        window.scrollTo(0, 0);
        window.location.hash = `#/${target}`;
        showPreview(null);
        return;
      }
      animating.current = true;
      const ease = `transform ${ANIM_MS}ms ease-out`;
      cur.style.transition = ease;
      pre.style.transition = ease;
      cur.style.transform = `translateX(${d.dx < 0 ? -d.width : d.width}px)`;
      pre.style.transform = 'translateX(0px)';
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        pre.removeEventListener('transitionend', done);
        pre.style.transition = '';
        pendingTab.current = target;
        // Preview showed the target from its top — land the real render there
        // too, or the swap would jump to the old tab's scroll position.
        window.scrollTo(0, 0);
        window.location.hash = `#/${target}`;
      };
      pre.addEventListener('transitionend', done);
      setTimeout(done, ANIM_MS + 100);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (animating.current) return;
      drag.current = null;
      if (e.touches.length !== 1) return; // pinch/multi-touch is never a swipe
      if (overlayOpen() || startsInGuardedElement(e.target)) return;
      const t = e.touches[0];
      drag.current = {
        x0: t.clientX,
        y0: t.clientY,
        t0: Date.now(),
        axis: null,
        dx: 0,
        width: currentRef.current?.clientWidth || window.innerWidth,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d) return;
      if (e.touches.length > 1) {
        cancelDrag(); // a second finger cancels the gesture
        return;
      }
      const t = e.touches[0];
      const rawDx = t.clientX - d.x0;
      const dy = t.clientY - d.y0;
      if (d.axis === null) {
        if (Math.abs(rawDx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        d.axis = Math.abs(rawDx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (d.axis === 'v') return;
      if (overlayOpen()) {
        cancelDrag(); // overlay opened mid-gesture (e.g. long-press)
        return;
      }
      e.preventDefault(); // horizontal pan owns the touch — no vertical scroll
      // Swipe left (content moves left) → the NEXT tab to the right, and
      // vice versa — matches every mobile pager convention.
      const neighbor: Tab | null =
        rawDx === 0 ? null : (TAB_ORDER[TAB_ORDER.indexOf(active) + (rawDx < 0 ? 1 : -1)] ?? null);
      d.dx = neighbor === null ? rawDx / END_RESISTANCE : rawDx;
      if (neighbor !== previewShown.current) showPreview(neighbor);
      if (currentRef.current) currentRef.current.style.transform = `translateX(${d.dx}px)`;
      if (previewRef.current && neighbor !== null)
        previewRef.current.style.transform = `translateX(${d.dx + (d.dx < 0 ? d.width : -d.width)}px)`;
    };

    const onTouchEnd = () => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.axis !== 'h') return;
      const target = previewShown.current;
      const fastFlick = Math.abs(d.dx) >= FLICK_MIN_DX && Date.now() - d.t0 < FLICK_MAX_MS;
      const farEnough = Math.abs(d.dx) >= d.width * COMMIT_FRACTION;
      if (target !== null && !overlayOpen() && (fastFlick || farEnough)) commit(d, target);
      else springBack(d);
    };

    const onTouchCancel = () => {
      const d = drag.current;
      drag.current = null;
      if (d && d.axis === 'h') springBack(d);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    // NOT passive: a locked horizontal pan must preventDefault the scroll.
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
    // `active` is stable for the lifetime of any single drag (the hash only
    // changes at commit), so re-registering per tab is safe.
  }, [active]);

  return (
    <>
      <div ref={currentRef}>{render(active)}</div>
      {preview !== null && (
        <div
          ref={previewRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5, // under the bottom nav (10) — the nav never slides
            pointerEvents: 'none',
            overflow: 'hidden',
            // Parked offscreen until the placement layout effect runs.
            transform: 'translateX(200vw)',
          }}
        >
          <div
            style={{
              maxWidth: 430, // mirror #root's app column (base.css)
              margin: '0 auto',
              minHeight: '100dvh',
              background: 'var(--paper)',
              boxShadow: '0 0 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            {render(preview)}
          </div>
        </div>
      )}
    </>
  );
}
