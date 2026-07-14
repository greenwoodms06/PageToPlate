// Bottom sheet (plan Task 13 Step 4; handoff 2e: "Bottom sheet (radius 22px
// top, drag handle) over a dimmed/blurred backdrop"). Slide-up ~.25s ease-out
// (handoff §Interactions: "sheet slides up … no elaborate animation
// language"; unmount is immediate). Backdrop tap, Escape and Android back all
// close via usePopstateClose. Drag handle 40×4 in --dash — canvas-exact
// (canvas 2e/3f: width:40px;height:4px;border-radius:2px). z-index: above the
// bottom nav (10), below the toast (20) so undo toasts stay visible over an
// open sheet.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePopstateClose } from './overlay';

export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog region. */
  label: string;
  children: ReactNode;
}) {
  const requestClose = usePopstateClose(open, onClose);
  const entered = useEntered(open);
  if (!open) return null;

  return (
    <>
      <div
        onClick={requestClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.45)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: entered ? 1 : 0,
          transition: 'opacity .25s ease-out',
          zIndex: 14,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: 430, // the app column (base.css #root)
          background: 'var(--paper)',
          borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0',
          boxShadow: 'var(--shadow-sheet)',
          padding: '10px 16px 20px',
          maxHeight: '88dvh',
          overflowY: 'auto',
          transform: entered ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
          transition: 'transform .25s ease-out',
          zIndex: 15,
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--dash)', margin: '0 auto 12px' }} />
        {children}
      </div>
    </>
  );
}

/** False on the mounting frame, true one frame later — drives enter
 * transitions with inline styles (no CSS keyframes needed). */
export function useEntered(open: boolean): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(id);
      setEntered(false);
    };
  }, [open]);
  return entered;
}
