// Placeholder (Task 12) — real Settings screens land in Tasks 26+.
// Per canvas 4a the settings screen has a back arrow (left of the title) and
// no bottom nav; history.back() plays nicely with hash routing.
import { ArrowLeft } from 'lucide-react';

export function SettingsHome({ sub }: { sub?: string }) {
  return (
    <main style={{ padding: '18px 16px 96px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          aria-label="Back"
          onClick={() => window.history.back()}
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-pill)',
            background: 'var(--card)',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="screen-title">Settings</h1>
      </header>
      <p className="meta" style={{ marginTop: 10 }}>
        {sub ? `Settings › ${sub} — lands in Tasks 26+.` : 'Settings screens land in Tasks 26+.'}
      </p>
    </main>
  );
}
