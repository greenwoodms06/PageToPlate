// Segment toggle (plan Task 13 Step 2): generic two/three-segment chip row.
// Values from canvas 2c Plans List/Calendar toggle: 1.5px line border pill,
// segments 8px 16px 12.5px; active = accent fill + --on-accent text 700
// (dark accent flips text dark per tokens), inactive = card bg soft ink 600.
export function SegmentToggle({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-pill)',
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt)}
            style={{
              background: on ? 'var(--accent)' : 'var(--card)',
              color: on ? 'var(--on-accent)' : 'var(--ink-soft)',
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: on ? 700 : 600,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
