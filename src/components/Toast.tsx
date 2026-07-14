// Global toast (plan Task 12; handoff §Toast: "ink pill bottom-center (above
// nav), white text, optional green Undo"). Port of the prototype's showToast
// (fixed bottom 76px pill, .25s opacity fade) with the plan's 3.5s auto-dismiss
// and an added Undo affordance. bg --ink / text --paper reads correctly in both
// themes (dark pill in light, light pill in dark); the Undo green is the
// DERIVED --toast-undo token (see tokens.css for why --accent can't be used).
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ShowToast = (msg: string, undoFn?: () => void) => void;

const ToastCtx = createContext<ShowToast>(() => {});

/** `showToast(msg, undoFn?)` — undoFn renders a green Undo button. */
export function useToast(): ShowToast {
  return useContext(ToastCtx);
}

const DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  // `toast` keeps the last message through the fade-out (prototype behavior:
  // the pill's text is never cleared, only opacity drops); `visible` drives it.
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback<ShowToast>((msg, undoFn) => {
    clearTimeout(timer.current);
    setToast({ msg, undo: undoFn });
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), DISMISS_MS);
  }, []);

  const runUndo = () => {
    clearTimeout(timer.current);
    toast?.undo?.();
    setVisible(false);
  };

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <div
        role="status"
        aria-hidden={!visible}
        style={{
          position: 'fixed',
          bottom: 76, // above the 60px-ish bottom nav (prototype value)
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '10px 16px',
          borderRadius: 'var(--r-pill)',
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          opacity: visible ? 1 : 0,
          transition: 'opacity .25s',
          pointerEvents: visible ? 'auto' : 'none',
          zIndex: 20, // above content and the nav (nav is 10)
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast?.msg}</span>
        {toast?.undo && (
          <button onClick={runUndo} style={{ color: 'var(--toast-undo)', fontWeight: 700, fontSize: 13 }}>
            Undo
          </button>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
