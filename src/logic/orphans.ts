// Orphaned cooking history (Task 10, spec rule 8).
//
// "Delete book, keep cooking history" must never lose what the user actually
// cooked: each MadeEntry loses its recipeId (null = orphaned) but gains a
// human-readable snapshot {bookTitle, recipeName, page} so the journal still
// reads sensibly. When a similar book is later re-added, findReassociation
// proposes reconnections — fuzzy on the BOOK title only; recipe pairing is
// exact after normalization, with page as a tiebreak. Anything unmatched
// stays orphaned rather than guessed.
import type { Cookbook, MadeEntry, Recipe } from '../data/types';

/**
 * Pure transform: the orphaned versions of every MadeEntry belonging to one of
 * `recipes` (the book's recipes). Entries of other books — and entries already
 * orphaned — are not returned. Inputs are never mutated.
 */
export function orphanBook(book: Cookbook, recipes: Recipe[], madeEntries: MadeEntry[]): MadeEntry[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const orphaned: MadeEntry[] = [];
  for (const m of madeEntries) {
    if (m.recipeId === null) continue;
    const recipe = byId.get(m.recipeId);
    if (!recipe) continue;
    orphaned.push({
      ...m,
      recipeId: null,
      orphan: { bookTitle: book.name, recipeName: recipe.name, page: recipe.page },
    });
  }
  return orphaned;
}

// Words that carry no identity in a cookbook title ("The Joy of Cooking" and
// "Joy of Cooking" are the same book).
const TITLE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'book', 'cookbook']);

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ') // strip punctuation, keep letters/digits
      .split(/\s+/)
      .filter((t) => t !== '' && !TITLE_STOPWORDS.has(t)),
  );
}

/** Two titles "match" at >= this Jaccard similarity over token sets. */
export const TITLE_MATCH_THRESHOLD = 0.5;

/**
 * Token-set Jaccard similarity in [0, 1] after lowercasing, punctuation
 * stripping, and stopword removal. 'Joy of Cooking' vs
 * 'The Joy of Cooking (1975)' → |{joy,cooking}| / |{joy,cooking,1975}| = 2/3.
 */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0; // no signal → never "similar"
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Given the pool of orphaned entries and a just-added book with its recipes,
 * propose reconnections. `titleMatch` says whether ANY orphan's snapshot book
 * title fuzzy-matches the new book (the UI only prompts when true); `pairs`
 * maps entry → recipe by normalized recipe name, tie-broken by page. Orphans
 * without a confident pair are simply absent from `pairs`.
 */
export function findReassociation(
  orphanEntries: MadeEntry[],
  newBook: Cookbook,
  newRecipes: Recipe[],
): { titleMatch: boolean; pairs: { entryId: string; recipeId: string }[] } {
  const candidates = orphanEntries.filter(
    (e) =>
      e.recipeId === null &&
      e.orphan !== undefined &&
      titleSimilarity(e.orphan.bookTitle, newBook.name) >= TITLE_MATCH_THRESHOLD,
  );
  if (candidates.length === 0) return { titleMatch: false, pairs: [] };

  const byName = new Map<string, Recipe[]>();
  for (const r of newRecipes) {
    if (r.bookId !== newBook.id) continue;
    const key = normName(r.name);
    const bucket = byName.get(key);
    if (bucket) bucket.push(r);
    else byName.set(key, [r]);
  }

  const pairs: { entryId: string; recipeId: string }[] = [];
  for (const e of candidates) {
    const snapshot = e.orphan!;
    const matches = byName.get(normName(snapshot.recipeName));
    if (!matches || matches.length === 0) continue; // stays orphaned — never guessed
    const samePage = matches.find((r) => r.page === snapshot.page);
    pairs.push({ entryId: e.id, recipeId: (samePage ?? matches[0]).id });
  }
  return { titleMatch: true, pairs };
}
