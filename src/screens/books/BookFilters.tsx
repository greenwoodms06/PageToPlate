// Reusable Books filter bar (round-2 amendments 4/5/6): text search, a dynamic
// cuisine multiselect (include/not/off), and an era → year-range control whose
// bounds are the actual min/max publication years in the CURRENT list. Used by
// BOTH the "My shelf" and "Library" segments of BooksTab, so large collections
// stay searchable. Nothing is hardcoded — cuisine options and year bounds are
// derived from whatever items are passed in.
//
// The filter PREDICATE (applyBookFilters) is a pure function, unit-tested in
// BookFilters.test.ts; the bar below is a thin controlled UI over it.
import { useState } from 'react';
import { DashPanel, DropBtn, SelChip, cycleSel, type SelEntry } from '../../components/FilterControls';

/** The shelf (installed Cookbooks) and Library (CatalogPacks) both normalise to
 * this shape before filtering. */
export interface FilterableItem {
  id: string;
  title: string;
  author?: string;
  year?: number;
  cuisines: string[];
}

export interface BookFilterState {
  q: string;
  cuisine: SelEntry[];
  /** null = "no lower bound set" → the list's min; likewise yearTo → max. */
  yearFrom: number | null;
  yearTo: number | null;
}

export const emptyBookFilter: BookFilterState = { q: '', cuisine: [], yearFrom: null, yearTo: null };

/** Distinct cuisines present across the items, alphabetically (dynamic options). */
export function cuisineOptions(items: FilterableItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.cuisines))].filter(Boolean).sort();
}

/** Actual [min,max] publication years in the list, or null when none carry a year. */
export function yearBounds(items: FilterableItem[]): { min: number; max: number } | null {
  const years = items.map((i) => i.year).filter((y): y is number => y !== undefined);
  if (years.length === 0) return null;
  return { min: Math.min(...years), max: Math.max(...years) };
}

/**
 * Pure filter. Empty filter → all items. Cuisine: an included cuisine means the
 * item must carry at least one included cuisine (OR); an excluded cuisine drops
 * any item carrying it. Year: items are kept inside [from,to]; a book with NO
 * year is shown while the span is full, and hidden once the span is narrowed
 * from either end (documented choice — narrowing the years is an explicit "only
 * dated books in this window" intent).
 */
