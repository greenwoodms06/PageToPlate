// CSV import flow (plan Task 24; canvas 5b, screenshot 15).
//
// A Sheet, not a route: the flow carries transient state that cannot live in
// a hash URL (the picked File, mapping choices, unsaved tag pills), and it
// opens from three places — Books tab "Import CSV", BookDetail "Re-import
// CSV" (book preselected), and the AI help page — which all just mount this
// component. Nothing is written to the store until "Import N recipes".
//
// Pipeline: file → parseRecipeCsv (logic/csv) → planImport (logic/importer,
// dedupe vs the target book) → user resolves unrecognized categories →
// resolveUnrecognized → commit (addBook/addRecipes/updateRecipe) → the
// re-association hook (reassociate.tsx) → navigate to the book.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { store, useStore } from '../../data/store';
import { newId } from '../../data/types';
import type { Cookbook, Pill as PillT, Recipe } from '../../data/types';
import { UNCATEGORIZED } from '../../data/categories';
import { parseRecipeCsv } from '../../logic/csv';
import type { ParsedRecipeRow } from '../../logic/csv';
import { planImport, resolveUnrecognized } from '../../logic/importer';
import { PillEditor } from '../../components/PillEditor';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { WarningNote } from '../../components/WarningNote';
import { checkReassociation, ReassociateDialog, type ReassocPrompt } from './reassociate';

const SAMPLE_ROWS = 8;

type MapChoice = { choice: 'map' | 'create' | 'uncat'; name: string };

/**
 * "Map to <best guess>" target for an unrecognized raw category: the first
 * category sharing a word with the raw value, else the first category
 * (Mains) — deliberately simple; the user confirms the choice either way.
 */
function bestGuess(raw: string, categoryNames: string[]): string {
  const words = new Set(raw.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  for (const c of categoryNames) {
    if (c.toLowerCase().split(/[^\p{L}]+/u).some((w) => words.has(w))) return c;
  }
  return categoryNames[0] ?? UNCATEGORIZED;
}

const sectionLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
  fontWeight: 700,
  margin: '0 0 6px',
};

