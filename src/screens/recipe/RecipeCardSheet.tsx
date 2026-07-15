// Universal recipe card sheet (plan Task 22; canvas 2e, screenshot 07).
// EVERY recipe tap in the app lands here (spec rule 12: edit-in-place, two
// taps to fix anything): editable title, book/category/page pill selectors,
// tag editor, attachments, cooking history, status toggle. Every edit commits
// to the store immediately with a toast Undo — there is no save button.
//
// UNRULED on purpose — Checkpoint 1 amendment 3 (owner, 2026-07-14): the
// index-card ruling made cards hard to read, removed app-wide. Canvas 2e
// still SHOWS a ruled card; the amendment overrides the canvas. Do not add
// .index-ruling / background-image ruling here.
//
// NEUTRAL spine + page tab: no generate session exists on this screen, and
// book colors are session-scoped by design (handoff signature rule), so the
// stripe, tab and swatches all use --neutral-spine.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { store, useStore } from '../../data/store';
import { newId } from '../../data/types';
import type { MadeEntry, Pill as PillT } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { PageTab } from '../../components/PageTab';
import { PillEditor } from '../../components/PillEditor';
import { Sheet } from '../../components/Sheet';
import { SpineStripe } from '../../components/SpineStripe';
import { useToast } from '../../components/Toast';
import { compressImage } from '../../logic/images';
import { fromISO } from '../../logic/dates';
import { displayRating } from '../../logic/rating';
import { MarkAsMadeDialog } from './MarkAsMadeDialog';
import { AddToPlanDialog } from './AddToPlanDialog';

const sectionLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
  fontWeight: 700,
  margin: '14px 0 6px',
};

const selectorPill: CSSProperties = {
  border: '1.5px solid var(--line)',
  background: 'var(--card)',
  borderRadius: 'var(--r-pill)',
  padding: '6px 12px',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--ink-mid)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

