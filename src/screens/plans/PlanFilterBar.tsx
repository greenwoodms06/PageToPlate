// Plans-list filter bar (round-2b): a date row of independent cyclable window
// chips (Past month / Past year) + an "All" reset + a Custom-range toggle,
// keyword pills, and Books / Categories / Rating dropdowns (shared
// FilterControls). Mirrors BrowseTab's pill-input + rating-dropdown pattern;
// predicate lives in planFilter.ts. The Made pill + per-recipe/per-plan toggle
// live on the count row in PlansTab.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { addPill, removePill, togglePill } from '../../logic/pills';
import type { RatingScale } from '../../logic/rating';
import { Pill } from '../../components/Pill';
import { SegmentToggle } from '../../components/SegmentToggle';
import { spineColor } from '../../components/spine';
import { DashPanel, DropBtn, SelChip, cycleSel } from '../../components/FilterControls';
import type { DateWindowSel, PlanFilters, RatingMode } from './planFilter';

// A window chip's filter state ↔ the shared SelChip's tri-state render:
// off → neutral label; 'in' → green "<label> ✓"; 'out' → red "not <label>".
const winToChip = (w: DateWindowSel): 'off' | 'inc' | 'not' =>
  w === 'in' ? 'inc' : w === 'out' ? 'not' : 'off';
// Cycle order matches SelChip: off → in (within) → out (beyond) → off.
const cycleWindow = (w: DateWindowSel): DateWindowSel =>
  w === 'off' ? 'in' : w === 'in' ? 'out' : 'off';

const RATING_MODE_OPTIONS: { key: RatingMode; label: string }[] = [
  { key: 'above', label: 'and above' },
  { key: 'exact', label: 'exactly' },
  { key: 'below', label: 'and below' },
];

const ratingChipLabel = (r: { value: number; mode: RatingMode }): string =>
  r.mode === 'above' ? `★ ${r.value}+` : r.mode === 'exact' ? `★ ${r.value}` : `★ ≤${r.value}`;

// A neutral pill toggle used for date presets and made-status chips.
const toggleChip = (on: boolean): CSSProperties => ({
  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  background: on ? 'var(--accent-tint)' : 'var(--card)',
  borderRadius: 'var(--r-pill)',
  padding: '7px 13px',
  fontSize: 12.5,
  fontWeight: on ? 700 : 600,
  color: on ? 'var(--accent)' : 'var(--ink-soft)',
});

