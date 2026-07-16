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
import { displayRating, ratingMatches } from '../../logic/rating';
import { Pill } from '../../components/Pill';
import { RecipeRow, RowList } from '../../components/RecipeRow';
import { SegmentToggle } from '../../components/SegmentToggle';
import { spineColor } from '../../components/spine';
import { DashPanel, DropBtn, SelChip, cycleSel, type SelEntry } from '../../components/FilterControls';
import { RecipeCardSheet } from '../recipe/RecipeCardSheet';

// Dropdown selections keep TAP ORDER, not a Set: the Nth *included* book gets
// spine color N (canvas 2d shows session-order colors on selected book chips
// and their recipes' stripes; unselected/not'd stay neutral). The include→not
// →off chip cycle (SelChip / cycleSel) is shared with the Books tab —
// components/FilterControls.tsx.

// Simple windowing (plan Task 21 Step 2: "virtualize with simple windowing
// only if it visibly janks"). Measured first, as instructed: a flat render of
// all 1,663 seeded rows cost ~575ms interaction→paint (dev Chromium, 390×844)
// on every filter change — visible jank. Windowed: render the first PAGE
// matches, append PAGE_MORE whenever the sentinel nears the viewport. No row
// heights, no absolute positioning. Filter changes reset the window; store
// edits (version bumps) keep it, so the sheet's edits don't jump the scroll.
const PAGE = 80;
const PAGE_MORE = 160;

// One-shot pre-filter handoff (Task 23: BookDetail's "Browse its N recipes").
// A module variable, not a hash query param: Browse filter state is never
// serialized to the URL anywhere else (deep-linking a filtered Browse is out
// of scope for v1), and the handoff is consumed exactly once on mount, so a
// plain variable keeps #/browse clean and adds no parse/serialize code.
let pendingBookFilter: string | null = null;
export function presetBrowseBook(bookId: string): void {
  pendingBookFilter = bookId;
}

type StatusKey = 'active' | 'made' | 'planned' | 'never';
const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'made', label: 'Made ✓' },
  { key: 'planned', label: 'Planned' },
  { key: 'never', label: 'Never make' },
];

// Flexible rating filter (Checkpoint 2 amendment 2) — replaced the fixed
// "★ 8+" chip. Value is in DISPLAY units (1..scale); ratingMatches maps it
// onto stored 1–10 (bin-aware on the 5-scale).
type RatingMode = 'above' | 'exact' | 'below';
type RatingSel = { value: number; mode: RatingMode };
const RATING_MODE_OPTIONS: { key: RatingMode; label: string }[] = [
  { key: 'above', label: 'and above' },
  { key: 'exact', label: 'exactly' },
  { key: 'below', label: 'and below' },
];
const ratingChipLabel = (sel: RatingSel): string =>
  sel.mode === 'above' ? `★ ${sel.value}+` : sel.mode === 'exact' ? `★ ${sel.value}` : `★ ≤${sel.value}`;

