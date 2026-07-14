import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../data/categories';
import type { Recipe } from '../data/types';
import { parseRecipeCsv } from './csv';
import { planImport, resolveUnrecognized, type ImportRow } from './importer';

const CATEGORY_NAMES = DEFAULT_CATEGORIES.map(c => c.name);

const parsedRow = (name: string, page: string, category?: string, tags: string[] = []) =>
  ({ name, page, category, tags });

const existingRecipe = (over: Partial<Recipe> & Pick<Recipe, 'name' | 'page' | 'category'>): Recipe => ({
  id: 'r-' + over.name, bookId: 'b1', tags: [], status: 'active', isCustom: false,
  attachmentIds: [], createdAt: '2026-07-14', ...over,
});

describe('planImport — category mapping', () => {
  it('maps "Appetizers & Small Plates" to Sides and adds the appetizer tag', () => {
    const plan = planImport([parsedRow('Oven-Fried Onion Rings', '321', 'Appetizers & Small Plates')], [], CATEGORY_NAMES);
    expect(plan.rows[0].category).toBe('Sides');
    expect(plan.rows[0].tags).toContain('appetizer');
  });

  it('maps "Desserts & Sweets" to Desserts without extra tags', () => {
    const plan = planImport([parsedRow('Chocolate Sheet Cake', '700', 'Desserts & Sweets')], [], CATEGORY_NAMES);
    expect(plan.rows[0].category).toBe('Desserts');
    expect(plan.rows[0].tags).toEqual([]);
  });

  it('collects unrecognized categories with counts instead of silently creating them (Rule 7)', () => {
    const plan = planImport([
      parsedRow('Removing Stains', '901', 'Household Hints'),
      parsedRow('Polishing Silver', '902', 'Household Hints'),
      parsedRow('Whittling', '903', 'Crafts'),
    ], [], CATEGORY_NAMES);
    expect(plan.rows.every(r => r.category === null)).toBe(true);
    expect(plan.unrecognized).toEqual(new Map([['Household Hints', 2], ['Crafts', 1]]));
  });

  it('resolveUnrecognized applies the user mapping and clears the unrecognized set', () => {
    const plan = planImport([parsedRow('Removing Stains', '901', 'Household Hints')], [], CATEGORY_NAMES);
    const resolved = resolveUnrecognized(plan, new Map([['Household Hints', 'Basics']]));
    expect(resolved.rows[0].category).toBe('Basics');
    expect(resolved.unrecognized.size).toBe(0);
  });
});

describe('planImport — duplicate detection (skip or update, never double-enter)', () => {
  const prior = existingRecipe({ name: 'Best Beef Stew', page: '5', category: 'Soups & Stews' });

  it('marks brand-new recipes as add', () => {
    const plan = planImport([parsedRow('Avgolemono', '5', 'Soups & Stews')], [prior], CATEGORY_NAMES);
    expect(plan.rows[0].action).toBe('add');
    expect(plan.rows[0].existingId).toBeUndefined();
  });

  it('skips when normalized name matches and page + category are identical', () => {
    const plan = planImport([parsedRow('  best  BEEF stew ', '5', 'Soups & Stews')], [prior], CATEGORY_NAMES);
    expect(plan.rows[0].action).toBe('skip');
    expect(plan.rows[0].existingId).toBe(prior.id);
  });

  it('updates when the name matches but the page differs', () => {
    const plan = planImport([parsedRow('Best Beef Stew', '99', 'Soups & Stews')], [prior], CATEGORY_NAMES);
    expect(plan.rows[0].action).toBe('update');
    expect(plan.rows[0].existingId).toBe(prior.id);
  });

  it('updates when the name matches but the category differs', () => {
    const plan = planImport([parsedRow('Best Beef Stew', '5', 'Mains')], [prior], CATEGORY_NAMES);
    expect(plan.rows[0].action).toBe('update');
  });

  it('tallies adds/skips/updates', () => {
    const plan = planImport([
      parsedRow('Best Beef Stew', '5', 'Soups & Stews'),
      parsedRow('Best Beef Stew', '99', 'Soups & Stews'),
      parsedRow('Avgolemono', '5', 'Soups & Stews'),
    ], [prior], CATEGORY_NAMES);
    expect({ adds: plan.adds, skips: plan.skips, updates: plan.updates }).toEqual({ adds: 1, skips: 1, updates: 1 });
  });
});

describe('planImport — tag redundancy', () => {
  it('drops keywords already present in the recipe name, keeps the rest', () => {
    const plan = planImport(
      [parsedRow('Classic Chicken Noodle Soup', '2', 'Soups & Stews', ['chicken', 'international'])],
      [], CATEGORY_NAMES);
    expect(plan.rows[0].tags).toEqual(['international']);
  });
});

describe('planImport — idempotence', () => {
  it('re-running over already-imported rows yields zero adds', () => {
    const parsed = [
      parsedRow('Oven-Fried Onion Rings', '321', 'Appetizers & Small Plates'),
      parsedRow('Chocolate Sheet Cake', '700', 'Desserts & Sweets'),
      parsedRow('Best Beef Stew', '5', 'Soups & Stews'),
    ];
    const first = planImport(parsed, [], CATEGORY_NAMES);
    expect(first.adds).toBe(3);
    const imported = first.rows.map((r: ImportRow) =>
      existingRecipe({ name: r.name, page: r.page, category: r.category!, tags: r.tags }));
    const second = planImport(parsed, imported, CATEGORY_NAMES);
    expect(second.adds).toBe(0);
    expect(second.skips).toBe(3);
  });
});

describe('planImport — full ATK export end-to-end', () => {
  it('maps all 1645 rows with zero unrecognized categories; the 9 appetizer rows land in Sides tagged appetizer', () => {
    const text = readFileSync(fileURLToPath(new URL('../../background/atk_index.csv', import.meta.url)), 'utf-8');
    const { rows } = parseRecipeCsv(text);
    const plan = planImport(rows, [], CATEGORY_NAMES);
    expect(plan.unrecognized.size).toBe(0);
    expect(plan.adds).toBe(1645);
    const appetizers = plan.rows.filter(r => r.rawCategory === 'Appetizers & Small Plates');
    expect(appetizers).toHaveLength(9);
    expect(appetizers.every(r => r.category === 'Sides' && r.tags.includes('appetizer'))).toBe(true);
  });
});
