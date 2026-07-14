// Inactive suggestion chip (plan Task 13 Step 1; handoff §Component
// vocabulary: "same shape, line border, soft-ink text; tap converts it to a
// pill"). Values from canvas 2b filter panel.
export function Chip({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      style={{
        border: '1.5px solid var(--line)',
        background: 'var(--card)',
        borderRadius: 'var(--r-pill)',
        padding: '7px 13px',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--ink-soft)',
      }}
    >
      {label}
    </button>
  );
}
