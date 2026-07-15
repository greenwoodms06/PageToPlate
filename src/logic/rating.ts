// Rating display scale (Checkpoint 2 amendment 3). DECISION RECORD: storage
// is canonical 1–10 forever; `ratingScale: 5` is display-only binning
// (1,2→1 · 3,4→2 · 5,6→3 · 7,8→4 · 9,10→5; input on the 5-scale stores ×2).
// Switching scales NEVER mutates stored data — the owner's hard requirement.
// 1–100 / custom scales were considered and rejected (false precision); the
// canonical storage leaves room for more display options without migration.
export type RatingScale = 5 | 10;

/** Stored 1–10 → displayed value on the active scale (5-scale bins upward). */
export function displayRating(stored: number, scale: RatingScale): number {
  return scale === 10 ? stored : Math.ceil(stored / 2);
}

/** Displayed value the user tapped → canonical stored 1–10 (5-scale stores ×2: 2,4,6,8,10). */
export function storeRating(display: number, scale: RatingScale): number {
  return scale === 10 ? display : display * 2;
}

/** '8/10' | '4/5' — displayed value over the scale maximum. */
export function formatRating(stored: number, scale: RatingScale): string {
  return `${displayRating(stored, scale)}/${scale}`;
}

/**
 * Average conversion is CONTINUOUS (÷2), not binned — a 7.0 stored average
 * must show 3.5, not snap to 4. Callers round for display (1 decimal).
 */
export function avgDisplay(avgStored: number, scale: RatingScale): number {
  return scale === 10 ? avgStored : avgStored / 2;
}

/**
 * Does a stored 1–10 rating satisfy a threshold given in DISPLAY units?
 * On the 5-scale, display bin b covers stored [b*2-1, b*2], so:
 * above = stored ≥ b*2-1 · exact = within the bin · below = stored < b*2-1.
 */
export function ratingMatches(
  stored: number,
  threshold: number,
  mode: 'above' | 'exact' | 'below',
  scale: RatingScale,
): boolean {
  const lo = scale === 10 ? threshold : threshold * 2 - 1;
  const hi = scale === 10 ? threshold : threshold * 2;
  if (mode === 'above') return stored >= lo;
  if (mode === 'below') return stored < lo;
  return stored >= lo && stored <= hi;
}
