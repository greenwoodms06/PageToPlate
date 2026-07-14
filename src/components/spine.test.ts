import { describe, expect, it } from 'vitest';
import { spineColor } from './spine';

describe('spineColor', () => {
  it('maps order index to 1-based palette slots', () => {
    expect(spineColor(0)).toBe('var(--spine-1)');
    expect(spineColor(3)).toBe('var(--spine-4)');
    expect(spineColor(7)).toBe('var(--spine-8)');
  });

  it('cycles the 8-slot palette past eight selections', () => {
    expect(spineColor(8)).toBe('var(--spine-1)');
    expect(spineColor(15)).toBe('var(--spine-8)');
    expect(spineColor(16)).toBe('var(--spine-1)');
  });

  it('returns the neutral spine for -1 (deselected / not in session)', () => {
    expect(spineColor(-1)).toBe('var(--neutral-spine)');
  });
});
