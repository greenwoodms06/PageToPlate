// Bottom nav (plan Task 12; handoff §Bottom nav): 4 tabs, lucide icons at
// 18px, 11px/600 labels, active = accent + 700. Fixed to the bottom, card bg,
// 1px top line, centered to the app column (base.css #root max-width 430px).
// Taps set location.hash — routing is hash-based (App.tsx useHash).
import { Dices, LayoutList, LibraryBig, Search } from 'lucide-react';

export type Tab = 'generate' | 'plans' | 'browse' | 'books';

const TABS: { tab: Tab; label: string; Icon: typeof Dices }[] = [
  { tab: 'generate', label: 'Generate', Icon: Dices },
  { tab: 'plans', label: 'Plans', Icon: LayoutList },
  { tab: 'browse', label: 'Browse', Icon: Search },
  { tab: 'books', label: 'Books', Icon: LibraryBig },
];

export function BottomNav({ active }: { active: Tab }) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        background: 'var(--card)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 10,
      }}
    >
      {TABS.map(({ tab, label, Icon }) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              window.location.hash = `#/${tab}`;
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '10px 0 12px',
              fontSize: 11,
              fontWeight: on ? 700 : 600,
              color: on ? 'var(--accent)' : 'var(--ink-soft)',
            }}
          >
            <Icon size={18} strokeWidth={on ? 2.4 : 2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
