// Filter-chips editor (plan Task 26; canvas 4b, screenshot 12). One card per
// category in store order: removable chip pills, custom chips (not in that
// category's shipped defaults) highlighted green, a per-category "Restore
// defaults" link shown only when diverged, "+ add chip" inline input, and
// custom categories with zero chips collapsed to a header-only row. Every
// edit writes through store.updateCategory immediately with a toast Undo.
import { useState } from 'react';
import { DEFAULT_CATEGORIES } from '../../data/categories';
import { store, useStore } from '../../data/store';
import type { Category } from '../../data/types';
import { useToast } from '../../components/Toast';
import { Card, SettingsHeader } from './settingsUi';

// Shipped defaults are keyed by NAME: a default category that was renamed in
// CategoriesEditor no longer matches, so it loses its "Restore defaults" link
// and all its chips read as custom (green). Acceptable: after a rename we no
// longer know the owner still wants the old vocabulary.
const shippedChips = (cat: Category): string[] | undefined =>
  DEFAULT_CATEGORIES.find((d) => d.name === cat.name)?.chips;

export function ChipsEditor() {
  const categories = useStore((s) => s.categories);
  const showToast = useToast();
  const [addingTo, setAddingTo] = useState<string | null>(null); // category id with the inline input open
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set()); // opened zero-chip custom cards

  const setChips = (cat: Category, chips: string[], msg: string) => {
    const prev = cat.chips;
    void store.updateCategory(cat.id, { chips });
    showToast(msg, () => void store.updateCategory(cat.id, { chips: prev }));
  };

  const commitAdd = (cat: Category) => {
    const text = draft.trim().toLowerCase();
    setAddingTo(null);
    setDraft('');
    if (!text || cat.chips.includes(text)) return;
    setChips(cat, [...cat.chips, text], `Added “${text}”`);
  };

  return (
    <main style={{ padding: '20px 16px 24px' }}>
      <SettingsHeader title="Filter chips" sub="These appear as one-tap keywords in that category’s filter panel." />

      {categories.map((cat) => {
        const shipped = shippedChips(cat);
        const diverged =
          shipped !== undefined &&
          (cat.chips.length !== shipped.length || cat.chips.some((c, i) => c !== shipped[i]));
        const hasCustom = cat.chips.some((c) => !shipped?.includes(c));

        // Canvas 4b: custom categories with no chips collapse to header-only.
        if (!cat.isDefault && cat.chips.length === 0 && addingTo !== cat.id && !expanded.has(cat.id)) {
          return (
            <Card key={cat.id} style={{ padding: 12, opacity: 0.75, marginBottom: 9 }}>
              <button
                onClick={() => setExpanded(new Set([...expanded, cat.id]))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', textAlign: 'left' }}
              >
                <b style={{ fontWeight: 600, flex: 1 }}>
                  {cat.name} <CustomTag />
                </b>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>no chips yet ›</span>
              </button>
            </Card>
          );
        }

        return (
          <Card key={cat.id} style={{ padding: 12, marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
              <b style={{ fontWeight: 600, flex: 1 }}>
                {cat.name} {!cat.isDefault && <CustomTag />}
              </b>
              {diverged && (
                <button
                  onClick={() => setChips(cat, [...shipped], 'Defaults restored')}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}
                >
                  Restore defaults
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {cat.chips.map((chip) => {
                const custom = !shipped?.includes(chip);
                return (
                  <span
                    key={chip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: `1.5px solid ${custom ? 'var(--accent)' : 'var(--line)'}`,
                      background: custom ? 'var(--accent-tint)' : 'var(--card)',
                      borderRadius: 'var(--r-pill)',
                      padding: '6px 8px 6px 12px',
                      fontSize: 12.5,
                      fontWeight: custom ? 700 : 600,
                      color: custom ? 'var(--accent)' : 'var(--ink-mid)',
                    }}
                  >
                    {chip}
                    <button
                      aria-label={`Remove ${chip}`}
                      onClick={() => setChips(cat, cat.chips.filter((c) => c !== chip), `Removed “${chip}”`)}
                      style={{
                        background: 'var(--pill-x-bg)',
                        color: 'inherit',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        fontSize: 11,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {addingTo === cat.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd(cat);
                    if (e.key === 'Escape') {
                      setDraft('');
                      setAddingTo(null);
                    }
                  }}
                  onBlur={() => commitAdd(cat)}
                  placeholder="keyword…"
                  aria-label={`New chip for ${cat.name}`}
                  style={{
                    width: 110,
                    border: '1.5px dashed var(--dash)',
                    background: 'none',
                    borderRadius: 'var(--r-pill)',
                    padding: '6px 12px',
                    fontSize: 12.5,
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    setDraft('');
                    setAddingTo(cat.id);
                  }}
                  style={{
                    border: '1.5px dashed var(--dash)',
                    borderRadius: 'var(--r-pill)',
                    padding: '6px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--ink-soft)',
                  }}
                >
                  + add chip
                </button>
              )}
            </div>
            {hasCustom && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>
                Green = your custom chips. Chips are just saved keywords.
              </div>
            )}
          </Card>
        );
      })}
    </main>
  );
}

function CustomTag() {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 'var(--r-tag)',
        background: 'var(--rejected-fill)',
        color: 'var(--ink-soft)',
        marginLeft: 6,
      }}
    >
      custom
    </span>
  );
}
