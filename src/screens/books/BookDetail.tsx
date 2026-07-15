// Book detail (plan Task 23 Step 2; canvas 5c, screenshot 16). Own hash route
// #/books/<id> so system back returns to the shelf. Editable title + book
// tags save instantly with toast Undo (spec rule 12), stat card, action list,
// and the disable/delete pair — delete offers keep-history (default) vs
// delete-everything per spec rule 8.
//
// NEUTRAL spine: canvas 5c paints the spine blue, but book colors are
// session-scoped to generation by design (handoff signature rule) — outside a
// session the spine is neutral, same as RecipeCardSheet.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { store, useStore } from '../../data/store';
import { newId } from '../../data/types';
import type { Pill as PillT, Recipe } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { PillEditor } from '../../components/PillEditor';
import { SpineChip } from '../../components/SpineChip';
import { useToast } from '../../components/Toast';
import { presetBrowseBook } from '../browse/BrowseTab';
import { CsvImportFlow } from './CsvImport';

const sectionLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
  fontWeight: 700,
  margin: '14px 0 6px',
};

const statNum: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 800,
  color: 'var(--ink)',
};

const footerBtn: CSSProperties = {
  flex: 1,
  minHeight: 46,
  border: '1.5px solid var(--line)',
  background: 'none',
  borderRadius: 'var(--r-card)',
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--ink-mid)',
};