export function CsvImportFlow({ book, onClose }: { book?: Cookbook; onClose: () => void }) {
  const showToast = useToast();
  const version = useStore((s) => s.version);
  const fileInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ base: string; rows: ParsedRecipeRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(book?.name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [pills, setPills] = useState<PillT[]>((book?.tags ?? []).map((t) => ({ text: t, neg: false })));
  const [mapping, setMapping] = useState<Record<string, MapChoice>>({});
  const [committing, setCommitting] = useState(false);
  const [reassoc, setReassoc] = useState<{ prompt: ReassocPrompt; bookId: string } | null>(null);

  // Convenience: open the OS picker immediately on mount (the user just
  // tapped an "Import CSV" affordance). The visible button below is the
  // fallback if the browser swallows the programmatic click.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpened.current) {
      autoOpened.current = true;
      fileInput.current?.click();
    }
  }, []);

  const onFile = async (f: File | null) => {
    if (!f) return;
    const parsed = parseRecipeCsv(await f.text());
    const rows = parsed.rows.filter((r) => r.name.trim() !== ''); // pageless is fine; nameless is noise
    if (rows.length === 0) {
      setError('No recipes found in that file — check it has recipe-name and page columns.');
      return;
    }
    const base = f.name.replace(/\.[^.]*$/, '');
    setError(null);
    setMapping({});
    if (!book) setName(base); // default book name: filename sans extension
    setPicked({ base, rows });
  };

  const categoryNames = useMemo(() => {
    void version; // store getters are version-cached; the dep re-runs this on any store change
    return store.categories.map((c) => c.name);
  }, [version]);

  const plan = useMemo(() => {
    if (!picked) return null;
    const existing = book ? store.recipes.filter((r) => r.bookId === book.id) : [];
    return planImport(picked.rows, existing, categoryNames);
    // store.recipes identity is covered by `version`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, book, categoryNames, version]);

  const resolved = useMemo(() => {
    if (!plan) return null;
    const m = new Map<string, string>();
    for (const [raw, c] of Object.entries(mapping)) m.set(raw, c.choice === 'uncat' ? UNCATEGORIZED : c.name);
    return resolveUnrecognized(plan, m);
  }, [plan, mapping]);

  if (reassoc) {
    return (
      <ReassociateDialog
        prompt={reassoc.prompt}
        onClose={() => {
          window.location.hash = `#/books/${reassoc.bookId}`;
          onClose();
        }}
      />
    );
  }

  const input = (
    <input
      ref={fileInput}
      type="file"
      accept=".csv,text/csv"
      hidden
      data-testid="csv-file-input"
      onChange={(e) => {
        void onFile(e.target.files?.[0] ?? null);
        e.target.value = ''; // allow re-picking the same file
      }}
    />
  );

  // ── stage 1: no file yet ─────────────────────────────────────────────────
  if (!picked || !plan || !resolved) {
    return (
      <Sheet open onClose={onClose} label="Import CSV">
        {input}
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>
          Import a CSV
        </div>
        <p className="meta" style={{ margin: '4px 0 14px' }}>
          {book ? `Re-import into “${book.name}” — updates recipes, never duplicates.` : 'One row per recipe: name, page, category.'}
        </p>
        {error && (
          <div style={{ marginBottom: 10 }}>
            <WarningNote>{error}</WarningNote>
          </div>
        )}
        <button
          onClick={() => fileInput.current?.click()}
          style={{
            width: '100%',
            minHeight: 52,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            borderRadius: 'var(--r-cta)',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Choose .csv file…
        </button>
        {!book && (
          <div className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
            No CSV yet?{' '}
            <a href="#/settings/ai-import" onClick={onClose} style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Build one with AI help
            </a>{' '}
            from photos of the table of contents.
          </div>
        )}
        <button
          onClick={onClose}
          style={{ width: '100%', minHeight: 46, marginTop: 8, border: '1.5px solid var(--line)', borderRadius: 'var(--r-cta)', color: 'var(--ink-mid)', fontSize: 14, fontWeight: 600 }}
        >
          Cancel
        </button>
      </Sheet>
    );
  }

  // ── stage 2: preview (canvas 5b) ─────────────────────────────────────────

  const unrecognized = [...plan.unrecognized.entries()];
  const allResolved = unrecognized.every(([raw]) => mapping[raw] !== undefined);
  const dups = plan.skips + plan.updates;
  const importCount = plan.adds + plan.updates;
  const distinctCats = new Set(resolved.rows.map((r) => r.category ?? r.rawCategory?.trim() ?? UNCATEGORIZED)).size;

  const commit = async () => {
    if (committing || !allResolved || importCount === 0) return;
    setCommitting(true);
    const tags = pills.map((p) => p.text);
    let target: Cookbook | undefined = book;
    if (!target) {
      target = {
        id: newId(),
        name: name.trim() || picked.base,
        tags,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      await store.addBook(target);
    } else if (tags.join('\u0000') !== target.tags.join('\u0000')) {
      await store.updateBook(target.id, { tags });
    }
    // Narrowed const for the closures below (TS can't narrow a mutated `let`
    // inside arrow functions).
    const dest: Cookbook = target;
    // "Create category" choices become real user categories before the rows land.
    for (const m of Object.values(mapping)) {
      if (m.choice === 'create' && !store.categories.some((c) => c.name.toLowerCase() === m.name.toLowerCase())) {
        await store.addCategory({ id: newId(), name: m.name, order: store.categories.length, isDefault: false, chips: [] });
      }
    }
    const adds: Recipe[] = resolved.rows
      .filter((r) => r.action === 'add')
      .map((row) => ({
        id: newId(),
        bookId: dest.id,
        name: row.name,
        page: row.page,
        category: row.category ?? UNCATEGORIZED, // allResolved makes this moot; belt-and-braces
        tags: row.tags,
        status: 'active',
        isCustom: false,
        attachmentIds: [],
        createdAt: new Date().toISOString(),
      }));
    if (adds.length > 0) await store.addRecipes(adds);
    let updated = 0;
    for (const row of resolved.rows) {
      if (row.action !== 'update' || !row.existingId) continue;
      const cur = store.recipes.find((r) => r.id === row.existingId);
      if (!cur) continue;
      // Updates correct page/category and merge tags (union) — they never
      // touch status or MadeEntries ("never duplicates", canvas 5c caption).
      await store.updateRecipe(cur.id, {
        page: row.page,
        category: row.category ?? cur.category,
        tags: [...new Set([...cur.tags, ...row.tags])],
      });
      updated += 1;
    }
    showToast(`${(adds.length + updated).toLocaleString('en-US')} recipes imported`);
    // Re-association hook (Task 23 Step 3) — against ALL of the book's
    // recipes, so a re-import can reconnect history to pre-existing rows too.
    const prompt = checkReassociation(dest, store.recipes.filter((r) => r.bookId === dest.id));
    if (prompt) {
      setReassoc({ prompt, bookId: dest.id });
    } else {
      window.location.hash = `#/books/${dest.id}`;
      onClose();
    }
  };

  return (
    <Sheet open onClose={onClose} label="Ready to import">
      {input}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>
        Ready to import
      </div>
      <p className="meta" style={{ margin: '4px 0 10px' }}>{picked.base}.csv</p>

      <div style={sectionLabel}>Book name</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--card)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '11px 13px',
          marginBottom: 10,
        }}
      >
        {book ? (
          // Re-import: the target book is fixed — rename lives on BookDetail.
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--ink-mid)' }}>{book.name}</span>
        ) : editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
            }}
            aria-label="Book name"
            style={{ flex: 1, fontSize: 15, fontWeight: 600, border: 'none', background: 'transparent', padding: 0 }}
          />
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{name}</span>
            <button
              aria-label="Edit book name"
              onClick={() => setEditingName(true)}
              style={{ fontSize: 13, color: 'var(--ink-soft)' }}
            >
              ✎
            </button>
          </>
        )}
      </div>

      <div style={sectionLabel}>
        Book tags{' '}
        <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-disabled)' }}>
          — applied to every recipe, filterable everywhere
        </span>
      </div>
      <PillEditor pills={pills} onChange={setPills} placeholder="+ add tag…" />

      {/* Green summary note */}
      <div
        style={{
          background: 'var(--accent-tint)',
          border: '1px solid var(--accent-disabled)',
          borderRadius: 'var(--r-card)',
          padding: '11px 13px',
          fontSize: 13.5,
          margin: '12px 0 10px',
        }}
        data-testid="import-summary"
      >
        <b>{plan.rows.length.toLocaleString('en-US')} recipes found</b> · {distinctCats}{' '}
        {distinctCats === 1 ? 'category' : 'categories'} · {dups} duplicate{dups === 1 ? '' : 's'}
      </div>

      {/* Unrecognized-category mapping (one warning per raw value) */}
      {unrecognized.map(([raw, count]) => {
        const guess = bestGuess(raw, categoryNames);
        const chosen = mapping[raw];
        const choiceBtn = (label: string, choice: MapChoice, emphasized = false): React.ReactNode => {
          const on = chosen?.choice === choice.choice;
          return (
            <button
              key={choice.choice}
              onClick={() => setMapping({ ...mapping, [raw]: choice })}
              aria-pressed={on}
              style={{
                border: `1.5px solid ${on || emphasized ? 'var(--accent)' : 'var(--line)'}`,
                background: on ? 'var(--accent-tint)' : 'var(--card)',
                color: on || emphasized ? 'var(--accent)' : 'var(--ink-mid)',
                borderRadius: 'var(--r-pill)',
                padding: '7px 13px',
                fontSize: 12.5,
                fontWeight: on || emphasized ? 700 : 600,
              }}
            >
              {label}
              {on ? ' ✓' : ''}
            </button>
          );
        };
        return (
          <div key={raw} style={{ marginBottom: 10 }}>
            <WarningNote>
              <b>Category isn’t recognized:</b> “{raw}” ({count} recipe{count === 1 ? '' : 's'})
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
                {choiceBtn(`Map to ${guess}`, { choice: 'map', name: guess }, true)}
                {choiceBtn('Create category', { choice: 'create', name: raw })}
                {choiceBtn('Uncategorized', { choice: 'uncat', name: UNCATEGORIZED })}
              </div>
            </WarningNote>
          </div>
        );
      })}

      <div style={{ ...sectionLabel, marginTop: 12 }}>Sample of what’s coming in</div>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          overflow: 'hidden',
          fontSize: 13.5,
        }}
      >
        {resolved.rows.slice(0, SAMPLE_ROWS).map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              borderBottom: '1px dashed var(--line)',
            }}
          >
            <span style={{ flex: 1 }}>{row.name}</span>
            <span style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>p. {row.page || '—'}</span>
            {row.category === null ? (
              <span style={{ color: 'var(--danger)', width: 88, textAlign: 'right', fontWeight: 600 }}>
                {row.rawCategory?.trim()}?
              </span>
            ) : (
              <span style={{ color: 'var(--ink-soft)', width: 88, textAlign: 'right' }}>{row.category}</span>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', padding: '10px 12px' }}>
          <span style={{ color: 'var(--ink-disabled)' }}>
            {resolved.rows.length > SAMPLE_ROWS
              ? `…and ${(resolved.rows.length - SAMPLE_ROWS).toLocaleString('en-US')} more`
              : 'that’s all of them'}
          </span>
        </div>
      </div>

      <button
        onClick={() => void commit()}
        disabled={!allResolved || importCount === 0 || committing}
        style={{
          width: '100%',
          minHeight: 52,
          background: !allResolved || importCount === 0 || committing ? 'var(--accent-disabled)' : 'var(--accent)',
          color: 'var(--on-accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 16,
          fontWeight: 700,
          marginTop: 14,
        }}
      >
        {committing
          ? 'Importing…'
          : importCount === 0
            ? 'Nothing new to import'
            : `Import ${importCount.toLocaleString('en-US')} recipe${importCount === 1 ? '' : 's'}`}
      </button>
      {!allResolved && (
        <div className="hint" style={{ marginTop: 6, textAlign: 'center' }}>
          Choose what to do with the unrecognized categories first.
        </div>
      )}
      <button
        onClick={onClose}
        style={{
          width: '100%',
          minHeight: 46,
          marginTop: 8,
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-cta)',
          color: 'var(--ink-mid)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Cancel
      </button>
    </Sheet>
  );
}
