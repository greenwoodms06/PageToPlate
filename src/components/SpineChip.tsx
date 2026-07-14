// Book-spine chip (plan Task 13 Step 3; handoff: "14×44px spine chip" on book
// selection cards). Canvas-exact: radius 3, `inset -3px 0 0 rgba(0,0,0,.18)`
// right-edge shading (the fake book-spine look; the smaller 11×16 legend
// swatch uses -2px — that scale lives at its use site). `striped` renders the
// horizontal-striped neutral spine for uninstalled packs (2f Library) and
// drops the inset shading, matching the canvas. Library rows draw it at
// 16×56, book detail at 18×60 — hence the size props.
export function SpineChip({
  color,
  striped = false,
  width = 14,
  height = 44,
}: {
  /** Omit for the neutral (no session color) spine. */
  color?: string;
  striped?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        flex: 'none',
        display: 'inline-block',
        width,
        height,
        borderRadius: 3,
        background: striped ? 'var(--spine-striped)' : (color ?? 'var(--neutral-spine)'),
        boxShadow: striped ? undefined : 'inset -3px 0 0 rgba(0,0,0,.18)',
      }}
    />
  );
}
