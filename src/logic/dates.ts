// Shared 'YYYY-MM-DD' display helpers (Tasks 18–20). The `T00:00:00` suffix
// parses at LOCAL midnight — a bare 'YYYY-MM-DD' would parse as UTC and render
// one day early west of Greenwich (pattern established in PlanCreated.tsx).
export const fromISO = (iso: string): Date => new Date(`${iso}T00:00:00`);

/** 'July 11' — plan-card headers, calendar detail. */
export const monthDayLong = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

/** 'Jul 14' — mark-as-made date button and save CTA. */
export const monthDayShort = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
