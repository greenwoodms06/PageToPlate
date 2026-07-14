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
  const byName = new Map(existing.map(r => [normName(r.name), r]));
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
    const prior = byName.get(normName(name));
    const action: ImportRow['action'] = !prior ? 'add'
      : prior.page === p.page && (category === null || prior.category === category) ? 'skip' : 'update';
    return { name, page: p.page, rawCategory: p.category, category, tags, action, existingId: prior?.id };
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
