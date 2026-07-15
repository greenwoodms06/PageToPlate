// Centered dialog (plan Task 13 Step 4; handoff 3a Mark-as-made). Canvas:
// panel inset 14px each side, 90px from the top, radius 18, --shadow-dialog,
// padding 18px 16px 16px, over the same dim+blur backdrop as Sheet. Backdrop
// tap, Escape and Android back close via usePopstateClose. Modest fade/rise
// enter; unmount immediate. z-index 15 = the Sheet PANEL's z, so a dialog
// opened from a sheet (RecipeCardSheet → mark-as-made / confirm, Task 22)
// stacks above it purely by DOM order. Dialogs must be rendered as SIBLINGS
// of a Sheet, never inside it: the sheet panel's transform makes it the
// containing block for position:fixed descendants, which would pin (and
// clip) the dialog to the sheet instead of the viewport.
import type { ReactNode } from 'react';
import { useEntered } from './Sheet';
import { usePopstateClose } from './overlay';

export function Dialog({
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        overflowY: 'auto',
        padding: '90px 14px 24px',
        opacity: entered ? 1 : 0,
        transition: 'opacity .25s ease-out',
        zIndex: 15, // see header note — must not sit under the Sheet panel (15)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          margin: '0 auto',
          maxWidth: 402, // app column 430 minus the 14px insets
          background: 'var(--paper)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-dialog)',
          padding: '18px 16px 16px',
          transform: entered ? 'none' : 'translateY(8px)',
          transition: 'transform .25s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
