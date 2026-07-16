// Shared overlay dismissal (plan Task 13 Step 4): Sheet and Dialog must close
// on Android back. On open we push a history entry WITHOUT touching the URL
// (pushState keeps the current hash, so the hash router in App.tsx never sees
// a change) and close on popstate; Escape and backdrop taps unwind that same
// entry via history.back() so the history stack never accumulates stale
// overlay entries.
import { useEffect, useRef } from 'react';

// Module-level stack of open overlays, so stacked overlays (a Dialog opened
// from inside a Sheet, e.g. mark-as-made — plan Task 18) each consume one
// back press / one Escape, topmost first. popstate fires on EVERY open
// overlay's listener; only the topmost may act.
const stack: symbol[] = [];

/** Any Sheet/Dialog currently open? The stack above already tracks exactly
 * that, so it doubles as the app-wide open-overlay marker — used by
 * TabPager (round-1 amendment 3; interactive pager since round 3) to keep horizontal swipes from
 * switching tabs underneath an open overlay. */
export function overlayOpen(): boolean {
  return stack.length > 0;
}

// Programmatic unwinds in flight. Found via Task 22 E2E: saving MarkAsMade
// from inside RecipeCardSheet closed the SHEET too — the dialog's deferred
// history.back() (unwinding its own entry after a programmatic close) fired
// a popstate that the sheet, by then top of stack, read as a user back-press.
// A programmatic unwind's popstate must be swallowed, not routed to the next
// overlay. This listener is registered at module init, so it runs BEFORE any
// overlay's listener (registration order) and tags the event; it also does
// the bookkeeping when no overlay is open at all (the common single-overlay
// case, where nothing else would decrement the counter).
let pendingUnwinds = 0;
type TaggedPop = PopStateEvent & { __overlayUnwind?: boolean };
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (ev: TaggedPop) => {
    if (pendingUnwinds > 0) {
      pendingUnwinds -= 1;
      ev.__overlayUnwind = true;
    }
  });
}

/**
 * Wire back-button / Escape dismissal for an overlay.
 * Returns `requestClose` — call it for backdrop taps (and any explicit close
 * button) so the pushed history entry is consumed by the close.
 */
export function usePopstateClose(open: boolean, onClose: () => void): () => void {
  const idRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Pending programmatic unwind (see cleanup). Deferred one macrotask so a
  // StrictMode dev remount (setup → cleanup → setup, same fiber, refs kept)
  // can cancel it and adopt the still-live history entry. Found via Task 18:
  // MarkAsMadeDialog is the first overlay MOUNTED with open=true — the old
  // synchronous-back cleanup queued a popstate that arrived after the
  // re-setup and closed the just-opened dialog on the spot. (Overlays that
  // mount closed and toggle `open` never hit this: their mount effect is a
  // no-op, and dep-change re-runs are not double-invoked.)
  const unwindTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = Symbol('overlay');
    idRef.current = id;
    stack.push(id);
    if (unwindTimer.current !== null) {
      // Remounted before the previous cleanup's unwind ran: our entry is
      // still current — adopt it instead of pushing a duplicate.
      clearTimeout(unwindTimer.current);
      unwindTimer.current = null;
    } else {
      // Preserve existing state and URL (incl. the #/route hash); the flag
      // only documents the entry when inspecting history.state.
      history.pushState({ ...(history.state ?? {}), overlay: true }, '');
    }

    const isTop = () => stack[stack.length - 1] === id;
    const drop = () => {
      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);
    };

    const onPop = (ev: TaggedPop) => {
      if (ev.__overlayUnwind) return; // programmatic unwind, not a user back press
      if (!isTop()) return; // a stacked overlay above us owns this back press
      drop();
      idRef.current = null; // entry already consumed by the browser
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTop()) return;
      e.preventDefault();
      history.back(); // → popstate → onPop closes us
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      drop();
      // Closed programmatically (open flipped false / unmount) without a back
      // press: unwind the entry we pushed so back doesn't need two presses.
      // Deferred one tick so a StrictMode remount can cancel it (see above).
      if (idRef.current === id) {
        idRef.current = null;
        unwindTimer.current = setTimeout(() => {
          unwindTimer.current = null;
          pendingUnwinds += 1; // swallow the resulting popstate (see module note)
          history.back();
        }, 0);
      }
    };
  }, [open]);

  return () => {
    // Backdrop tap: consume our history entry; popstate then calls onClose.
    if (idRef.current) history.back();
    else onCloseRef.current(); // defensive: not open / entry already consumed
  };
}
