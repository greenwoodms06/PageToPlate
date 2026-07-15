import { mapRawCategory, UNCATEGORIZED } from '../data/categories';
import type { Recipe } from '../data/types';
import type { parseRecipeCsv } from './csv';

export interface ImportRow {
  name: string; page: string; rawCategory?: string;
  category: string | null;                 // null ⇒ needs user mapping
  tags: string[]; action: 'add' | 'skip' | 'update'; existingId?: string;
}
export interface ImportPlan { rows: ImportRow[]; unrecognized: Map<string, number>; adds: number; skips: number; updates: number }

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function planImport(parsed: ReturnType<typeof parseRecipeCsv>['rows'], existing: Recipe[],
    categoryNames: string[], fallbackCategory?: string): ImportPlan {
  // Dedupe matches by normalized name with PAGE AS TIEBREAKER (spec dedupe
  // rule). A name-only map is not enough: the ATK index alone has 15
  // same-name/different-page pairs, and re-importing it cross-updated the
  // twins' pages (each row "matched" whichever twin the map kept last).
  // NUL separator: normName collapses runs of whitespace, so unlike a space
  // join ('a b'+'c' vs 'a'+'b c'), no two name/page pairs can share a key.
  const pageKey = (name: string, page: string) => `${normName(name)}\u0000${page}`;
  const byNamePage = new Map(existing.map(r => [pageKey(r.name, r.page), r]));
  const byName = new Map<string, Recipe[]>();
  for (const r of existing) {
    const k = normName(r.name);
    const twins = byName.get(k);
    if (twins) twins.push(r);
    else byName.set(k, [r]);
  }
  // FORCE: dedupe must also look WITHIN the file being imported. The ATK
  // index lists 10 recipes twice — same name AND page, repeated across TOC
  // sections (5 of the pairs under different categories) — and dedupe against
  // EXISTING recipes alone double-entered them on first import / pack install
  // (existing is empty then). Keep the FIRST row, skip repeats; checked
  // before the exact-match branch so a repeat with a different section can
  // never become an 'update'. Pending adds deliberately do NOT join
  // byNamePage/byName: 'add' requires twins.length === 0, and twins per
  // normalized name is fixed for the whole file, so the single-name-match
  // fallback can never fire for a name that produced an in-file add — feeding
  // pending adds into byName would instead make a legit same-name/
  // different-page twin (15 real pairs in the ATK index) 'update' the first
  // twin's pending add, which has no id to update.
  const seenInFile = new Set<string>();
  const unrecognized = new Map<string, number>();
  const rows = parsed.map(p => {
    let category: string | null; let addTags: string[] = [];
    if (p.category?.trim()) {
      const m = mapRawCategory(p.category, categoryNames);
      category = m.category; addTags = m.addTags;
      if (!category) unrecognized.set(p.category.trim(), (unrecognized.get(p.category.trim()) ?? 0) + 1);
    } else category = fallbackCategory ?? UNCATEGORIZED;
    const name = p.name.trim();
    // spec: never store a tag whose text already appears in the recipe name
    const tags = [...new Set([...p.tags, ...addTags])]
      .map(t => t.trim().toLowerCase()).filter(t => t && !name.toLowerCase().includes(t));
    const key = pageKey(name, p.page);
    const exact = byNamePage.get(key);
    const twins = byName.get(normName(name)) ?? [];
    let action: ImportRow['action'];
    let existingId: string | undefined;
    if (seenInFile.has(key)) {
      // In-file duplicate row (see FORCE above): keep first, skip repeats.
      // No existingId: skip touches nothing.
      action = 'skip';
    } else if (exact) {
      // Exact name+page match: same recipe — skip unless the category changed.
      action = category === null || exact.category === category ? 'skip' : 'update';
      existingId = exact.id;
    } else if (twins.length === 1) {
      // One name match, page differs: a page (or category) correction.
      action = 'update';
      existingId = twins[0].id;
    } else if (twins.length === 0) {
      action = 'add';
    } else {
      // FORCE: 2+ same-name candidates and no page match. 'add' would
      // double-enter; 'update' would have to guess a target. The spec's dedupe
      // rule is "skip or update, never double-enter" — skip is the only action
      // that neither duplicates nor guesses. No existingId: skip touches nothing.
      action = 'skip';
    }
    seenInFile.add(key);
    return { name, page: p.page, rawCategory: p.category, category, tags, action, existingId };
  });
  return { rows, unrecognized,
    adds: rows.filter(r => r.action === 'add').length,
    skips: rows.filter(r => r.action === 'skip').length,
    updates: rows.filter(r => r.action === 'update').length };
}
export function resolveUnrecognized(plan: ImportPlan, mapping: Map<string, string>): ImportPlan {
  // mapping: rawCategory → chosen category name (existing, newly created, or UNCATEGORIZED)
  const rows = plan.rows.map(r => r.category === null && r.rawCategory && mapping.has(r.rawCategory.trim())
    ? { ...r, category: mapping.get(r.rawCategory.trim())! } : r);
  return { ...plan, rows, unrecognized: new Map() };
}
