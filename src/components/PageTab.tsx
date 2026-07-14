// Hanging page tab (plan Task 13 Step 3; handoff: 'a hanging page tab
// top-right ("p. 142", white 11px/700 text, radius 0 0 7px 7px)'). Canvas:
// right 14, top -1 (hangs off the card's top border), padding 3px 9px 4px.
// Text color is --tab-text (#fff light, #161511 dark — the dark spine palette
// brightens, so tab text flips dark per handoff §Colors(dark)). Parent must
// be position:relative with overflow visible.
export function PageTab({ color, page }: { color: string; page: string | number }) {
  return (
    <span
      style={{
        position: 'absolute',
        right: 14,
        top: -1,
        background: color,
        color: 'var(--tab-text)',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 9px 4px',
        borderRadius: '0 0 7px 7px',
      }}
    >
      p. {page}
    </span>
  );
}
