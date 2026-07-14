import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES, mapRawCategory } from './categories';

describe('DEFAULT_CATEGORIES (owner decision 2026-07-14: 11, not the spec\'s 12)', () => {
  it('has exactly 11 defaults in the decided order', () => {
    expect(DEFAULT_CATEGORIES.map(c => c.name)).toEqual([
      'Mains',
      'Sides',
      'Soups & Stews',
      'Salads',
      'Breakfast & Brunch',
      'Breads',
      'Desserts',
      'Drinks',
      'Sauces & Condiments',
      'Preserves & Pickles',
      'Basics',
    ]);
  });

  it('does not include "Appetizers & Small Plates" (merged into Sides)', () => {
    expect(DEFAULT_CATEGORIES.map(c => c.name)).not.toContain('Appetizers & Small Plates');
  });
});

describe('mapRawCategory', () => {
  it('maps appetizer-vocabulary sections to Sides and auto-tags "appetizer"', () => {
    expect(mapRawCategory('Starters')).toEqual({ category: 'Sides', addTags: ['appetizer'] });
  });

  it('maps "Desserts & Sweets" to Desserts with no tags', () => {
    expect(mapRawCategory('Desserts & Sweets')).toEqual({ category: 'Desserts', addTags: [] });
  });

  it('trims whitespace: " Drinks " maps directly to Drinks', () => {
    expect(mapRawCategory(' Drinks ')).toEqual({ category: 'Drinks', addTags: [] });
  });

  it('returns null category for unrecognized sections (never silently created)', () => {
    expect(mapRawCategory('Household Hints')).toEqual({ category: null, addTags: [] });
  });

  it('respects extraNames: custom category matches case-insensitively', () => {
    expect(mapRawCategory('pasta night', ['Pasta Night'])).toEqual({ category: 'Pasta Night', addTags: [] });
  });

  it('appetizer-section matching is case-insensitive', () => {
    expect(mapRawCategory('DIM SUM')).toEqual({ category: 'Sides', addTags: ['appetizer'] });
  });
});
