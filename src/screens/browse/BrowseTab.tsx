// Browse tab (plan Task 21; canvas 2d, screenshot 06; dark 3e): global flat
// pill search over EVERY recipe, two collapsible dashed dropdowns (books /
// categories) whose chips carry the same include↔not cycle as pills, a
// status chip row, result count line, and the full RecipeRow list. Row tap
// opens the universal recipe card sheet (Task 22).
//
// Book-tag inheritance (plan Task 23 Step 2 note): the pill hay is built AT
// THIS CALL SITE as recipe name + recipe tags + the book's tags, so a book
// tagged "vegetarian" makes every one of its recipes match a "vegetarian"
// pill without copying the tag onto each recipe.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { store, useStore } from '../../data/store';
import type { Pill as PillT, Recipe } from '../../data/types';
import { addPill, recipeMatches, removePill, togglePill } from '../../logic/pills';
import { Pill } from '../../components/Pill';
import { RecipeRow, RowList } from '../../components/RecipeRow';
import { useToast } from '../../components/Toast';
import { spineColor } from '../../components/spine';

// Dropdown selections keep TAP ORDER, not a Set: the Nth *included* book gets
// spine color N (canvas 2d shows session-order colors on selected book chips
// and their recipes' stripes; unselected/not'd stay neutral).
type SelEntry = { id: string; neg: boolean };

/** include → not → off (same cycle as pills, applied to dropdown chips). */
const cycleSel = (sel: SelEntry[], id: string): SelEntry[] => {
  const cur = sel.find((e) => e.id === id);
  if (!cur) return [...sel, { id, neg: false }];
  if (!cur.neg) return sel.map((e) => (e.id === id ? { ...e, neg: true } : e));
  return sel.filter((e) => e.id !== id);
};

// Simple windowing (plan Task 21 Step 2: "virtualize with simple windowing
// only if it visibly janks"). Measured first, as instructed: a flat render of
// all 1,663 seeded rows cost ~575ms interaction→paint (dev Chromium, 390×844)
// on every filter change — visible jank. Windowed: render the first PAGE
// matches, append PAGE_MORE whenever the sentinel nears the viewport. No row
// heights, no absolute positioning. Filter changes reset the window; store
// edits (version bumps) keep it, so the sheet's edits don't jump the scroll.
const PAGE = 80;
const PAGE_MORE = 160;

type StatusKey = 'active' | 'made' | 'planned' | 'never' | 'star8';
const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'made', label: 'Made ✓' },
  { key: 'planned', label: 'Planned' },
  { key: 'never', label: 'Never make' },
  { key: 'star8', label: '★ 8+' },
];

