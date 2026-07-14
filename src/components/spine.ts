// Session book-color helper (plan Task 13 Step 3; handoff "signature rule":
// books get a color from the 8-slot Okabe–Ito palette in tap order, never
// permanently bound). Callers pass the book's index in the ordered selection
// (e.g. `sel.indexOf(bookId)`); the palette cycles past 8 selections.
export function spineColor(orderIndex: number): string {
  // indexOf() returns -1 for a deselected book — that is "no session color",
  // which the design renders as the neutral spine (handoff: "Books not
  // selected … neutral #DAD7C8"), not a palette slot.
  if (orderIndex < 0) return 'var(--neutral-spine)';
  return `var(--spine-${(orderIndex % 8) + 1})`;
}
