// Rating scale module (Checkpoint 2 amendment 3). Storage is canonical 1–10
// forever; the 5-scale is DISPLAY-ONLY binning. These tests pin the owner's
// bins and the roundtrip guarantee — switching scales never mutates data.
import { describe, expect, it } from 'vitest';
import { avgDisplay, displayRating, formatRating, ratingMatches, storeRating } from './rating';

describe('displayRating', () => {
  it('is identity on the 10-scale', () => {
    for (let v = 1; v <= 10; v++) expect(displayRating(v, 10)).toBe(v);
  });

  it('bins stored 1–10 into the owner-pinned 5-scale bins', () => {
    // Pinned bins: 1,2→1 · 3,4→2 · 5,6→3 · 7,8→4 · 9,10→5.
    const expected: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5 };
    for (const [stored, display] of Object.entries(expected)) {
      expect(displayRating(Number(stored), 5)).toBe(display);
    }
  });
});

describe('storeRating', () => {
  it('is identity on the 10-scale', () => {
    for (let v = 1; v <= 10; v++) expect(storeRating(v, 10)).toBe(v);
  });

  it('stores display×2 on the 5-scale (2,4,6,8,10)', () => {
    expect([1, 2, 3, 4, 5].map((v) => storeRating(v, 5))).toEqual([2, 4, 6, 8, 10]);
  });

  it('roundtrips: displayRating(storeRating(v,5),5) === v for v 1..5', () => {
    for (let v = 1; v <= 5; v++) expect(displayRating(storeRating(v, 5), 5)).toBe(v);
  });
});

describe('formatRating', () => {
  it("formats '8/10' on the 10-scale", () => {
    expect(formatRating(8, 10)).toBe('8/10');
  });

  it("formats binned display over 5 on the 5-scale — '4/5' for stored 7 and 8", () => {
    expect(formatRating(8, 5)).toBe('4/5');
    expect(formatRating(7, 5)).toBe('4/5');
  });
});

describe('avgDisplay', () => {
  it('is identity on the 10-scale', () => {
    expect(avgDisplay(7.4, 10)).toBe(7.4);
  });

  it('halves continuously on the 5-scale — NOT binned, averages must stay smooth', () => {
    expect(avgDisplay(7.4, 5)).toBeCloseTo(3.7);
    expect(avgDisplay(7, 5)).toBeCloseTo(3.5); // binning would snap this to 4
  });
});

describe('ratingMatches', () => {
  it('10-scale: above=≥, exact====, below=<', () => {
    expect(ratingMatches(8, 8, 'above', 10)).toBe(true);
    expect(ratingMatches(7, 8, 'above', 10)).toBe(false);
    expect(ratingMatches(8, 8, 'exact', 10)).toBe(true);
    expect(ratingMatches(9, 8, 'exact', 10)).toBe(false);
    expect(ratingMatches(7, 8, 'below', 10)).toBe(true);
    expect(ratingMatches(8, 8, 'below', 10)).toBe(false);
  });

  it("5-scale 'above' uses the bin's lower edge: threshold 4 ⇒ stored 7 matches, 6 doesn't", () => {
    expect(ratingMatches(7, 4, 'above', 5)).toBe(true);
    expect(ratingMatches(6, 4, 'above', 5)).toBe(false);
    expect(ratingMatches(8, 4, 'above', 5)).toBe(true);
    expect(ratingMatches(10, 4, 'above', 5)).toBe(true);
  });

  it("5-scale 'exact' matches within the bin: threshold 4 ⇒ 7,8 match, 9 doesn't", () => {
    expect(ratingMatches(7, 4, 'exact', 5)).toBe(true);
    expect(ratingMatches(8, 4, 'exact', 5)).toBe(true);
    expect(ratingMatches(9, 4, 'exact', 5)).toBe(false);
    expect(ratingMatches(6, 4, 'exact', 5)).toBe(false);
  });

  it("5-scale 'below' is below the bin's lower edge: threshold 4 ⇒ 6 matches, 7 doesn't", () => {
    expect(ratingMatches(6, 4, 'below', 5)).toBe(true);
    expect(ratingMatches(7, 4, 'below', 5)).toBe(false);
  });
});
