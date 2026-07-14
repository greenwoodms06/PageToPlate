import type { Recipe, Cookbook, CatConfig } from '../data/types';
import { recipeMatches } from './pills';

export interface Candidate extends Recipe { madeCount: number; lastMade?: string }
export interface GenGroup { category: string; want: number; cards: { recipe: Candidate; status: 'kept' | 'rejected' | 'never' }[]; note: string | null }
type Rng = () => number;

export function eligible(recipes: Candidate[], books: Cookbook[], bookIds: string[], category: string, pills: CatConfig['pills']): Candidate[] {
  const archived = new Set(books.filter(b => b.archived).map(b => b.id));
  return recipes.filter(r =>
    r.category === category && bookIds.includes(r.bookId) && !archived.has(r.bookId) &&
    r.status === 'active' && recipeMatches(r, pills));
}

export function pick(pool: Candidate[], count: number, preferUnmade: boolean, rng: Rng = Math.random): Candidate[] {
  const shuffle = <T,>(a: T[]) => a.map(x => [rng(), x] as const).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const ordered = preferUnmade
    ? [...shuffle(pool.filter(r => r.madeCount === 0)),
       // spec rule 5: cycle restarts preferring least-recently-made; shuffle-then-stable-sort randomizes ties
       ...shuffle(pool.filter(r => r.madeCount > 0)).sort((a, b) => (a.lastMade ?? '').localeCompare(b.lastMade ?? ''))]
    : shuffle(pool);
  return ordered.slice(0, count);
}

export function generate(recipes: Candidate[], books: Cookbook[], bookIds: string[],
    config: Record<string, CatConfig>, preferUnmade: boolean, rng: Rng = Math.random): GenGroup[] {
  return Object.entries(config).filter(([, c]) => c.count > 0).map(([category, c]) => {
    const picked = pick(eligible(recipes, books, bookIds, category, c.pills), c.count, preferUnmade, rng);
    return { category, want: c.count, cards: picked.map(recipe => ({ recipe, status: 'kept' as const })),
      note: picked.length < c.count ? `Only ${picked.length} of ${c.count} requested match your filters — showing what's available.` : null };
  });
}

export function regenerate(groups: GenGroup[], recipes: Candidate[], books: Cookbook[], bookIds: string[],
    config: Record<string, CatConfig>, sessionRejected: Set<string>, preferUnmade: boolean, rng: Rng = Math.random): GenGroup[] {
  return groups.map(g => {
    const kept = g.cards.filter(c => c.status !== 'rejected');
    const need = g.cards.length - kept.length;
    if (!need) return g;
    const shown = new Set(kept.map(c => c.recipe.id));
    const pool = eligible(recipes, books, bookIds, g.category, config[g.category]?.pills ?? [])
      .filter(r => !shown.has(r.id) && !sessionRejected.has(r.id));
    const repl = pick(pool, need, preferUnmade, rng);
    return { ...g, cards: [...kept, ...repl.map(recipe => ({ recipe, status: 'kept' as const }))],
      note: repl.length < need ? `No more matches to replace ${need - repl.length} rejected — pool exhausted.` : g.note };
  });
}

export const availability = (recipes: Candidate[], books: Cookbook[], bookIds: string[], category: string, pills: CatConfig['pills']) =>
  eligible(recipes, books, bookIds, category, pills).length;
