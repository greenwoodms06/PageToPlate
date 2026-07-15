// Books tab (plan Tasks 23+25; canvas 2f, screenshot 08): "My shelf · N" /
// "Library · N packs" segment chips. Shelf = the user's own books (neutral
// spines — colors are session-scoped to generation), + Add book / Import CSV
// entry points. Library = the content-pack catalog (LibrarySection, Task 25).
import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { store, useStore } from '../../data/store';
import { newId } from '../../data/types';
import type { Cookbook, Recipe } from '../../data/types';
import { fetchCatalog, type CatalogPack } from '../../data/packs';
import { Dialog } from '../../components/Dialog';
import { SpineChip } from '../../components/SpineChip';
import { StatusTag } from '../../components/StatusTag';
import { useToast } from '../../components/Toast';
import { CsvImportFlow } from './CsvImport';
import { LibrarySection } from './LibrarySection';
import { checkReassociation, ReassociateDialog, type ReassocPrompt } from './reassociate';

export function BooksTab() {
  useStore((s) => s.version);
  const [segment, setSegment] = useState<'shelf' | 'library'>('shelf');
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reassoc, setReassoc] = useState<ReassocPrompt | null>(null);
  const [catalog, setCatalog] = useState<{ packs: CatalogPack[]; offline: boolean }>({ packs: [], offline: false });

  useEffect(() => {
    let live = true;
    void fetchCatalog().then((c) => {
      if (live) setCatalog(c);
    });
    return () => {
      live = false;
    };
  }, []);

  const books = store.books;

  // After ANY book add the re-association hook runs (Task 23 Step 3); pack
  // installs land here via LibrarySection's onInstalled.
  const onBookAdded = (book: Cookbook, recipes: Recipe[]) => {
    setReassoc(checkReassociation(book, recipes));
  };

  return (
    <main style={{ padding: '20px 16px 96px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>
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
      <h1 className="screen-title" style={{ margin: '2px 0 0' }}>Books</h1>

      {/* Segment chips (canvas 2f) */}
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px' }}>
        <SegmentChip
          label={`My shelf · ${books.length}`}
          on={segment === 'shelf'}
          onClick={() => setSegment('shelf')}
        />
        <SegmentChip
          label={`Library · ${catalog.packs.length} pack${catalog.packs.length === 1 ? '' : 's'}`}
          on={segment === 'library'}
          onClick={() => setSegment('library')}
        />
      </div>

      {segment === 'shelf' ? (
        <>
          {books.length === 0 ? (
            <p className="meta" style={{ margin: '4px 0 14px' }}>
              No books yet — add one below, import a CSV, or install a pack from the Library.
            </p>
          ) : (
            books.map((b) => <ShelfRow key={b.id} book={b} />)
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                flex: 1,
                minHeight: 46,
                border: '1.5px solid var(--accent)',
                background: 'none',
                color: 'var(--accent)',
                borderRadius: 'var(--r-card)',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              + Add book
            </button>
            <button
              onClick={() => setImporting(true)}
              style={{
                flex: 1,
                minHeight: 46,
                border: '1.5px solid var(--line)',
                background: 'none',
                color: 'var(--ink-mid)',
                borderRadius: 'var(--r-card)',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              Import CSV
            </button>
          </div>
        </>
      ) : (
        <LibrarySection packs={catalog.packs} offline={catalog.offline} onInstalled={onBookAdded} />
      )}

      {addOpen && (
        <AddBookDialog
          onClose={() => setAddOpen(false)}
          onAdded={(book) => {
            // Empty book ⇒ checkReassociation can never pair (recipes match by
            // name), so this returns null today — kept for the invariant that
            // every book-add call site runs the hook.
            onBookAdded(book, []);
            window.location.hash = `#/books/${book.id}`;
          }}
        />
      )}
      {importing && <CsvImportFlow onClose={() => setImporting(false)} />}
      {reassoc && <ReassociateDialog prompt={reassoc} onClose={() => setReassoc(null)} />}
    </main>
  );
}

function SegmentChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
        background: on ? 'var(--accent-tint)' : 'var(--card)',
        borderRadius: 'var(--r-pill)',
        padding: '8px 15px',
        fontSize: 12.5,
        fontWeight: on ? 700 : 600,
        color: on ? 'var(--accent)' : 'var(--ink-mid)',
        minHeight: 40,
      }}
    >
      {label}
    </button>
  );
}

function ShelfRow({ book }: { book: Cookbook }) {
  const recipeCount = store.recipes.reduce((n, r) => (r.bookId === book.id ? n + 1 : n), 0);
  const ids = new Set(store.recipes.filter((r) => r.bookId === book.id).map((r) => r.id));
  const madeCount = store.madeEntries.reduce((n, m) => (m.recipeId !== null && ids.has(m.recipeId) ? n + 1 : n), 0);
  return (
    <button
      onClick={() => {
        window.location.hash = `#/books/${book.id}`;
      }}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding: '13px 14px',
        marginBottom: 9,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        opacity: book.archived ? 0.6 : 1, // disabled books dim like excluded recipes
      }}
    >
      <SpineChip width={16} height={56} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{book.name}</b>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)' }}>
          {recipeCount.toLocaleString('en-US')} recipe{recipeCount === 1 ? '' : 's'} · {madeCount} made
        </span>
        {(book.packId || book.archived) && (
          <span style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {book.packId && <StatusTag kind="installed" />}
            {/* Warm-gray tag (index-only palette) — "Disabled" has no tint of
                its own on the canvas; reuse the muted pair. */}
            {book.archived && <StatusTag kind="index-only" label="Disabled" />}
          </span>
        )}
      </span>
      <span style={{ color: 'var(--ink-disabled)' }}>›</span>
    </button>
  );
}

function AddBookDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (book: Cookbook) => void }) {
  const showToast = useToast();
  const [name, setName] = useState('');

  const add = async () => {
    const book: Cookbook = {
      id: newId(),
      name: name.trim(),
      tags: [],
      archived: false,
      createdAt: new Date().toISOString(),
    };
    onClose();
    await store.addBook(book);
    showToast('Book added', () => void store.deleteBookHard(book.id));
    onAdded(book);
  };

  return (
    <Dialog open onClose={onClose} label="Add book">
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.01em' }}>
        Add a book
      </div>
      <p className="meta" style={{ margin: '4px 0 12px' }}>
        Just the name for now — add recipes on the book page, or re-import a CSV any time.
      </p>
      <div className="field-label" style={{ color: 'var(--ink-soft)', marginBottom: 6 }}>Book name</div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim() !== '') void add();
        }}
        aria-label="Book name"
        style={{
          width: '100%',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-inner)',
          padding: '10px 12px',
          fontSize: 14,
          background: 'var(--card)',
        }}
      />
      <button
        onClick={() => void add()}
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
        Add book
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
