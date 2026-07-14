// Status tag (plan Task 13 Step 2; handoff §Component vocabulary: "10.5px
// uppercase 700, radius 5px" with per-kind tints). Colors/padding extracted
// from canvas rows (Browse 2d, Library 2f/3g): Made & Installed = accent
// tint, Never make = danger tint, Readable online = --readable-*, Index only
// = --indexonly-*. Letter-spacing is .06em on made/never, .05em elsewhere
// (canvas-exact).
export type StatusKind = 'made' | 'never' | 'installed' | 'readable' | 'index-only';

const KINDS: Record<StatusKind, { bg: string; color: string; label: string; ls: string }> = {
  made: { bg: 'var(--accent-tint)', color: 'var(--accent)', label: 'Made', ls: '.06em' },
  never: { bg: 'var(--danger-tint)', color: 'var(--danger)', label: 'Never make', ls: '.06em' },
  installed: { bg: 'var(--accent-tint)', color: 'var(--accent)', label: 'Installed', ls: '.05em' },
  readable: { bg: 'var(--readable-bg)', color: 'var(--readable-text)', label: 'Readable online', ls: '.05em' },
  'index-only': { bg: 'var(--indexonly-bg)', color: 'var(--indexonly-text)', label: 'Index only — own the book', ls: '.05em' },
};

/** `label` overrides the kind default (e.g. "Made ×2"). */
export function StatusTag({ kind, label }: { kind: StatusKind; label?: string }) {
  const k = KINDS[kind];
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: k.ls,
        textTransform: 'uppercase',
        padding: '3px 7px',
        borderRadius: 'var(--r-tag)',
        background: k.bg,
        color: k.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? k.label}
    </span>
  );
}