export function applyBookFilters<T extends FilterableItem>(items: T[], f: BookFilterState): T[] {
  const bounds = yearBounds(items);
  const from = f.yearFrom ?? bounds?.min ?? null;
  const to = f.yearTo ?? bounds?.max ?? null;
  const narrowed =
    bounds !== null &&
    ((f.yearFrom !== null && f.yearFrom > bounds.min) || (f.yearTo !== null && f.yearTo < bounds.max));
  const needle = f.q.trim().toLowerCase();
  const incl = f.cuisine.filter((e) => !e.neg).map((e) => e.id);
  const excl = f.cuisine.filter((e) => e.neg).map((e) => e.id);

  return items.filter((it) => {
    if (needle) {
      const hay = `${it.title} ${it.author ?? ''} ${it.cuisines.join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (incl.length > 0 && !incl.some((c) => it.cuisines.includes(c))) return false;
    if (excl.some((c) => it.cuisines.includes(c))) return false;
    if (from !== null && to !== null) {
      if (it.year === undefined) {
        if (narrowed) return false;
      } else if (it.year < from || it.year > to) {
        return false;
      }
    }
    return true;
  });
}

/** True when any filter is active (drives the count line / "clear" affordances). */
export const isFilterActive = (f: BookFilterState): boolean =>
  f.q.trim() !== '' || f.cuisine.length > 0 || f.yearFrom !== null || f.yearTo !== null;

// ── UI ───────────────────────────────────────────────────────────────────────

export function BookFilterBar({
  items,
  filter,
  onChange,
}: {
  items: FilterableItem[];
  filter: BookFilterState;
  onChange: (next: BookFilterState) => void;
}) {
  const [open, setOpen] = useState<'cuisine' | 'era' | null>(null);
  const cuisines = cuisineOptions(items);
  const bounds = yearBounds(items);

  const inclCount = filter.cuisine.filter((e) => !e.neg).length;
  const cuisineLabel =
    inclCount > 0
      ? `Cuisine: ${inclCount} selected`
      : filter.cuisine.length > 0
        ? `Cuisine: ${filter.cuisine.length} excluded`
        : 'Cuisine: all';

  const from = filter.yearFrom ?? bounds?.min ?? 0;
  const to = filter.yearTo ?? bounds?.max ?? 0;
  const eraActive = filter.yearFrom !== null || filter.yearTo !== null;
  const eraLabel = bounds ? (eraActive ? `Era: ${from}–${to}` : 'Era: all years') : 'Era';

  return (
    <div style={{ marginBottom: 14 }}>
      <input
        value={filter.q}
        onChange={(e) => onChange({ ...filter, q: e.target.value })}
        placeholder="⌕ Search books…"
        aria-label="Search books"
        style={{
          width: '100%',
          background: 'var(--card)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '10px 12px',
          fontSize: 14,
          marginBottom: 8,
        }}
      />

      {(cuisines.length > 0 || bounds) && (
        <div data-testid="book-filter-drops" style={{ display: 'flex', gap: 8, marginBottom: 8, overflowX: 'auto' }}>
          {cuisines.length > 0 && (
            <DropBtn
              label={cuisineLabel}
              active={filter.cuisine.length > 0}
              open={open === 'cuisine'}
              onClick={() => setOpen(open === 'cuisine' ? null : 'cuisine')}
            />
          )}
          {bounds && (
            <DropBtn
              label={eraLabel}
              active={eraActive}
              open={open === 'era'}
              onClick={() => setOpen(open === 'era' ? null : 'era')}
            />
          )}
        </div>
      )}

      {open === 'cuisine' && cuisines.length > 0 && (
        <DashPanel>
          <SelChip label="All cuisines" state="off" onClick={() => onChange({ ...filter, cuisine: [] })} />
          {cuisines.map((c) => {
            const entry = filter.cuisine.find((e) => e.id === c);
            return (
              <SelChip
                key={c}
                label={cap(c)}
                state={entry ? (entry.neg ? 'not' : 'inc') : 'off'}
                onClick={() => onChange({ ...filter, cuisine: cycleSel(filter.cuisine, c) })}
              />
            );
          })}
        </DashPanel>
      )}

      {open === 'era' && bounds && (
        <DashPanel>
          <YearRange
            min={bounds.min}
            max={bounds.max}
            from={from}
            to={to}
            onChange={(lo, hi) =>
              onChange({
                ...filter,
                // Store null when a handle sits at its bound, so switching lists
                // (different min/max) doesn't strand a stale absolute year.
                yearFrom: lo <= bounds.min ? null : lo,
                yearTo: hi >= bounds.max ? null : hi,
              })
            }
          />
          {eraActive && (
            <button
              onClick={() => onChange({ ...filter, yearFrom: null, yearTo: null })}
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
              All years
            </button>
          )}
        </DashPanel>
      )}
    </div>
  );
}

// Dual-handle range slider (round-2 amendment 6). Two overlaid native range
// inputs — touch-friendly on mobile, and each handle clamps against the other
// so they can't cross. The selected span and the real min/max bounds are
// labelled numerically above the track. min===max (a single-year list) degrades
// to a static label with no draggable track.
function YearRange({
  min,
  max,
  from,
  to,
  onChange,
}: {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (lo: number, hi: number) => void;
}) {
  const span = max - min;
  const pct = (v: number) => (span === 0 ? 0 : ((v - min) / span) * 100);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ color: 'var(--ink-soft)' }}>{min}</span>
        <b data-testid="year-range-value" style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {from} – {to}
        </b>
        <span style={{ color: 'var(--ink-soft)' }}>{max}</span>
      </div>
      {span === 0 ? (
        <div className="meta" style={{ textAlign: 'center' }}>
          Only one publication year in this list.
        </div>
      ) : (
        <div style={{ position: 'relative', height: 32 }}>
          {/* track */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: 'var(--line)',
            }}
          />
          {/* selected fill */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: `${pct(from)}%`,
              right: `${100 - pct(to)}%`,
              height: 4,
              borderRadius: 2,
              background: 'var(--accent)',
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={from}
            aria-label="Earliest year"
            onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
            className="year-range-input"
            style={{ zIndex: from > max - span / 2 ? 5 : 3 }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={to}
            aria-label="Latest year"
            onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
            className="year-range-input"
            style={{ zIndex: 4 }}
          />
        </div>
      )}
    </div>
  );
}

const cap = (s: string): string => (s === '' ? s : s[0].toUpperCase() + s.slice(1));