// 'May 24, 2026' (canvas 2e history rows).
const historyDate = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function RecipeCardSheet({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const showToast = useToast();
  useStore((s) => s.version);
  const recipe = store.recipes.find((r) => r.id === recipeId);
  const book = store.books.find((b) => b.id === recipe?.bookId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingPage, setEditingPage] = useState(false);
  const [chooser, setChooser] = useState<'book' | 'category' | null>(null);
  const [madeDialog, setMadeDialog] = useState<{ madeEntryId?: string } | null>(null);
  const [addToPlan, setAddToPlan] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MadeEntry | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // ── attachments: blobs live only in IDB; object URLs revoked on unmount ──
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const idsKey = recipe?.attachmentIds.join(',') ?? '';
  // Fetch a thumbnail for every attachment id, re-running when the id list
  // changes. Re-fetching an already-thumbed id just swaps in a fresh object
  // URL — every URL ever created lands in `urls` and is revoked on unmount.
  // The per-run `live` flag discards results from a superseded run, including
  // StrictMode's dev double-mount (pattern from MarkAsMadeDialog; a persistent
  // "mounted" ref would stay false after StrictMode's first unmount).
  useEffect(() => {
    let live = true;
    for (const id of idsKey === '' ? [] : idsKey.split(',')) {
      void store.getAttachment(id).then((rec) => {
        if (!rec || !live) return;
        const url = URL.createObjectURL(rec.blob);
        urls.current.push(url);
        setThumbs((t) => ({ ...t, [id]: url }));
      });
    }
    return () => {
      live = false;
    };
  }, [idsKey]);
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  // ── custom recipe text: commit on blur; ref-flush on unmount covers
  // closing the sheet without blurring (backdrop tap / Android back) ──
  const textRef = useRef<{ value: string; dirty: boolean }>({ value: recipe?.text ?? '', dirty: false });
  useEffect(
    () => () => {
      if (textRef.current.dirty && store.recipes.some((r) => r.id === recipeId))
        void store.updateRecipe(recipeId, { text: textRef.current.value });
    },
    [recipeId],
  );

  // Recipe deleted while the sheet is open (e.g. undo of an import) — nothing
  // to show; the empty sheet still closes normally.
  if (!recipe) return null;

  // ── edits (each commits instantly + toast Undo — spec rule 12) ──────────

  const commitTitle = (raw: string) => {
    setEditingTitle(false);
    const name = raw.trim();
    if (!name || name === recipe.name) return;
    const prior = recipe.name;
    void store.updateRecipe(recipe.id, { name });
    showToast('Title updated', () => void store.updateRecipe(recipe.id, { name: prior }));
  };

  const commitPage = (raw: string) => {
    setEditingPage(false);
    const page = raw.trim();
    if (!page || page === recipe.page) return;
    const prior = recipe.page;
    void store.updateRecipe(recipe.id, { page });
    showToast('Page updated', () => void store.updateRecipe(recipe.id, { page: prior }));
  };

  const moveToBook = (bookId: string) => {
    setChooser(null);
    if (bookId === recipe.bookId) return;
    const prior = recipe.bookId;
    void store.updateRecipe(recipe.id, { bookId });
    showToast(`Moved to ${store.books.find((b) => b.id === bookId)?.name ?? 'book'}`, () =>
      void store.updateRecipe(recipe.id, { bookId: prior }),
    );
  };

  const setCategory = (category: string) => {
    setChooser(null);
    if (category === recipe.category) return;
    const prior = recipe.category;
    void store.updateRecipe(recipe.id, { category });
    showToast(`Category: ${category}`, () => void store.updateRecipe(recipe.id, { category: prior }));
  };

  // Tags are DATA here, not filters: recipe.tags is a plain string list, so
  // the pill neg-state ("not x") has no meaning on this screen. Pills always
  // render as includes, and a body-tap (PillEditor's include↔not cycle)
  // becomes a no-op: it changes only the neg flag, the tag SET is unchanged,
  // and we skip the write. Only add/remove reach the store.
  const onTagsChange = (next: PillT[]) => {
    const tags = next.map((p) => p.text);
    if (tags.join('\u0000') === recipe.tags.join('\u0000')) return; // body-tap cycle — ignore
    const prior = recipe.tags;
    void store.updateRecipe(recipe.id, { tags });
    showToast(tags.length > prior.length ? 'Tag added' : 'Tag removed', () =>
      void store.updateRecipe(recipe.id, { tags: prior }),
    );
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const blob = await compressImage(file);
      const id = newId();
      await store.addAttachment({ id, blob, name: file.name, type: 'image/jpeg' });
      // Re-read the recipe each iteration — multi-select adds several ids.
      const cur = store.recipes.find((r) => r.id === recipeId);
      if (!cur) return;
      await store.updateRecipe(recipeId, { attachmentIds: [...cur.attachmentIds, id] });
      // Thumbnail arrives via the idsKey effect above — one code path.
      showToast('Photo added', () => {
        const now = store.recipes.find((r) => r.id === recipeId);
        if (now) void store.updateRecipe(recipeId, { attachmentIds: now.attachmentIds.filter((x) => x !== id) });
        void store.deleteAttachment(id);
      });
    }
  };

  // OWNING editor: unlike MarkAsMadeDialog (which only drops the reference on
  // save so its toast-undo can restore photos — see the note there), removing
  // an attachment here deletes the blob itself. The recipe card is where a
  // recipe's attachments permanently live; there is no pending-save session
  // that could restore the bytes, so we hard-delete rather than leak an
  // orphaned blob. Consequence: this toast has NO Undo — the bytes are gone.
  const removeAttachment = (id: string) => {
    void store.updateRecipe(recipe.id, { attachmentIds: recipe.attachmentIds.filter((x) => x !== id) });
    void store.deleteAttachment(id);
    showToast('Photo removed');
  };

  const deleteEntry = (entry: MadeEntry) => {
    setConfirmDelete(null);
    void store.deleteMadeEntry(entry.id);
    // Undo re-adds the SAME entry object — date, rating, notes and photoIds
    // all restore (photo blobs were never deleted, only the entry row).
    showToast('Entry deleted', () => void store.addMadeEntry(entry));
  };

  const excluded = recipe.status === 'excluded';
  const toggleStatus = () => {
    const next = excluded ? ('active' as const) : ('excluded' as const);
    void store.updateRecipe(recipe.id, { status: next });
    showToast(excluded ? 'Recipe restored' : `“${recipe.name}” marked never make`, () =>
      void store.updateRecipe(recipe.id, { status: recipe.status }),
    );
  };

  const commitText = (value: string) => {
    textRef.current.dirty = false;
    if (value === (recipe.text ?? '')) return;
    const prior = recipe.text;
    void store.updateRecipe(recipe.id, { text: value });
    showToast('Recipe text saved', () => void store.updateRecipe(recipe.id, { text: prior }));
  };

  const entries = store.madeEntries
    .filter((m) => m.recipeId === recipeId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const swatch = (
    <i
      aria-hidden
      style={{
        width: 11,
        height: 16,
        borderRadius: 2,
        background: 'var(--neutral-spine)',
        boxShadow: 'inset -2px 0 0 rgba(0,0,0,.18)',
        flex: 'none',
      }}
    />
  );

  return (
    <>
    <Sheet open onClose={onClose} label={recipe.name}>
      {/* One big index card — see header note: unruled, neutral spine. */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card)',
          padding: '14px 14px 14px 20px',
          position: 'relative',
        }}
      >
        <SpineStripe color="var(--neutral-spine)" />
        <PageTab color="var(--neutral-spine)" page={recipe.page} />

        {/* Title — ✎ toggles an inline input; commit on blur/Enter. */}
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={recipe.name}
            aria-label="Recipe name"
            onBlur={(e) => commitTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur(); // commit via onBlur (once)
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            style={{
              width: '100%',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '-.01em',
              border: 'none',
              borderBottom: '1.5px solid var(--accent)',
              background: 'transparent',
              padding: '0 0 2px',
            }}
          />
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '-.01em',
              paddingRight: 48, // clear the hanging page tab
            }}
          >
            {recipe.name}{' '}
            <button
              aria-label="Edit name"
              onClick={() => setEditingTitle(true)}
              style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, padding: '2px 4px' }}
            >
              ✎
            </button>
          </div>
        )}

        {/* Book / category / page pill selectors. */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            style={selectorPill}
            aria-expanded={chooser === 'book'}
            onClick={() => setChooser(chooser === 'book' ? null : 'book')}
          >
            {swatch}
            {book?.name ?? 'Unknown book'} ▾
          </button>
          <button
            style={selectorPill}
            aria-expanded={chooser === 'category'}
            onClick={() => setChooser(chooser === 'category' ? null : 'category')}
          >
            {recipe.category} ▾
          </button>
          {editingPage ? (
            <span style={{ ...selectorPill, padding: '0 12px' }}>
              p.{' '}
              <input
                autoFocus
                defaultValue={recipe.page}
                aria-label="Page"
                onBlur={(e) => commitPage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingPage(false);
                }}
                style={{ width: 48, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 600 }}
              />
            </span>
          ) : (
            <button style={selectorPill} aria-label="Edit page" onClick={() => setEditingPage(true)}>
              p. {recipe.page} ✎
            </button>
          )}
        </div>

        {chooser === 'book' && (
          <ChooserPanel>
            {store.books.map((b) => (
              <ChooserChip
                key={b.id}
                label={b.name}
                current={b.id === recipe.bookId}
                swatch
                onClick={() => moveToBook(b.id)}
              />
            ))}
          </ChooserPanel>
        )}
        {chooser === 'category' && (
          <ChooserPanel>
            {[
              ...store.categories.map((c) => c.name),
              ...(store.categories.some((c) => c.name === recipe.category) ? [] : [recipe.category]),
            ].map((name) => (
              <ChooserChip key={name} label={name} current={name === recipe.category} onClick={() => setCategory(name)} />
            ))}
          </ChooserPanel>
        )}

        <div style={sectionLabel}>Tags</div>
        <PillEditor
          pills={recipe.tags.map((t): PillT => ({ text: t, neg: false }))}
          onChange={onTagsChange}
          placeholder="+ add tag…"
        />

        <div style={sectionLabel}>Attachments</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {recipe.attachmentIds.map((id) => (
            <span key={id} style={{ position: 'relative', display: 'inline-block' }}>
              {thumbs[id] ? (
                <button aria-label="View photo" onClick={() => setViewPhoto(thumbs[id])} style={{ display: 'block' }}>
                  <img
                    src={thumbs[id]}
                    alt="Recipe attachment"
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 'var(--r-inner)',
                      objectFit: 'cover',
                      border: '1px solid var(--line)',
                    }}
                  />
                </button>
              ) : (
                <span
                  style={{ display: 'block', width: 74, height: 74, borderRadius: 'var(--r-inner)', background: 'var(--panel)' }}
                />
              )}
              <button
                aria-label="Remove photo"
                onClick={() => removeAttachment(id)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--pill-x-bg)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  lineHeight: '20px',
                }}
              >
                ×
              </button>
            </span>
          ))}
          <button
            aria-label="Add photo"
            onClick={() => fileInput.current?.click()}
            style={{
              width: 74,
              height: 74,
              borderRadius: 'var(--r-inner)',
              border: '1.5px dashed var(--dash)',
              color: 'var(--ink-soft)',
              fontSize: 22,
            }}
          >
            +
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = ''; // allow re-adding the same file
            }}
          />
        </div>

        {recipe.isCustom && (
          <>
            <div style={sectionLabel}>Recipe</div>
            <textarea
              defaultValue={recipe.text ?? ''}
              aria-label="Recipe text"
              rows={6}
              onChange={(e) => {
                textRef.current = { value: e.target.value, dirty: true };
              }}
              onBlur={(e) => commitText(e.target.value)}
              style={{
                width: '100%',
                border: '1.5px solid var(--line)',
                background: 'var(--paper)',
                borderRadius: 'var(--r-inner)',
                padding: '10px 12px',
                fontSize: 13.5,
                resize: 'vertical',
              }}
            />
          </>
        )}

        {recipe.link && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.open(recipe.link!.url, '_blank', 'noopener')}
              style={{
                border: '1.5px solid var(--accent)',
                color: 'var(--accent)',
                background: 'none',
                borderRadius: 'var(--r-pill)',
                padding: '8px 13px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Open page ↗
            </button>
            {recipe.link.pageStatus === 'unverified' && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ink-mid)',
                  background: 'var(--warn-bg)',
                  border: '1px solid var(--warn-border)',
                  borderRadius: 'var(--r-tag)',
                  padding: '3px 7px',
                }}
              >
                page unverified — may need searching
              </span>
            )}
          </div>
        )}

        <div style={sectionLabel}>History</div>
        {entries.length === 0 && <div className="meta">Not made yet.</div>}
        {entries.map((e, i) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 0',
              borderBottom: i === entries.length - 1 ? 'none' : '1px dashed var(--line)',
            }}
          >
            <span style={{ flex: 1, fontSize: 13.5, minWidth: 0 }}>
              {historyDate(e.date)}
              {e.rating !== undefined && (
                <>
                  {' · '}
                  <b style={{ color: 'var(--gold)' }}>★ {displayRating(e.rating, store.settings.ratingScale)}</b>
                </>
              )}
              {e.notes && <span style={{ color: 'var(--ink-mid)' }}> · “{e.notes}”</span>}
            </span>
            <button
              aria-label="Edit entry"
              onClick={() => setMadeDialog({ madeEntryId: e.id })}
              style={{ fontSize: 12, color: 'var(--ink-soft)', padding: 6 }}
            >
              ✎
            </button>
            <button
              aria-label="Delete entry"
              onClick={() => setConfirmDelete(e)}
              style={{ fontSize: 12, color: 'var(--danger)', padding: 6 }}
            >
              🗑
            </button>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--ink-mid)', fontWeight: 600 }}>
            Status: <b style={{ color: excluded ? 'var(--danger)' : 'var(--accent)' }}>{excluded ? 'Never make' : 'Active'}</b>
          </span>
          <button
            onClick={toggleStatus}
            style={{
              border: '1.5px solid var(--line)',
              background: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 600,
              color: excluded ? 'var(--accent)' : 'var(--danger)',
            }}
          >
            {excluded ? 'Restore' : 'Never make'}
          </button>
        </div>
      </div>

      {/* Footer + caption (outside the card, canvas 2e). */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setMadeDialog({})}
          style={{
            flex: 1.4,
            minHeight: 50,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            borderRadius: 'var(--r-cta)',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          ✓ Mark as made
        </button>
        <button
          onClick={() => setAddToPlan(true)}
          style={{
            flex: 1,
            minHeight: 50,
            border: '1.5px solid var(--accent)',
            background: 'none',
            color: 'var(--accent)',
            borderRadius: 'var(--r-cta)',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          + Add to plan
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 10 }}>
        Edits save instantly · <b>Undo</b>
      </div>
    </Sheet>

      {/* Stacked overlays — SIBLINGS of the Sheet, never children: the sheet
          panel's transform would otherwise become their containing block and
          pin/clip these fixed-position dialogs to the sheet (see Dialog.tsx
          header). overlay.ts's stack gives each one its own back press. */}
      {madeDialog && (
        <MarkAsMadeDialog recipeId={recipeId} madeEntryId={madeDialog.madeEntryId} onClose={() => setMadeDialog(null)} />
      )}
      {addToPlan && <AddToPlanDialog recipeId={recipeId} onClose={() => setAddToPlan(false)} />}
      {confirmDelete && (
        <Dialog open onClose={() => setConfirmDelete(null)} label="Delete history entry">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
            Delete this entry?
          </div>
          <p className="meta" style={{ marginBottom: 14 }}>
            Made {historyDate(confirmDelete.date)}
            {confirmDelete.rating !== undefined
              ? ` · ★ ${displayRating(confirmDelete.rating, store.settings.ratingScale)}`
              : ''} — this removes it from your
            cooking history.
          </p>
          <button
            onClick={() => deleteEntry(confirmDelete)}
            style={{
              width: '100%',
              minHeight: 46,
              background: 'var(--danger)',
              // on-accent, not #fff: dark --danger brightens to #C97B63, which
              // needs the same dark-ink flip as accent buttons (dark sweep, T27).
              color: 'var(--on-accent)',
              borderRadius: 'var(--r-cta)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Delete entry
          </button>
          <button
            onClick={() => setConfirmDelete(null)}
            style={{ width: '100%', minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 4 }}
          >
            Cancel
          </button>
        </Dialog>
      )}
      {viewPhoto && (
        <button
          aria-label="Close photo"
          onClick={() => setViewPhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            background: 'rgba(0,0,0,.85)',
            zIndex: 18, // above the sheet (15), below the toast (20)
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <img
            src={viewPhoto}
            alt="Attachment full size"
            style={{ maxWidth: '100%', maxHeight: '90dvh', borderRadius: 'var(--r-inner)' }}
          />
        </button>
      )}
    </>
  );
}

function ChooserPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1.5px dashed var(--dash)',
        borderRadius: 'var(--r-card)',
        padding: 9,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

function ChooserChip({
  label,
  current,
  swatch = false,
  onClick,
}: {
  label: string;
  current: boolean;
  swatch?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={current}
      style={{
        border: `1.5px solid ${current ? 'var(--accent)' : 'var(--line)'}`,
        background: current ? 'var(--accent-tint)' : 'var(--card)',
        color: current ? 'var(--accent)' : 'var(--ink-mid)',
        fontWeight: current ? 700 : 600,
        borderRadius: 'var(--r-pill)',
        padding: '7px 12px',
        fontSize: 12.5,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {swatch && (
        <i
          aria-hidden
          style={{
            width: 11,
            height: 16,
            borderRadius: 2,
            background: 'var(--neutral-spine)',
            boxShadow: 'inset -2px 0 0 rgba(0,0,0,.18)',
            flex: 'none',
          }}
        />
      )}
      {label}
      {current ? ' ✓' : ''}
    </button>
  );
}
