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

/**
 * Wire back-button / Escape dismissal for an overlay.
 * Returns `requestClose` — call it for backdrop taps (and any explicit close
 * button) so the pushed history entry is consumed by the close.
 */
export function usePopstateClose(open: boolean, onClose: () => void): () => void {
  const idRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = Symbol('overlay');
    idRef.current = id;
    stack.push(id);
    // Preserve existing state and URL (incl. the #/route hash); the flag only
    // documents the entry when inspecting history.state.
    history.pushState({ ...(history.state ?? {}), overlay: true }, '');

    const isTop = () => stack[stack.length - 1] === id;
    const drop = () => {
      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);
    };

    const onPop = () => {
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
      if (idRef.current === id) {
        idRef.current = null;
        history.back();
      }
    };
  }, [open]);

  return () => {
    // Backdrop tap: consume our history entry; popstate then calls onClose.
    if (idRef.current) history.back();
    else onCloseRef.current(); // defensive: not open / entry already consumed
  };
}