// 'May 2026' from an ISO timestamp (canvas 5c meta line).
const monthYear = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export function BookDetail({ bookId }: { bookId: string }) {
  const showToast = useToast();
  useStore((s) => s.version);
  const book = store.books.find((b) => b.id === bookId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [addRecipe, setAddRecipe] = useState(false);
  const [reimport, setReimport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Deleted while open (or a stale URL): nothing to render but a way back.
  if (!book) {
    return (
      <main style={{ padding: '20px 16px 96px' }}>
        <BackHeader />
        <p className="meta" style={{ marginTop: 12 }}>
          This book no longer exists.
        </p>
      </main>
    );
  }

  const recipes = store.recipes.filter((r) => r.bookId === book.id);
  const recipeIds = new Set(recipes.map((r) => r.id));
  const entries = store.madeEntries.filter((m) => m.recipeId !== null && recipeIds.has(m.recipeId));

  // ── stats (canvas 5c stat card) ─────────────────────────────────────────
  const madeCount = entries.length;
  const cookedRecipes = new Set(entries.map((e) => e.recipeId)).size;
  const explored = recipes.length > 0 ? Math.round((100 * cookedRecipes) / recipes.length) : 0;
  const rated = entries.filter((e) => e.rating !== undefined);
  const avgRating = rated.length > 0 ? (rated.reduce((s, e) => s + e.rating!, 0) / rated.length).toFixed(1) : '—';
  let mostMade: { name: string; count: number } | null = null;
  {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.recipeId!, (counts.get(e.recipeId!) ?? 0) + 1);
    for (const [rid, count] of counts) {
      if (!mostMade || count > mostMade.count) {
        mostMade = { name: recipes.find((r) => r.id === rid)?.name ?? '—', count };
      }
    }
  }

  const commitTitle = (raw: string) => {
    setEditingTitle(false);
    const name = raw.trim();
    if (!name || name === book.name) return;
    const prior = book.name;
    void store.updateBook(book.id, { name });
    showToast('Book renamed', () => void store.updateBook(book.id, { name: prior }));
  };

  // Book tags are DATA, not filters (same reasoning as recipe tags on the
  // recipe card): a plain string list, so the pill neg-state has no meaning
  // here. A body-tap only flips neg — the tag SET is unchanged — and we skip
  // the write. Only add/remove reach the store.
  const onTagsChange = (next: PillT[]) => {
    const tags = next.map((p) => p.text);
    if (tags.join('\u0000') === book.tags.join('\u0000')) return; // body-tap cycle — ignore
    const prior = book.tags;
    void store.updateBook(book.id, { tags });
    showToast(tags.length > prior.length ? 'Tag added' : 'Tag removed', () =>
      void store.updateBook(book.id, { tags: prior }),
    );
  };

  const toggleArchived = () => {
    const next = !book.archived;
    void store.updateBook(book.id, { archived: next });
    showToast(next ? `“${book.name}” disabled` : `“${book.name}” enabled`, () =>
      void store.updateBook(book.id, { archived: book.archived }),
    );
  };

  return (
    <main style={{ padding: '20px 16px 32px' }}>
      <BackHeader />

      {/* Spine + title + meta */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0 4px' }}>
        <SpineChip width={18} height={60} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={book.name}
              aria-label="Book name"
              onBlur={(e) => commitTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur(); // commit via onBlur (once)
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              style={{
                width: '100%',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 21,
                letterSpacing: '-.01em',
                border: 'none',
                borderBottom: '1.5px solid var(--accent)',
                background: 'transparent',
                padding: '0 0 2px',
              }}
            />
          ) : (
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21, letterSpacing: '-.01em' }}>
              {book.name}{' '}
              <button
                aria-label="Edit book name"
                onClick={() => setEditingTitle(true)}
                style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, padding: '2px 4px' }}
              >
                ✎
              </button>
            </div>
          )}
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {recipes.length.toLocaleString('en-US')} recipes ·{' '}
            {book.packId ? 'content pack' : 'added'} · {monthYear(book.createdAt)}
            {book.archived && ' · disabled'}
          </div>
        </div>
      </div>

      <div style={sectionLabel}>Book tags</div>
      <PillEditor
        pills={book.tags.map((t): PillT => ({ text: t, neg: false }))}
        onChange={onTagsChange}
        placeholder="+ add tag…"
      />

      {/* Stat card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '13px 14px',
          display: 'flex',
          gap: 16,
          fontSize: 12.5,
          color: 'var(--ink-mid)',
          margin: '14px 0 10px',
        }}
      >
        <span>
          <b style={statNum}>{madeCount}</b>
          <br />
          made
        </span>
        <span>
          <b style={statNum}>{explored}%</b>
          <br />
          explored
        </span>
        <span>
          <b style={statNum}>{avgRating}</b>
          <br />
          avg rating
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ ...statNum, fontSize: 13 }}>{mostMade?.name ?? '—'}</b>
          <br />
          most made{mostMade ? ` · ${mostMade.count}×` : ''}
        </span>
      </div>

      {/* Action list */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <ActionRow
          divider
          label={`Browse its ${recipes.length.toLocaleString('en-US')} recipes`}
          onClick={() => {
            // Module-level one-shot handoff to Browse (choice documented at
            // presetBrowseBook): pre-selects this book in the books dropdown.
            presetBrowseBook(book.id);
            window.location.hash = '#/browse';
          }}
        />
        <ActionRow divider label="Add a recipe manually" onClick={() => setAddRecipe(true)} />
        <ActionRow
          label="Re-import CSV"
          caption="Updates recipes, never duplicates"
          onClick={() => setReimport(true)}
        />
      </div>

      {/* Disable / delete pair */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={toggleArchived} style={footerBtn}>
          {book.archived ? 'Enable book' : 'Disable book'}
        </button>
        <button onClick={() => setConfirmDelete(true)} style={{ ...footerBtn, color: 'var(--danger)' }}>
          Delete…
        </button>
      </div>
      <div className="hint" style={{ marginTop: 8, textAlign: 'center' }}>
        Disable hides it from generation but keeps all history — recommended over delete.
      </div>

      {addRecipe && <AddRecipeDialog book={{ id: book.id, name: book.name }} onClose={() => setAddRecipe(false)} />}
      {reimport && <CsvImportFlow book={book} onClose={() => setReimport(false)} />}
      {confirmDelete && (
        <DeleteBookDialog
          bookId={book.id}
          bookName={book.name}
          entryCount={madeCount}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}

function BackHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        aria-label="Back"
        onClick={() => window.history.back()}
        style={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-pill)',
          background: 'var(--card)',
          color: 'var(--ink-mid)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>
        Books / detail
      </div>
    </div>
  );
}

function ActionRow({
  label,
  caption,
  divider = false,
  onClick,
}: {
  label: string;
  caption?: string;
  divider?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: divider ? '1px dashed var(--line)' : 'none',
        padding: '13px 14px',
        fontSize: 14.5,
        color: 'var(--ink)',
        minHeight: 50,
      }}
    >
      <span style={{ flex: 1 }}>
        <b style={{ fontWeight: 600 }}>{label}</b>
        {caption && (
          <>
            <br />
            <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{caption}</small>
          </>
        )}
      </span>
      <span style={{ color: 'var(--ink-disabled)' }}>›</span>
    </button>
  );
}

// ── delete flow (spec rule 8) ────────────────────────────────────────────────

