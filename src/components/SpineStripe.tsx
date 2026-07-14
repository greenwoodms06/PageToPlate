// Book-spine stripe (plan Task 13 Step 3; handoff: "7px spine stripe on the
// left edge, rounded 12px 0 0 12px"). Absolutely positioned — the parent card
// must be position:relative with left padding (recipe cards use
// 14px 14px 12px 20px / rows 12px 12px 12px 18px) to clear it.
export function SpineStripe({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 7,
        background: color,
        borderRadius: '12px 0 0 12px',
      }}
    />
  );
}