export function BrowseTab() {
  const version = useStore((s) => s.version);
  const [pills, setPills] = useState<PillT[]>([]);
  const [bookSel, setBookSel] = useState<SelEntry[]>(() => {
    // Consume the one-shot handoff (see presetBrowseBook above).
    const id = pendingBookFilter;
    pendingBookFilter = null;
    return id ? [{ id, neg: false }] : [];
  });
  const [catSel, setCatSel] = useState<SelEntry[]>([]);
  const [statusSel, setStatusSel] = useState<ReadonlySet<StatusKey>>(new Set());
  const [ratingSel, setRatingSel] = useState<RatingSel | null>(null);
  const [openPanel, setOpenPanel] = useState<'books' | 'cats' | 'rating' | null>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  // New filter = new result set: window back to the top. Store edits (version
  // bumps) deliberately do NOT reset it — see windowing note above.
  const filterKey = JSON.stringify([pills, bookSel, catSel, [...statusSel], ratingSel]);
  useEffect(() => {
    setLimit(PAGE);
  }, [filterKey]);

  const books = store.books;
  const categories = store.categories;
  const scale = store.settings.ratingScale;
  // Defensive clamp only — BrowseTab unmounts on navigation, so the scale
  // cannot flip while a filter is live; the clamp guards future refactors.
  const effRating = ratingSel ? { ...ratingSel, value: Math.min(ratingSel.value, scale) } : null;
  // Panel selection before any tap: the old fixed chip's behavior (8+ on the
  // 10-scale, its bin twin 4+ on the 5-scale). Applied only when tapped.
  const ratingDraft = effRating ?? { value: scale === 10 ? 8 : 4, mode: 'above' as RatingMode };

  // Max rating per recipe (stored 1–10 units) — the ★ n shown on rows is the
  // BEST the dish ever scored (plan: "gold ★ rating = max of entries"), and
  // the rating filter matches against it.
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
      }
      if (effRating) {
        const max = maxRating.get(r.id);
        // Unrated recipes never match ANY mode — "★ ≤3" means "rated 3 or
        // lower", not "not rated highly" (the old ★ 8+ chip also excluded
        // unrated recipes; a rating filter is a statement about ratings).
        if (max === undefined) return false;
        // "and below" is INCLUSIVE in the UI ("★ ≤3" keeps a display-3
        // recipe), but ratingMatches' 'below' mode is the strict complement
        // of 'above' (contract pinned in rating.test.ts). value+1 converts:
        // 5-scale "≤3" → below bin 4 → stored < 7 → bins 1–3, as a user reads
        // the chip. Without the +1, "★ ≤3" would silently drop every recipe
        // the list itself shows as ★ 3.
        const threshold = effRating.mode === 'below' ? effRating.value + 1 : effRating.value;
        if (!ratingMatches(max, threshold, effRating.mode, scale)) return false;
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
              rating={rating !== undefined ? displayRating(rating, scale) : undefined}
              dimmed={r.status === 'excluded'}
              onClick={() => setOpenRecipeId(r.id)}
            />
          );
        })}
      </RowList>
    );
    return { count: filtered.length, rows, catIncluded: catIncl.size };
    // includeOrder is derived from bookSel above — bookSel covers it;
    // effRating is derived from ratingSel + scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, pills, bookSel, catSel, statusSel, ratingSel, scale, maxRating, books, limit]);

  // "6 recipes · chicken, not fried, made, in 2 books" (canvas 2d).
  const bits: React.ReactNode[] = [];
  for (const p of pills) bits.push(p.neg ? <span key={`p${p.text}`}>not <b>{p.text}</b></span> : <b key={`p${p.text}`}>{p.text}</b>);
  for (const c of STATUS_CHIPS) {
    if (statusSel.has(c.key)) bits.push(c.label.replace(' ✓', '').toLowerCase());
  }
  if (effRating) bits.push(ratingChipLabel(effRating));
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

      {/* Collapsible dropdowns. Opening one closes the others. Rating sits
          HERE, not in the status row (round-1 amendment 5): it behaves like
          Books/Categories (a dropdown panel, not a toggle), so it lives with
          them. Three chips can outgrow the column once labels lengthen
          ("Categories: 3 selected"), so the row scrolls horizontally instead
          of wrapping — useSwipeTabs detects that via scrollWidth and keeps a
          scroll-flick on this row from switching tabs. */}
      <div data-testid="filter-drop-row" style={{ display: 'flex', gap: 8, marginBottom: 8, overflowX: 'auto' }}>
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
        <DropBtn
          label={effRating ? ratingChipLabel(effRating) : '★ Rating'}
          active={effRating !== null}
          open={openPanel === 'rating'}
          onClick={() => setOpenPanel(openPanel === 'rating' ? null : 'rating')}
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
      {openPanel === 'rating' && (
        <DashPanel>
          {/* Plain numbers on one row, same grid as the Mark-as-made rating
              section — "★ 1" labels made the 10-cell row wrap (owner, round 2). */}
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${scale}, 1fr)`, gap: 5 }}>
            {Array.from({ length: scale }, (_, i) => i + 1).map((n) => {
              const on = ratingDraft.value === n;
              return (
                <button
                  key={n}
                  aria-pressed={on && effRating !== null}
                  onClick={() => setRatingSel({ ...ratingDraft, value: n })}
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
            onChange={(label) =>
              setRatingSel({ ...ratingDraft, mode: RATING_MODE_OPTIONS.find((m) => m.label === label)!.key })
            }
          />
          <button
            onClick={() => {
              setRatingSel(null);
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

      {/* Status chips — multi-toggleable, AND semantics. Status ONLY since
          round-1 amendment 5 moved the rating chip up to the dropdown row. */}
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

      {openRecipeId && <RecipeCardSheet recipeId={openRecipeId} onClose={() => setOpenRecipeId(null)} />}
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

