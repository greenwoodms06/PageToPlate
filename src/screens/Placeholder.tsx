// TEMPORARY shared scaffolding for the Task 12 placeholder screens — each tab
// screen is rebuilt for real in Tasks 14+ and this file goes away with the
// last placeholder. Header carries the gear (settings entry point per canvas:
// top-right icon on tab headers).
import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';

export function GearLink() {
  return (
    <button
      aria-label="Settings"
      onClick={() => {
        window.location.hash = '#/settings';
      }}
      style={{ color: 'var(--ink-soft)', padding: 6, display: 'grid', placeItems: 'center' }}
    >
      <Settings size={20} />
    </button>
  );
}

export function PlaceholderScreen({ title, stub, action }: { title: string; stub: string; action?: ReactNode }) {
  return (
    // 96px bottom padding clears the fixed bottom nav (prototype main padding).
    <main style={{ padding: '18px 16px 96px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h1 className="screen-title">{title}</h1>
        {action}
      </header>
      <p className="meta" style={{ marginTop: 10 }}>{stub}</p>
    </main>
  );
}
