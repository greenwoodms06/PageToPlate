// Warning note (plan Task 13 Step 2): --warn-bg / --warn-border. Values from
// canvas 1a Results partial-pool note (radius 10, padding 9px 12px, 12.5px).
import type { ReactNode } from 'react';

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--warn-bg)',
        border: '1px solid var(--warn-border)',
        borderRadius: 'var(--r-inner)',
        padding: '9px 12px',
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}