function DeleteBookDialog({
  bookId,
  bookName,
  entryCount,
  onClose,
}: {
  bookId: string;
  bookName: string;
  entryCount: number;
  onClose: () => void;
}) {
  const showToast = useToast();

  const keepHistory = async () => {
    onClose();
    await store.deleteBookKeepHistory(bookId);
    showToast(entryCount > 0 ? `Book deleted — ${entryCount} journal ${entryCount === 1 ? 'entry' : 'entries'} kept` : 'Book deleted');
    window.location.hash = '#/books';
  };

  const deleteEverything = async () => {
    onClose();
    await store.deleteBookHard(bookId);
    showToast('Book and history deleted');
    window.location.hash = '#/books';
  };

  return (
    <Dialog open onClose={onClose} label={`Delete ${bookName}`}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.01em' }}>
        Delete “{bookName}”?
      </div>
      <p className="meta" style={{ margin: '8px 0 14px' }}>
        The book and its recipes are removed either way. What happens to your cooking journal is up to you.
      </p>
      {/* DEFAULT choice: keep history — orphaned entries keep a readable
          snapshot and can reconnect if the book ever comes back (rule 8). */}
      <button
        onClick={() => void keepHistory()}
        style={{
          width: '100%',
          minHeight: 48,
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        Delete book, keep cooking history
      </button>
      <div className="hint" style={{ margin: '6px 0 12px', textAlign: 'center' }}>
        {entryCount > 0
          ? `Your ${entryCount} journal ${entryCount === 1 ? 'entry stays' : 'entries stay'} in the calendar and can reconnect later.`
          : 'Recommended — journal entries would stay in the calendar.'}
      </div>
      <button
        onClick={() => void deleteEverything()}
        style={{
          width: '100%',
          minHeight: 46,
          border: '1.5px solid var(--danger)',
          background: 'var(--danger-tint)',
          color: 'var(--danger)',
          borderRadius: 'var(--r-cta)',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Delete everything
      </button>
      <div className="hint" style={{ margin: '6px 0 12px', textAlign: 'center', color: 'var(--danger)' }}>
        Also erases {entryCount > 0 ? `all ${entryCount}` : 'any'} journal {entryCount === 1 ? 'entry' : 'entries'} and photos
        from this book — this cannot be undone.
      </div>
      <button
        onClick={onClose}
        style={{ width: '100%', minHeight: 42, color: 'var(--ink-mid)', fontSize: 13.5, fontWeight: 600 }}
      >
        Cancel
      </button>
    </Dialog>
  );
}

// ── manual add-recipe form (canvas 5c action list; plan Task 23 Step 2) ─────

function AddRecipeDialog({ book, onClose }: { book: { id: string; name: string }; onClose: () => void }) {
  const showToast = useToast();
  const [name, setName] = useState('');
  const [page, setPage] = useState('');
  const [category, setCategory] = useState(store.categories[0]?.name ?? 'Mains');
  const [pills, setPills] = useState<PillT[]>([]);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');

  const save = async () => {
    const recipe: Recipe = {
      id: newId(),
      bookId: book.id,
      name: name.trim(),
      page: page.trim(),
      category,
      tags: pills.map((p) => p.text),
      status: 'active',
      // isCustom recipes carry their own text and render it on the recipe card.
      isCustom: custom,
      text: custom && text.trim() !== '' ? text : undefined,
      attachmentIds: [],
      createdAt: new Date().toISOString(),
    };
    onClose();
    await store.addRecipes([recipe]);
    showToast('Recipe added', () => void store.deleteRecipe(recipe.id));
  };

  const fieldStyle: CSSProperties = {
    width: '100%',
    border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-inner)',
    padding: '10px 12px',
    fontSize: 14,
    background: 'var(--card)',
  };

  return (
    <Dialog open onClose={onClose} label="Add a recipe">
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.01em' }}>
        Add a recipe
      </div>
      <p className="meta" style={{ margin: '4px 0 12px' }}>to {book.name}</p>

      <div style={{ ...sectionLabel, margin: '0 0 6px' }}>Name</div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Recipe name" style={fieldStyle} />

      <div style={sectionLabel}>Page</div>
      <input
        value={page}
        onChange={(e) => setPage(e.target.value)}
        aria-label="Page"
        inputMode="numeric"
        style={{ ...fieldStyle, width: 110 }}
      />

      <div style={sectionLabel}>Category</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {store.categories.map((c) => {
          const on = c.name === category;
          return (
            <button
              key={c.id}
              aria-pressed={on}
              onClick={() => setCategory(c.name)}
              style={{
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                background: on ? 'var(--accent-tint)' : 'var(--card)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 12px',
                fontSize: 12.5,
                fontWeight: on ? 700 : 600,
                color: on ? 'var(--accent)' : 'var(--ink-soft)',
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div style={sectionLabel}>Tags</div>
      <PillEditor pills={pills} onChange={setPills} placeholder="+ add tag…" />

      {/* "Custom recipe" expander: user-authored dishes with their own text
          (isCustom) rather than a page in the physical book. */}
      <button
        onClick={() => setCustom(!custom)}
        aria-expanded={custom}
        style={{
          marginTop: 12,
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--accent)',
          padding: '4px 0',
        }}
      >
        {custom ? '▾' : '▸'} This is a custom recipe (write it in)
      </button>
      {custom && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Recipe text"
          rows={5}
          placeholder="Ingredients, steps…"
          style={{ ...fieldStyle, marginTop: 6, resize: 'vertical', background: 'var(--paper)' }}
        />
      )}

      <button
        onClick={() => void save()}
        disabled={name.trim() === ''}
        style={{
          width: '100%',
          minHeight: 48,
          marginTop: 14,
          background: name.trim() === '' ? 'var(--accent-disabled)' : 'var(--accent)',
          color: 'var(--on-accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        Add recipe
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', minHeight: 42, marginTop: 6, color: 'var(--ink-mid)', fontSize: 13.5, fontWeight: 600 }}
      >
        Cancel
      </button>
    </Dialog>
  );
}