export function BrowseTab() {
  const version = useStore((s) => s.version);
  const [pills, setPills] = useState<PillT[]>([]);
  const [bookSel, setBookSel] = useState<SelEntry[]>([]);
  const [catSel, setCatSel] = useState<SelEntry[]>([]);
  const [statusSel, setStatusSel] = useState<ReadonlySet<StatusKey>>(new Set());
  const [openPanel, setOpenPanel] = useState<'books' | 'cats' | null>(null);
  const showToast = useToast(); // placeholder until the universal recipe card lands (Task 22)
  const [limit, setLimit] = useState(PAGE);

  // New filter = new result set: window back to the top. Store edits (version
  // bumps) deliberately do NOT reset it — see windowing note above.
  const filterKey = JSON.stringify([pills, bookSel, catSel, [...statusSel]]);
  useEffect(() => {
    setLimit(PAGE);
  }, [filterKey]);

  const books = store.books;
  const categories = store.categories;

  // Max rating per recipe — the ★ n shown on rows is the BEST the dish ever
  // scored (plan: "gold ★ rating = max of entries"), and ★ 8+ filters on it.
  const maxRating = useMemo(() => {
    void version;
    const m = new Map<string, number>();
    for (const e of store.madeEntries) {
      if (e.recipeId === null || e.rating === undefined) continue;
      if ((m.get(e.recipeId) ?? 0) < e.rating) m.set(e.recipeId, e.rating);
    }
    return m;
  }, [version]);

  const includeOrder = bookSel.filter((e) => !e.neg).map((e) => e.id);

  // Filter + rows in ONE memo: typing in the ghost input (local state in
  // GhostInput) and opening/closing the sheet must not re-render ~1,663
  // RecipeRows — the cached element keeps React from touching the list.
  const { count, rows, catIncluded } = useMemo(() => {
    void version;
    const bookById = new Map(books.map((b) => [b.id, b]));
    const bookIncl = new Set(includeOrder);
    const bookExcl = new Set(bookSel.filter((e) => e.neg).map((e) => e.id));
    const catIncl = new Set(catSel.filter((e) => !e.neg).map((e) => e.id));
    const catExcl = new Set(catSel.filter((e) => e.neg).map((e) => e.id));
    const planned = store.plannedRecipeIds();

    const passes = (r: Recipe): boolean => {
      if (bookIncl.size > 0 && !bookIncl.has(r.bookId)) return false;
      if (bookExcl.has(r.bookId)) return false;
      if (catIncl.size > 0 && !catIncl.has(r.category)) return false;
      if (catExcl.has(r.category)) return false;
      if (pills.length > 0) {
        // Book-tag inheritance: the hay includes the owning book's tags.
        const bookTags = bookById.get(r.bookId)?.tags ?? [];
        if (!recipeMatches({ name: r.name, tags: [...r.tags, ...bookTags] }, pills)) return false;
      }
      // Status chips AND together (and with everything else): each selected
      // chip is one more predicate the recipe must satisfy.
      for (const s of statusSel) {
        if (s === 'active' && r.status !== 'active') return false;
        if (s === 'never' && r.status !== 'excluded') return false;
        if (s === 'made' && store.madeCountFor(r.id) === 0) return false;
        if (s === 'planned' && !planned.has(r.id)) return false;
        if (s === 'star8' && (maxRating.get(r.id) ?? 0) < 8) return false;
      }
      return true;
    };

    const filtered = store.recipes.filter(passes);
    const rows = (
      <RowList>
        {filtered.slice(0, limit).map((r) => {
          const made = store.madeCountFor(r.id);
          const rating = maxRating.get(r.id);
          const tagsMeta = r.tags.length > 0 ? ` · ${r.tags.length === 1 ? 'tag' : 'tags'}: ${r.tags.join(', ')}` : '';
          return (
            <RecipeRow
              key={r.id}
              name={r.name}
              page={r.page}
              meta={`${bookById.get(r.bookId)?.name ?? 'Unknown book'} · ${r.category}${tagsMeta}`}
              // Selected books carry their tap-order color onto their rows
              // (canvas 2d); everything else is neutral (indexOf → -1).
              color={spineColor(includeOrder.indexOf(r.bookId))}
              tag={
                r.status === 'excluded'
                  ? { kind: 'never' }
                  : made > 0
                    ? { kind: 'made', label: made > 1 ? `Made ×${made}` : 'Made' }
                    : undefined
              }
              rating={rating}
              dimmed={r.status === 'excluded'}
              onClick={() => showToast('Opens the universal recipe card (Task 22)')}
            />
          );
        })}
      </RowList>
    );
    return { count: filtered.length, rows, catIncluded: catIncl.size };
    // includeOrder is derived from bookSel above — bookSel covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, pills, bookSel, catSel, statusSel, maxRating, books, limit]);

  // "6 recipes · chicken, not fried, made, in 2 books" (canvas 2d).
  const bits: React.ReactNode[] = [];
  for (const p of pills) bits.push(p.neg ? <span key={`p${p.text}`}>not <b>{p.text}</b></span> : <b key={`p${p.text}`}>{p.text}</b>);
  for (const c of STATUS_CHIPS) {
    if (statusSel.has(c.key)) bits.push(c.key === 'star8' ? '★ 8+' : c.label.replace(' ✓', '').toLowerCase());
  }
  if (includeOrder.length > 0) bits.push(`in ${includeOrder.length} book${includeOrder.length === 1 ? '' : 's'}`);
  if (catIncluded > 0) bits.push(`${catIncluded} categor${catIncluded === 1 ? 'y' : 'ies'}`);

  const booksLabel =
    includeOrder.length > 0
      ? `Books: ${includeOrder.length} selected`
      : bookSel.length > 0
        ? `Books: ${bookSel.length} excluded`
        : 'Books: all';
  const catInclCount = catSel.filter((e) => !e.neg).length;
  const catsLabel =
    catInclCount > 0
      ? `Categories: ${catInclCount} selected`
      : catSel.length > 0
        ? `Categories: ${catSel.length} excluded`
        : 'Categories: all';

  return (
    <main style={{ padding: '20px 16px 96px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}
        >
          Page to Plate
        </div>
        <button
          aria-label="Settings"
          onClick={() => {
            window.location.hash = '#/settings';
          }}
          style={{ color: 'var(--ink-soft)', padding: 6, display: 'grid', placeItems: 'center' }}
        >
          <Settings size={20} />
        </button>
      </div>
      <h1 className="screen-title" style={{ margin: '2px 0 12px' }}>Browse</h1>

      {/* Pill search field — pills live INSIDE the field (canvas 2d). */}
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
          marginBottom: 10,
        }}
      >
        {pills.map((p, i) => (
          <Pill
            key={p.text}
            label={p.text}
            neg={p.neg}
            onCycle={() => setPills(togglePill(pills, i))}
            onRemove={() => setPills(removePill(pills, i))}
          />
        ))}
        <GhostInput onAdd={(text) => setPills(addPill(pills, text))} />
      </div>

      {/* Collapsible dropdowns. Opening one closes the other. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <DropBtn
          label={booksLabel}
          active={bookSel.length > 0}
          open={openPanel === 'books'}
          onClick={() => setOpenPanel(openPanel === 'books' ? null : 'books')}
        />
        <DropBtn
          label={catsLabel}
          active={catSel.length > 0}
          open={openPanel === 'cats'}
          onClick={() => setOpenPanel(openPanel === 'cats' ? null : 'cats')}
        />
      </div>

      {openPanel === 'books' && (
        <DashPanel>
          <SelChip label="All books" state="off" onClick={() => setBookSel([])} />
          {books.map((b) => {
            const entry = bookSel.find((e) => e.id === b.id);
            const state = entry ? (entry.neg ? 'not' : 'inc') : 'off';
            return (
              <SelChip
                key={b.id}
                label={b.name}
                state={state}
                // 11×16 swatch: tap-order spine color for included books,
                // neutral otherwise (Browse itself is not a session — only
                // the dropdown selection is colored; canvas 2d).
                swatch={state === 'inc' ? spineColor(includeOrder.indexOf(b.id)) : 'var(--neutral-spine)'}
                onClick={() => setBookSel(cycleSel(bookSel, b.id))}
              />
            );
          })}
        </DashPanel>
      )}
      {openPanel === 'cats' && (
        <DashPanel>
          <SelChip label="All categories" state="off" onClick={() => setCatSel([])} />
          {categories.map((c) => {
            const entry = catSel.find((e) => e.id === c.name);
            return (
              <SelChip
                key={c.id}
                label={c.name}
                state={entry ? (entry.neg ? 'not' : 'inc') : 'off'}
                onClick={() => setCatSel(cycleSel(catSel, c.name))}
              />
            );
          })}
        </DashPanel>
      )}

      {/* Status chips — multi-toggleable, AND semantics. */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUS_CHIPS.map((c) => {
          const on = statusSel.has(c.key);
          return (
            <button
              key={c.key}
              aria-pressed={on}
              onClick={() => {
                const next = new Set(statusSel);
                if (on) next.delete(c.key);
                else next.add(c.key);
                setStatusSel(next);
              }}
              style={{
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                background: on ? 'var(--accent-tint)' : 'var(--card)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 13px',
                fontSize: 12.5,
                fontWeight: on ? 700 : 600,
                color: on ? 'var(--accent)' : 'var(--ink-soft)',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div data-testid="result-count" style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
        {count.toLocaleString('en-US')} recipe{count === 1 ? '' : 's'}
        {bits.map((b, i) => (
          <span key={i}>{i === 0 ? ' · ' : ', '}{b}</span>
        ))}
      </div>

      {count === 0 ? <p className="meta">No recipes match — remove a filter or two.</p> : rows}
      {count > limit && <MoreSentinel onMore={() => setLimit((l) => l + PAGE_MORE)} />}
    </main>
  );
}

// Invisible load-more marker for the windowed list: extends the window when
// scrolled within 600px of the rendered tail (see windowing note at top).
function MoreSentinel({ onMore }: { onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMoreRef = useRef(onMore);
  onMoreRef.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onMoreRef.current();
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} aria-hidden style={{ height: 1 }} />;
}

// Own component so typing re-renders only the input, never the (potentially
// 1,663-row) list behind it.
function GhostInput({ onAdd }: { onAdd: (text: string) => void }) {
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
      aria-label="Add search keyword"
      enterKeyHint="done"
      style={{ flex: 1, minWidth: 80, border: 'none', background: 'transparent', fontSize: 14, padding: '6px 0' }}
    />
  );
}

function DropBtn({ label, active, open, onClick }: { label: string; active: boolean; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{
        flex: 1,
        minHeight: 40,
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'var(--accent-tint)' : 'var(--card)',
        borderRadius: 'var(--r-pill)',
        fontSize: 12.5,
        fontWeight: active ? 700 : 600,
        color: active ? 'var(--accent)' : 'var(--ink-mid)',
      }}
    >
      {label} ▾
    </button>
  );
}

function DashPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1.5px dashed var(--dash)',
        borderRadius: 'var(--r-card)',
        padding: 9,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

/** Dropdown chip: off (neutral) / inc (colored border+tint, ✓) / not (danger, "not " prefix). */
function SelChip({
  label,
  state,
  swatch,
  onClick,
}: {
  label: string;
  state: 'off' | 'inc' | 'not';
  /** 11×16 spine swatch color; omitted for category chips. */
  swatch?: string;
  onClick: () => void;
}) {
  const color = state === 'inc' ? (swatch && swatch !== 'var(--neutral-spine)' ? swatch : 'var(--accent)') : 'var(--danger)';
  const styles =
    state === 'off'
      ? { border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink-soft)', fontWeight: 600 }
      : state === 'inc'
        ? {
            border: `1.5px solid ${color}`,
            // color-mix ≈ the canvas rgba(spine,.09) tints — CSS vars can't
            // take an alpha channel directly.
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color,
            fontWeight: 700,
          }
        : { border: '1.5px solid var(--danger)', background: 'var(--danger-tint)', color: 'var(--danger)', fontWeight: 700 };
  return (
    <button
      onClick={onClick}
      aria-pressed={state !== 'off'}
      style={{
        ...styles,
        borderRadius: 'var(--r-pill)',
        padding: '7px 12px',
        fontSize: 12.5,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {swatch !== undefined && (
        <i
          aria-hidden
          style={{
            width: 11,
            height: 16,
            borderRadius: 2,
            background: state === 'not' ? 'var(--neutral-spine)' : swatch,
            boxShadow: 'inset -2px 0 0 rgba(0,0,0,.18)',
            flex: 'none',
          }}
        />
      )}
      {state === 'not' ? `not ${label}` : state === 'inc' ? `${label} ✓` : label}
    </button>
  );
}
