// Mark-as-made dialog (plan Task 18; canvas 3a, screenshot 09). Centered
// Dialog: recipe line (neutral spine chip — no generate session exists here,
// so no session color), single date button toggling a native picker (no
// yesterday/quick buttons — canvas 3a), rating grid with one cell per point
// of the display scale (settings.ratingScale; tap the selected cell again to
// clear), photo attachments through compressImage, notes.
// Save writes a MadeEntry (or patches one in edit mode) and, when opened from
// a plan row, flips that plan item to 'made' — all undoable from the toast.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { store, useStore } from '../../data/store';
import { newId, todayISO } from '../../data/types';
import type { MadeEntry } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { SpineChip } from '../../components/SpineChip';
import { useToast } from '../../components/Toast';
import { spineColor } from '../../components/spine';
import { compressImage } from '../../logic/images';
import { monthDayShort } from '../../logic/dates';
import { displayRating, storeRating } from '../../logic/rating';

export function MarkAsMadeDialog({
  recipeId,
  planId,
  madeEntryId,
  onClose,
}: {
  recipeId: string;
  /** When set, saving also flips this plan's open item for `recipeId` to 'made'. */
  planId?: string;
  /** Edit mode: patch this entry instead of creating a new one. */
  madeEntryId?: string;
  onClose: () => void;
}) {
  const showToast = useToast();
  useStore((s) => s.version);
  const recipe = store.recipes.find((r) => r.id === recipeId);
  const book = store.books.find((b) => b.id === recipe?.bookId);
  const scale = store.settings.ratingScale;

  // Edit mode: snapshot the entry ONCE at mount — it is both the form's
  // initial values and the toast-undo target.
  const [prior] = useState<MadeEntry | undefined>(() =>
    madeEntryId ? store.madeEntries.find((m) => m.id === madeEntryId) : undefined,
  );

  const [date, setDate] = useState(prior?.date ?? todayISO());
  const [rating, setRating] = useState<number | undefined>(prior?.rating);
  const [notes, setNotes] = useState(prior?.notes ?? '');
  const [photoIds, setPhotoIds] = useState<string[]>(prior?.photoIds ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Attachments created BY THIS DIALOG — deleted again on cancel/undo so a
  // discarded session leaves no orphaned blobs behind.
  const addedIds = useRef<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  // Every object URL ever created here, revoked in one place on unmount.
  const urls = useRef<string[]>([]);
  const addThumb = (id: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    setThumbs((t) => ({ ...t, [id]: url }));
  };
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  // Edit mode: fetch the entry's existing photos (blobs live only in IDB).
  useEffect(() => {
    let live = true;
    for (const id of prior?.photoIds ?? []) {
      void store.getAttachment(id).then((rec) => {
        if (rec && live) addThumb(id, rec.blob);
      });
    }
    return () => {
      live = false;
    };
    // prior never changes after mount (useState initializer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!recipe) return null;

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const blob = await compressImage(file);
      const id = newId();
      await store.addAttachment({ id, blob, name: file.name, type: 'image/jpeg' });
      addedIds.current.add(id);
      addThumb(id, blob);
      setPhotoIds((p) => [...p, id]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotoIds((p) => p.filter((x) => x !== id));
    // Session-added photos are hard-deleted (nothing references them yet).
    // Photos that predate this dialog only lose the reference on save —
    // deleting the blob here would make toast-undo unable to restore them.
    if (addedIds.current.delete(id)) void store.deleteAttachment(id);
  };

  const cancel = () => {
    for (const id of addedIds.current) void store.deleteAttachment(id);
    onClose();
  };

  const save = async () => {
    const trimmedNotes = notes.trim() || undefined;
    const added = [...addedIds.current];
    if (prior) {
      const revert = { date: prior.date, rating: prior.rating, notes: prior.notes, photoIds: prior.photoIds };
      await store.updateMadeEntry(prior.id, { date, rating, notes: trimmedNotes, photoIds });
      showToast('Entry updated', () => {
        void store.updateMadeEntry(prior.id, revert);
        for (const id of added) if (!prior.photoIds.includes(id)) void store.deleteAttachment(id);
      });
    } else {
      const entry: MadeEntry = { id: newId(), recipeId, date, rating, notes: trimmedNotes, photoIds };
      const priorItems = planId ? store.plans.find((p) => p.id === planId)?.items : undefined;
      await store.addMadeEntry(entry);
      if (planId && priorItems) {
        // Flip the FIRST open item for this recipe (spec: plan items track
        // their MadeEntry so the row can show "Made · 8/10" and edit it).
        const idx = priorItems.findIndex((it) => it.recipeId === recipeId && it.state === 'open');
        if (idx >= 0) {
          const items = priorItems.map((it, i) =>
            i === idx ? { ...it, state: 'made' as const, madeEntryId: entry.id } : it,
          );
          await store.updatePlan(planId, { items });
        }
      }
      showToast('Marked as made', () => {
        void store.deleteMadeEntry(entry.id);
        for (const id of added) void store.deleteAttachment(id);
        if (planId && priorItems) void store.updatePlan(planId, { items: priorItems });
      });
    }
    onClose();
  };

  // "Open page ↗" renders in the book's color (canvas 3a). No generate session
  // exists here, so the color derives from shelf position among active books —
  // stable for the dialog's lifetime. Dormant branch until linked packs land
  // (Task 25): no recipe carries `link` yet.
  const activeBooks = store.books.filter((b) => !b.archived);
  const bookColor = spineColor(activeBooks.findIndex((b) => b.id === recipe.bookId));

  return (
    <Dialog open onClose={cancel} label="Mark as made">
      <div className="screen-title" style={{ fontSize: 21 }}>Mark as made</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
        <SpineChip width={9} height={16} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-mid)' }}>
          {recipe.name}
          <br />
          <b style={{ color: 'var(--ink)' }}>{book?.name ?? 'Unknown book'}</b> · p. {recipe.page}
        </span>
        {recipe.link && (
          <button
            onClick={() => window.open(recipe.link!.url, '_blank', 'noopener')}
            style={{
              flex: 'none',
              border: `1.5px solid ${bookColor}`,
              color: bookColor,
              background: 'none',
              borderRadius: 'var(--r-pill)',
              padding: '8px 13px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Open page ↗
          </button>
        )}
      </div>

      <FieldLabel>Date made</FieldLabel>
      <button
        onClick={() => setShowPicker((v) => !v)}
        style={{
          width: '100%',
          minHeight: 46,
          border: '1.5px solid var(--accent)',
          background: 'var(--accent-tint)',
          borderRadius: 'var(--r-card)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--accent)',
        }}
      >
        {date === todayISO() ? `Today · ${monthDayShort(date)}` : monthDayShort(date)} ▾
      </button>
      {showPicker ? (
        <input
          type="date"
          aria-label="Date made"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          style={{
            width: '100%',
            border: '1.5px solid var(--line)',
            background: 'var(--card)',
            borderRadius: 'var(--r-card)',
            padding: '10px 12px',
            fontSize: 14,
            margin: '8px 0 14px',
          }}
        />
      ) : (
        <div className="hint" style={{ margin: '6px 0 12px' }}>Tap the date to open a calendar</div>
      )}

      <FieldLabel>Rating</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scale}, 1fr)`, gap: 5, marginBottom: 14 }}>
        {Array.from({ length: scale }, (_, i) => i + 1).map((n) => {
          const on = rating !== undefined && displayRating(rating, scale) === n;
          return (
            <button
              key={n}
              aria-pressed={on}
              // `rating` state holds the CANONICAL stored 1–10 value; only a
              // grid tap converts through storeRating. This is what keeps an
              // odd stored rating (e.g. 7 shown as "4" on the 5-scale) intact
              // on save when the user edits other fields but never taps the
              // grid — the owner's rule that switching scales / editing an
              // entry must never silently rewrite saved ratings.
              onClick={() => setRating(on ? undefined : storeRating(n, scale))}
              style={{
                minHeight: 44,
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

      <FieldLabel>Photos</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {photoIds.map((id) => (
          <span key={id} style={{ position: 'relative', display: 'inline-block' }}>
            {thumbs[id] ? (
              <img
                src={thumbs[id]}
                alt="Dish photo"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 'var(--r-inner)',
                  objectFit: 'cover',
                  border: '1px solid var(--line)',
                }}
              />
            ) : (
              <span
                style={{ display: 'block', width: 64, height: 64, borderRadius: 'var(--r-inner)', background: 'var(--panel)' }}
              />
            )}
            <button
              aria-label="Remove photo"
              onClick={() => removePhoto(id)}
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
            width: 64,
            height: 64,
            borderRadius: 'var(--r-inner)',
            border: '1.5px dashed var(--dash)',
            color: 'var(--ink-soft)',
            fontSize: 20,
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

      <FieldLabel>Notes</FieldLabel>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          border: '1.5px solid var(--line)',
          background: 'var(--card)',
          borderRadius: 'var(--r-card)',
          padding: '11px 12px',
          fontSize: 14,
          resize: 'vertical',
          marginBottom: 16,
        }}
      />

      <button
        onClick={() => void save()}
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
        Save · Made {monthDayShort(date)} ✓
      </button>
      <button
        onClick={cancel}
        style={{ width: '100%', minHeight: 46, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 4 }}
      >
        Cancel
      </button>
    </Dialog>
  );
}

// Canvas 3a section label: 11px 700 uppercase .1em soft ink (base .field-label
// carries everything but the color).
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="field-label" style={{ color: 'var(--ink-soft)', marginBottom: 6 }}>
      {children}
    </div>
  );
}
