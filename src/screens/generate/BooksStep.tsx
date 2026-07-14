// Generate step 1 — book selection (plan Task 14; canvas 2a; screenshot 03).
// Tap order = color order: card border/spine/badge all use
// spineColor(sel.indexOf(id)); deselecting splices and colors reflow
// (wizardReducer 'toggleBook', prototype `toggle`).
import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Cookbook, Preset } from '../../data/types';
import { OrderBadge } from '../../components/OrderBadge';
import { SpineChip } from '../../components/SpineChip';
import { spineColor } from '../../components/spine';
import { PrimaryCta } from './wizardUi';
import type { WizardAction } from './wizardState';

export function BooksStep({
  books,
  sel,
  presets,
  bookMeta,
  dispatch,
}: {
  /** Unarchived books only — archived books are hidden from generation. */
  books: Cookbook[];
  sel: string[];
  presets: Preset[];
  /** id → "N recipes · M made" line. */
  bookMeta: (id: string) => string;
  dispatch: Dispatch<WizardAction>;
}) {
  const [filter, setFilter] = useState('');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const shown = filter.trim()
    ? books.filter((b) => b.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : books;

  return (
    <div>
      <h1 className="screen-title">Choose your cookbooks</h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 12px' }}>
        Each book gets a color in the order you tap it.
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="⌕ Filter books…"
        aria-label="Filter books"
        style={{
          width: '100%',
          background: 'var(--card)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '10px 12px',
          fontSize: 14,
          marginBottom: 10,
        }}
      />

      {shown.map((b) => {
        const idx = sel.indexOf(b.id);
        const selected = idx >= 0;
        const color = spineColor(idx); // neutral spine when not selected
        return (
          <button
            key={b.id}
            data-book-id={b.id}
            aria-pressed={selected}
            onClick={() => dispatch({ type: 'toggleBook', id: b.id })}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--card)',
              border: `1.5px solid ${selected ? color : 'var(--line)'}`,
              boxShadow: selected ? `0 0 0 1px ${color}` : 'none',
              borderRadius: 'var(--r-card)',
              padding: '12px 14px',
              marginBottom: 9,
              fontSize: 15,
              minHeight: 64,
            }}
          >
            <SpineChip color={selected ? color : undefined} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontWeight: 600 }}>{b.name}</b>
              <br />
              <span className="meta">{bookMeta(b.id)}</span>
            </span>
            {selected && <OrderBadge n={idx + 1} color={color} />}
          </button>
        );
      })}
      {shown.length === 0 && (
        <div className="meta" style={{ padding: '12px 2px' }}>
          No books match “{filter.trim()}”.
        </div>
      )}

      {presets.length > 0 && (
        <>
          <button
            aria-expanded={presetsOpen}
            onClick={() => setPresetsOpen(!presetsOpen)}
            style={{
              width: '100%',
              minHeight: 44,
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-pill)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-mid)',
              margin: '12px 0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {presetLabel(presets)}
          </button>
          {presetsOpen && (
            <div
              style={{
                border: '1.5px dashed var(--dash)',
                background: 'var(--panel)',
                borderRadius: 'var(--r-card)',
                padding: '8px 10px',
                marginBottom: 4,
              }}
            >
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    dispatch({ type: 'applyPreset', bookIds: p.bookIds, config: p.config });
                    setPresetsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 4px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <span>{p.name}</span>
                  <span className="meta">
                    {p.bookIds.length} book{p.bookIds.length === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <PrimaryCta
        label="Next: categories →"
        disabled={sel.length === 0}
        onClick={() => dispatch({ type: 'setStep', step: 2 })}
      />
    </div>
  );
}

// "Presets: Weeknight dinner, Sunday bake, +3 ▾" (canvas 2a) — first two
// names, then a +N overflow count.
function presetLabel(presets: Preset[]): string {
  const names = presets.slice(0, 2).map((p) => p.name).join(', ');
  const more = presets.length > 2 ? `, +${presets.length - 2}` : '';
  return `Presets: ${names}${more} ▾`;
}
