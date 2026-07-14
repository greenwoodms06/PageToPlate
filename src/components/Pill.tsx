// Keyword pill (plan Task 13 Step 1; handoff §Component vocabulary). Values
// from canvas 2b filter panel: 999px radius, 12.5px/700, padding
// 7px 8px 7px 13px, 1.5px border; include = accent on --accent-tint, neg =
// danger colors with the label auto-prefixed "not "; body tap cycles
// include ↔ not; 18px circular × removes.
export function Pill({
  label,
  neg,
  onCycle,
  onRemove,
}: {
  label: string;
  neg: boolean;
  onCycle: () => void;
  onRemove: () => void;
}) {
  const color = neg ? 'var(--danger)' : 'var(--accent)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 'var(--r-pill)',
        padding: '7px 8px 7px 13px',
        fontSize: 12.5,
        fontWeight: 700,
        border: `1.5px solid ${color}`,
        color,
        background: neg ? 'var(--danger-tint)' : 'var(--accent-tint)',
      }}
    >
      <button
        onClick={onCycle}
        aria-pressed={neg}
        aria-label={`${neg ? 'not ' : ''}${label} — tap to flip include/not`}
        style={{ color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit' }}
      >
        {neg ? `not ${label}` : label}
      </button>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          background: 'var(--pill-x-bg)',
          color: 'inherit',
          borderRadius: '50%',
          width: 18,
          height: 18,
          fontSize: 11,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </span>
  );
}
