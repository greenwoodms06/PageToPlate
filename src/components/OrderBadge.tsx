// Tap-order badge (plan Task 13 Step 3; handoff: "24px numbered circle badge
// (tap order)" on selected book cards). Canvas-exact: 12px/700, text
// --tab-text (white light / #161511 dark, same flip as PageTab).
export function OrderBadge({ n, color }: { n: number; color: string }) {
  return (
    <span
      style={{
        flex: 'none',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: color,
        color: 'var(--tab-text)',
        fontSize: 12,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {n}
    </span>
  );
}
