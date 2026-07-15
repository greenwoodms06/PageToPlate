// Re-association hook (plan Task 23 Step 3, spec rule 8): after ANY book add
// — manual add (BooksTab), CSV import commit (CsvImport), pack install
// (LibrarySection) — the call site runs checkReassociation() and, when it
// returns a prompt, renders <ReassociateDialog>. Matching itself lives in
// src/logic/orphans.ts (fuzzy on the book TITLE, exact on recipe names);
// this file is only the store glue + the one dialog.
import { store } from '../../data/store';
import { findReassociation } from '../../logic/orphans';
import type { Cookbook, Recipe } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';

export interface ReassocPrompt {
  /** The orphans' snapshot book title — what the user remembers deleting. */
  title: string;
  pairs: { entryId: string; recipeId: string }[];
}

/**
 * Null when there is nothing to ask: no orphaned entries whose snapshot book
 * title fuzzy-matches the new book, or a title match but zero confident
 * recipe pairs (e.g. a freshly added EMPTY book) — prompting "Found 0
 * entries" would be noise.
 */
export function checkReassociation(newBook: Cookbook, newRecipes: Recipe[]): ReassocPrompt | null {
  const orphans = store.madeEntries.filter((e) => e.recipeId === null);
  const { titleMatch, pairs } = findReassociation(orphans, newBook, newRecipes);
  if (!titleMatch || pairs.length === 0) return null;
  const first = orphans.find((e) => e.id === pairs[0].entryId);
  return { title: first?.orphan?.bookTitle ?? newBook.name, pairs };
}

async function applyReassociation(prompt: ReassocPrompt): Promise<void> {
  for (const { entryId, recipeId } of prompt.pairs) {
    // Reconnect: entry points at the live recipe again; the orphan snapshot
    // is cleared so the journal renders it as a normal entry.
    await store.updateMadeEntry(entryId, { recipeId, orphan: undefined });
  }
}

/** onClose fires on BOTH outcomes (reconnect and keep-separate) — call sites
 *  use it to continue their flow (e.g. navigate to the new book). */
export function ReassociateDialog({ prompt, onClose }: { prompt: ReassocPrompt; onClose: () => void }) {
  const showToast = useToast();
  const n = prompt.pairs.length;
  return (
    <Dialog open onClose={onClose} label="Reconnect cooking history">
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-.01em' }}>
        Found {n} past {n === 1 ? 'entry' : 'entries'} from “{prompt.title}” — reconnect {n === 1 ? 'it' : 'them'}?
      </div>
      <p className="meta" style={{ margin: '8px 0 16px' }}>
        Dates, ratings and notes from your cooking journal will attach to the matching recipes in this book.
        Anything without a confident match stays as it is.
      </p>
      <button
        onClick={() => {
          void applyReassociation(prompt).then(() => {
            showToast(`${n} ${n === 1 ? 'entry' : 'entries'} reconnected`);
          });
          onClose();
        }}
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
        Reconnect {n === 1 ? 'entry' : 'entries'}
      </button>
      <button
        onClick={onClose}
        style={{
          width: '100%',
          minHeight: 42,
          marginTop: 8,
          color: 'var(--ink-mid)',
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        Keep separate
      </button>
    </Dialog>
  );
}