export function PlanFilterBar({
  filters,
  onChange,
  books,
  categories,
  scale,
}: {
  filters: PlanFilters;
  onChange: (f: PlanFilters) => void;
  /** Books present in the plans (dynamic), in first-seen order. */
  books: { id: string; name: string }[];
  /** Category names present in the plans (dynamic). */
  categories: string[];
  scale: RatingScale;
}) {
  const [openPanel, setOpenPanel] = useState<'books' | 'cats' | 'rating' | null>(null);
  const set = (patch: Partial<PlanFilters>) => onChange({ ...filters, ...patch });

  const includeOrder = filters.bookSel.filter((e) => !e.neg).map((e) => e.id);
  const ratingDraft = filters.rating ?? { value: scale === 10 ? 8 : 4, mode: 'above' as RatingMode };

  const booksActive = filters.bookSel.length > 0;
  const catsActive = filters.catSel.length > 0;
  const booksLabel = includeOrder.length
    ? `Books: ${includeOrder.length} selected`
    : booksActive
      ? `Books: ${filters.bookSel.length} excluded`
      : 'Books: all';
  const catInclCount = filters.catSel.filter((e) => !e.neg).length;
  const catsLabel = catInclCount
    ? `Categories: ${catInclCount} selected`
    : catsActive
      ? `Categories: ${filters.catSel.length} excluded`
      : 'Categories: all';

  // "All" is the default indicator + reset: active when no date constraint is
  // set (both window chips off AND custom panel closed). Tapping it clears them.
  const allActive = filters.pastMonth === 'off' && filters.pastYear === 'off' && !filters.custom;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Date row: All · Past month · Past year · Custom range… (round-2b) */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
        <button
          aria-pressed={allActive}
          onClick={() => set({ pastMonth: 'off', pastYear: 'off', custom: false, customFrom: undefined, customTo: undefined })}
          style={toggleChip(allActive)}
        >
          All
        </button>
        {/* Independent 3-state cycle chips — each ANDs as its own date constraint. */}
        <SelChip
          label="Past month"
          state={winToChip(filters.pastMonth)}
          onClick={() => set({ pastMonth: cycleWindow(filters.pastMonth) })}
        />
        <SelChip
          label="Past year"
          state={winToChip(filters.pastYear)}
          onClick={() => set({ pastYear: cycleWindow(filters.pastYear) })}
        />
        <button
          aria-pressed={filters.custom}
          onClick={() => set({ custom: !filters.custom })}
          style={toggleChip(filters.custom)}
        >
          Custom range…
        </button>
      </div>
      {filters.custom && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 5 }}>
            From
            <input
              type="date"
              aria-label="From date"
              value={filters.customFrom ?? ''}
              onChange={(e) => set({ customFrom: e.target.value })}
              style={dateInput}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 5 }}>
            To
            <input
              type="date"
              aria-label="To date"
              value={filters.customTo ?? ''}
              onChange={(e) => set({ customTo: e.target.value })}
              style={dateInput}
            />
          </label>
        </div>
      )}

      {/* Keyword pill field (pills live inside, canvas 2d pattern) */}
      <div
        style={{
          background: 'var(--card)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '9px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        {filters.pills.map((p, i) => (
          <Pill
            key={p.text}
            label={p.text}
            neg={p.neg}
            onCycle={() => set({ pills: togglePill(filters.pills, i) })}
            onRemove={() => set({ pills: removePill(filters.pills, i) })}
          />
        ))}
        <KeywordInput onAdd={(t) => set({ pills: addPill(filters.pills, t) })} />
      </div>

      {/* Books / Categories / Rating dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, overflowX: 'auto' }}>
        <DropBtn
          label={booksLabel}
          active={booksActive}
          open={openPanel === 'books'}
          onClick={() => setOpenPanel(openPanel === 'books' ? null : 'books')}
        />
        <DropBtn
          label={catsLabel}
          active={catsActive}
          open={openPanel === 'cats'}
          onClick={() => setOpenPanel(openPanel === 'cats' ? null : 'cats')}
        />
        <DropBtn
          label={filters.rating ? ratingChipLabel(filters.rating) : '★ Rating'}
          active={filters.rating !== null}
          open={openPanel === 'rating'}
          onClick={() => setOpenPanel(openPanel === 'rating' ? null : 'rating')}
        />
      </div>

      {openPanel === 'books' && (
        <DashPanel>
          <SelChip label="All books" state="off" onClick={() => set({ bookSel: [] })} />
          {books.map((b) => {
            const entry = filters.bookSel.find((e) => e.id === b.id);
            const state = entry ? (entry.neg ? 'not' : 'inc') : 'off';
            return (
              <SelChip
                key={b.id}
                label={b.name}
                state={state}
                swatch={state === 'inc' ? spineColor(includeOrder.indexOf(b.id)) : 'var(--neutral-spine)'}
                onClick={() => set({ bookSel: cycleSel(filters.bookSel, b.id) })}
              />
            );
          })}
        </DashPanel>
      )}
      {openPanel === 'cats' && (
        <DashPanel>
          <SelChip label="All categories" state="off" onClick={() => set({ catSel: [] })} />
          {categories.map((name) => {
            const entry = filters.catSel.find((e) => e.id === name);
            return (
              <SelChip
                key={name}
                label={name}
                state={entry ? (entry.neg ? 'not' : 'inc') : 'off'}
                onClick={() => set({ catSel: cycleSel(filters.catSel, name) })}
              />
            );
          })}
        </DashPanel>
      )}
      {openPanel === 'rating' && (
        <DashPanel>
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${scale}, 1fr)`, gap: 5 }}>
            {Array.from({ length: scale }, (_, i) => i + 1).map((n) => {
              const on = ratingDraft.value === n;
              return (
                <button
                  key={n}
                  aria-pressed={on && filters.rating !== null}
                  onClick={() => set({ rating: { ...ratingDraft, value: n } })}
                  style={{
                    minHeight: 40,
                    border: on ? 'none' : '1.5px solid var(--line)',
                    background: on ? 'var(--accent)' : 'var(--card)',
                    color: on ? 'var(--on-accent)' : 'var(--ink-mid)',
                    borderRadius: 'var(--r-inner)',
                    fontSize: 13,
                    fontWeight: on ? 800 : 700,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <SegmentToggle
            options={RATING_MODE_OPTIONS.map((m) => m.label)}
            value={RATING_MODE_OPTIONS.find((m) => m.key === ratingDraft.mode)!.label}
            onChange={(label) => set({ rating: { ...ratingDraft, mode: RATING_MODE_OPTIONS.find((m) => m.label === label)!.key } })}
          />
          <button
            onClick={() => {
              set({ rating: null });
              setOpenPanel(null);
            }}
            style={{
              border: '1.5px solid var(--line)',
              background: 'var(--card)',
              borderRadius: 'var(--r-pill)',
              padding: '7px 13px',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--ink-soft)',
            }}
          >
            Any rating
          </button>
        </DashPanel>
      )}
    </div>
  );
}

const dateInput: CSSProperties = {
  border: '1.5px solid var(--line)',
  background: 'var(--card)',
  color: 'var(--ink)',
  borderRadius: 'var(--r-inner)',
  padding: '6px 8px',
  fontSize: 12.5,
  fontFamily: 'var(--font-body)',
};

// Own component so typing re-renders only the input (mirrors Browse's GhostInput).
function KeywordInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        onAdd(text);
        setText('');
      }}
      placeholder="⌕ add keyword…"
      aria-label="Add plan keyword"
      enterKeyHint="done"
      style={{ flex: 1, minWidth: 80, border: 'none', background: 'transparent', fontSize: 14, padding: '6px 0' }}
    />
  );
}
