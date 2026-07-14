// Shared wizard chrome (Tasks 14–17): kicker header + step counter, the
// 3-segment progress bar, and the primary/ghost button styles every step
// reuses. Values are canvas-exact (2a/2b/1a footers, prototype lines 22–30).

export function WizardHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            fontWeight: 600,
          }}
        >
          Page to Plate
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
          {step === 4 ? 'Done' : `Step ${step} of 3`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0 16px' }}>
        {([1, 2, 3] as const).map((n) => (
          <span
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: step >= n ? 'var(--accent)' : 'var(--dash)',
            }}
          />
        ))}
      </div>
    </>
  );
}

/** 52px primary CTA — accent (disabled: --accent-disabled), radius 14. */
export function PrimaryCta({
  label,
  disabled = false,
  onClick,
  marginTop = 10,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  marginTop?: number;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 52,
        background: disabled ? 'var(--accent-disabled)' : 'var(--accent)',
        color: 'var(--on-accent)',
        borderRadius: 'var(--r-cta)',
        fontSize: 16,
        fontWeight: 700,
        marginTop,
      }}
    >
      {label}
    </button>
  );
}

/** Ghost footer button — 1.5px line border, radius 14, mid ink. */
export function GhostBtn({
  label,
  onClick,
  minHeight = 44,
  fontSize = 14,
  color = 'var(--ink-mid)',
  style,
}: {
  label: string;
  onClick: () => void;
  minHeight?: number;
  fontSize?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        minHeight,
        border: '1.5px solid var(--line)',
        background: 'none',
        borderRadius: 'var(--r-cta)',
        fontSize,
        fontWeight: 600,
        color,
        ...style,
      }}
    >
      {label}
    </button>
  );
}
