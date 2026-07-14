import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeCsv } from './csv';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8');

describe('header detection', () => {
  it('detects a header by header words (page/recipe/name/category/keywords/tags)', () => {
    const { rows, hadHeader } = parseRecipeCsv('Recipe Name,Page\nClassic Chicken Noodle Soup,2');
    expect(hadHeader).toBe(true);
    expect(rows).toEqual([{ name: 'Classic Chicken Noodle Soup', page: '2', category: undefined, tags: [] }]);
  });

  it('detects a header by a non-numeric page cell even without header words', () => {
    const { rows, hadHeader } = parseRecipeCsv('Dish,Pg No.\nBest Beef Stew,5');
    expect(hadHeader).toBe(true);
    expect(rows).toEqual([{ name: 'Best Beef Stew', page: '5', category: undefined, tags: [] }]);
  });

  it('treats headerless files as name,page[,category[,tags]]', () => {
    const { rows, hadHeader } = parseRecipeCsv('Avgolemono,5,Soups & Stews,mediterranean\nBest Beef Stew,5');
    expect(hadHeader).toBe(false);
    expect(rows).toEqual([
      { name: 'Avgolemono', page: '5', category: 'Soups & Stews', tags: ['mediterranean'] },
      { name: 'Best Beef Stew', page: '5', category: undefined, tags: [] },
    ]);
  });

  it('maps the ATK header order (Page Number,Recipe Name,Category,Keywords) by names', () => {
    const { rows, hadHeader } = parseRecipeCsv(read('./fixtures/atk_sample.csv'));
    expect(hadHeader).toBe(true);
    expect(rows).toHaveLength(29);
    expect(rows[0]).toEqual({ name: 'Classic Chicken Noodle Soup', page: '2', category: 'Soups & Stews', tags: [] });
    expect(rows[8]).toEqual({ name: 'Tuscan-Style Beef Stew', page: '7', category: 'Soups & Stews', tags: ['italian'] });
  });
});

describe('field parsing', () => {
  it('keeps commas inside quoted fields', () => {
    const { rows } = parseRecipeCsv(
      'Page Number,Recipe Name,Category,Keywords\n' +
      '41,"Arugula Salad with Figs, Prosciutto, Walnuts, and Parmesan",Salads,');
    expect(rows).toEqual([{
      name: 'Arugula Salad with Figs, Prosciutto, Walnuts, and Parmesan',
      page: '41', category: 'Salads', tags: [],
    }]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    const { rows, hadHeader } = parseRecipeCsv('"Say ""Cheese"" Cake",99');
    expect(hadHeader).toBe(false);
    expect(rows).toEqual([{ name: 'Say "Cheese" Cake', page: '99', category: undefined, tags: [] }]);
  });

  it('tolerates CRLF line endings', () => {
    const { rows, hadHeader } = parseRecipeCsv('Recipe Name,Page,Category\r\nBest Beef Stew,5,Soups & Stews\r\nAvgolemono,5,Soups & Stews\r\n');
    expect(hadHeader).toBe(true);
    expect(rows).toEqual([
      { name: 'Best Beef Stew', page: '5', category: 'Soups & Stews', tags: [] },
      { name: 'Avgolemono', page: '5', category: 'Soups & Stews', tags: [] },
    ]);
  });

  it('trims stray whitespace in cells (category "Drinks " → "Drinks")', () => {
    const { rows } = parseRecipeCsv('Page Number,Recipe Name,Category,Keywords\n969, Mulled Wine ,Drinks ,');
    expect(rows).toEqual([{ name: 'Mulled Wine', page: '969', category: 'Drinks', tags: [] }]);
  });

  it('splits the keywords cell on commas and semicolons', () => {
    const { rows } = parseRecipeCsv('Name,Page,Category,Keywords\nGrilled Thing,5,Mains,"weeknight, quick; grill"');
    expect(rows[0].tags).toEqual(['weeknight', 'quick', 'grill']);
  });

  it('skips fully-empty lines', () => {
    const { rows } = parseRecipeCsv('Recipe Name,Page\n\nBest Beef Stew,5\n,\n\nAvgolemono,5\n\n');
    expect(rows.map(r => r.name)).toEqual(['Best Beef Stew', 'Avgolemono']);
  });
});

describe('real ATK export', () => {
  it('parses background/atk_index.csv to exactly 1645 rows', () => {
    const { rows, hadHeader } = parseRecipeCsv(read('../../background/atk_index.csv'));
    expect(hadHeader).toBe(true);
    expect(rows).toHaveLength(1645);
  });
});
