// TEMPORARY token sample page (plan Task 2, Step 4) — replaced by the real
// app shell in Task 12. Renders every color token, each type utility, and a
// fake recipe card twice: once following the root theme (toggle button →
// applyTheme) and once pinned dark via a [data-theme] subtree override.
import { useState } from 'react';
import { applyTheme, type ThemePref } from './theme';

const COLOR_TOKENS = [
  'paper', 'card', 'panel',
  'ink', 'ink-soft', 'ink-mid', 'ink-disabled',
  'line', 'dash', 'ruling',
  'accent', 'accent-tint', 'accent-disabled',
  'danger', 'danger-tint',
  'warn-bg', 'warn-border',
  'gold', 'planned',
  'readable-bg', 'readable-text',
  'neutral-spine', 'rejected-fill',
  'on-accent', 'tab-text',
  'spine-1', 'spine-2', 'spine-3', 'spine-4',
  'spine-5', 'spine-6', 'spine-7', 'spine-8',
];

function Swatches() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {COLOR_TOKENS.map((t) => (
        <div key={t}>
          <div
            style={{
              height: 32,
              borderRadius: 6,
              border: '1px solid var(--line)',
              background: `var(--${t})`,
            }}
          />
          <div className="hint" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>
            --{t}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeStyles() {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div className="screen-title">Screen title · display 800 · 24px</div>
      <div className="section-label">Section label · 12px uppercase</div>
      <div>Body · Instrument Sans · 15px / 1.45</div>
      <div className="meta">Meta · 12.5px soft ink</div>
      <div className="hint">Hint · 11.5px</div>
      <div className="field-label">Field label · 11px uppercase 700</div>
    </div>
  );
}

function FakeCard() {
  return (
    <div
      className="index-ruling"
      style={{
        position: 'relative',
        backgroundColor: 'var(--card)',
        backgroundPosition: '0 46px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding: '14px 14px 12px 20px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 7,
          background: 'var(--spine-1)',
          borderRadius: '12px 0 0 12px',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: 14,
          top: -1,
          background: 'var(--spine-1)',
          color: 'var(--tab-text)',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 9px 4px',
          borderRadius: '0 0 7px 7px',
        }}
      >
        p. 142
      </span>
      <div style={{ fontWeight: 600, fontSize: 16, paddingRight: 56 }}>
        Stir-Fried Beef with Oyster Sauce
      </div>
      <div className="meta" style={{ marginTop: 2 }}>The Woks of Life · never made</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <button
          style={{
            flex: 1,
            minHeight: 40,
            border: '1.5px solid var(--accent)',
            color: 'var(--accent)',
            background: 'var(--accent-tint)',
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ✓ Keep
        </button>
        <button
          style={{
            flex: 1,
            minHeight: 40,
            border: '1.5px solid var(--line)',
            color: 'var(--ink-disabled)',
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Reject
        </button>
      </div>
      <button
        style={{
          width: '100%',
          minHeight: 52,
          marginTop: 12,
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        Plan these 2 →
      </button>
    </div>
  );
}

function Sample({ title }: { title: string }) {
  return (
    <section style={{ background: 'var(--paper)', color: 'var(--ink)', padding: '20px 16px 24px' }}>
      <h1 className="screen-title">{title}</h1>
      <div className="section-label" style={{ margin: '14px 0 8px' }}>Color tokens</div>
      <Swatches />
      <div className="section-label" style={{ margin: '18px 0 8px' }}>Type styles</div>
      <TypeStyles />
      <div className="section-label" style={{ margin: '18px 0 8px' }}>Recipe card</div>
      <FakeCard />
    </section>
  );
}

export default function App() {
  const [pref, setPref] = useState<ThemePref>('light');
  const toggle = () => {
    const next: ThemePref = pref === 'light' ? 'dark' : 'light';
    setPref(next);
    applyTheme(next);
  };
  return (
    <>
      <button
        id="theme-toggle"
        onClick={toggle}
        style={{
          margin: '12px 16px 0',
          padding: '8px 14px',
          border: '1.5px solid var(--accent)',
          color: 'var(--accent)',
          background: 'var(--accent-tint)',
          borderRadius: 'var(--r-pill)',
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        Theme: {pref} (tap to flip)
      </button>
      <Sample title="Tokens — follows root theme" />
      <div data-theme="dark">
        <Sample title="Tokens — pinned dark" />
      </div>
    </>
  );
}
