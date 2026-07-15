// App-wide swipe tab navigation (round-1 amendment 3, owner 2026-07-15):
// a horizontal swipe on one of the four main tab screens moves to the
// adjacent bottom-nav tab. Interpretation flagged in the plan: this reads
// the owner's "left/right swipe to change tabs" as TAB navigation (the
// alternative reading — next/prev recipe on the card — was not built).
//
// Recognition: |dx| ≥ 70px, |dy| ≤ 50px, under 600ms — deliberate flick,
// not a slow drag or a diagonal scroll. No wrap at the ends (a right-swipe
// on Generate / left-swipe on Books does nothing; wrapping would make the
// gesture's direction meaningless).
//
// MUST-NOT-FIRE guards (the amendment's misfire clause):
//   1. An overlay (Sheet/Dialog) is open — overlay.ts's module stack is the
//      single source of truth for that, exposed as overlayOpen().
//   2. The touch started in an input/textarea/select/contenteditable —
//      those own their gestures (cursor drags, text selection).
//   3. The touch started inside a horizontally scrollable element (any
//      ancestor with scrollWidth > clientWidth + 2px epsilon for rounding)
//      — e.g. Browse's filter-chip row: scrolling it must never change tabs.
import { useEffect } from 'react';
import type { Tab } from './BottomNav';
import { overlayOpen } from './overlay';

const TAB_ORDER: Tab[] = ['generate', 'plans', 'browse', 'books'];
const MIN_DX = 70;
const MAX_DY = 50;
const MAX_MS = 600;

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Any ancestor guard (form field / horizontal scroller)? Walks the plain
 * parent chain — the app renders no shadow DOM, so this equals composedPath. */
function startsInGuardedElement(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (FORM_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable) return true;
    if (el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

/**
 * Wire swipe-to-switch-tabs while `active` names the current main tab.
 * Pass `null` on every other route (settings, book detail, dev gallery) —
 * the amendment scopes the gesture to the four bottom-nav screens.
 */
export function useSwipeTabs(active: Tab | null): void {
  useEffect(() => {
    if (active === null) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return; // pinch/multi-touch is never a swipe
      if (overlayOpen() || startsInGuardedElement(e.target)) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) start = null; // a second finger cancels the gesture
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (start === null) return;
      const s = start;
      start = null;
      const t = e.changedTouches[0];
      if (!t || overlayOpen()) return; // overlay opened mid-gesture (e.g. long-press)
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.t >= MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dy) > MAX_DY) return;
      // Swipe left (content moves left) → the NEXT tab to the right, and
      // vice versa — matches every mobile pager convention.
      const next = TAB_ORDER[TAB_ORDER.indexOf(active) + (dx < 0 ? 1 : -1)];
      if (next !== undefined) window.location.hash = `#/${next}`; // wrap OFF at the ends
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [active]);
}
