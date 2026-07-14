import { describe, expect, it } from 'vitest';
import type { Pill } from '../data/types';
import { addPill, recipeMatches, removePill, togglePill } from './pills';

const pill = (text: string, neg = false): Pill => ({ text, neg });

describe('recipeMatches', () => {
  it('matches case-insensitive substring over name + tags', () => {
    const r = { name: 'Stir-Fried Beef with Oyster Sauce', tags: ['chinese'] };
    expect(recipeMatches(r, [pill('beef')])).toBe(true);
    expect(recipeMatches(r, [pill('BEEF'.toLowerCase())])).toBe(true); // pills are stored lowercase
    expect(recipeMatches(r, [pill('chinese')])).toBe(true); // hit via tags
    expect(recipeMatches(r, [pill('chicken')])).toBe(false);
  });

  it('is case-insensitive against the recipe text (Rule 1)', () => {
    const r = { name: 'CHAR SIU PORK', tags: ['Roast'] };
    expect(recipeMatches(r, [pill('pork')])).toBe(true);
    expect(recipeMatches(r, [pill('roast')])).toBe(true);
  });

  it('works with zero tags (Rule 1: tags optional)', () => {
    const r = { name: 'Soy Sauce Chicken', tags: [] };
    expect(recipeMatches(r, [pill('chicken')])).toBe(true);
    expect(recipeMatches(r, [pill('beef')])).toBe(false);
  });

  it('ANDs multiple pills', () => {
    const r = { name: 'Stir-Fried Beef with Oyster Sauce', tags: ['chinese'] };
    expect(recipeMatches(r, [pill('beef'), pill('chinese')])).toBe(true);
    expect(recipeMatches(r, [pill('beef'), pill('cake')])).toBe(false);
  });

  it('neg pill excludes matching recipes', () => {
    const beef = { name: 'Stir-Fried Beef with Oyster Sauce', tags: ['chinese'] };
    const tofu = { name: 'Mapo Tofu', tags: ['vegetarian', 'spicy'] };
    expect(recipeMatches(beef, [pill('beef', true)])).toBe(false);
    expect(recipeMatches(tofu, [pill('beef', true)])).toBe(true);
  });

  it('matches everything when there are no pills', () => {
    expect(recipeMatches({ name: 'Anything', tags: [] }, [])).toBe(true);
  });
});

describe('addPill', () => {
  it('lowercases and trims the text', () => {
    expect(addPill([], '  BeEf  ')).toEqual([{ text: 'beef', neg: false }]);
  });

  it('dedupes existing pill text', () => {
    const pills = [pill('beef')];
    expect(addPill(pills, 'BEEF')).toBe(pills);
    expect(addPill(pills, ' beef ')).toBe(pills);
  });

  it('ignores empty/whitespace-only input', () => {
    const pills = [pill('beef')];
    expect(addPill(pills, '   ')).toBe(pills);
    expect(addPill(pills, '')).toBe(pills);
  });

  it('appends without mutating the original array', () => {
    const pills = [pill('beef')];
    const next = addPill(pills, 'pork');
    expect(next).toEqual([pill('beef'), pill('pork')]);
    expect(pills).toEqual([pill('beef')]);
  });
});

describe('togglePill', () => {
  it('flips neg at the given index only', () => {
    const pills = [pill('beef'), pill('pork')];
    expect(togglePill(pills, 1)).toEqual([pill('beef'), pill('pork', true)]);
    expect(togglePill(togglePill(pills, 1), 1)).toEqual(pills);
    expect(pills[1].neg).toBe(false); // no mutation
  });
});

describe('removePill', () => {
  it('removes by index without mutating', () => {
    const pills = [pill('beef'), pill('pork'), pill('fish')];
    expect(removePill(pills, 1)).toEqual([pill('beef'), pill('fish')]);
    expect(pills).toHaveLength(3);
  });
});
