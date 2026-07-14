// Count stepper (plan Task 13 Step 2; handoff §Component vocabulary:
// "pill-shaped, 38×36px +/− buttons in accent green, count 700
// (disabled-gray at 0)"). Values from canvas 2b category rows: 1.5px line
// border, overflow hidden, 18px button glyphs, 28px-wide 15px/700 count.
export function Stepper({ value, onInc, onDec }: { value: number; onInc: () => void; onDec: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-pill)',
        overflow: 'hidden',
      }}
    >
      <button
        aria-label="Decrease"
        onClick={() => {
          if (value > 0) onDec(); // never call below 0 — counts are 0-floored
        }}
        style={btn}
      >
        −
      </button>
      <span
        style={{
          width: 28,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 15,
          color: value === 0 ? 'var(--ink-disabled)' : 'inherit',
        }}
      >
        {value}
      </span>
      <button aria-label="Increase" onClick={onInc} style={btn}>
        +
      </button>
    </span>
  );
}

const btn = {
  background: 'var(--card)',
  width: 38,
  height: 36,
  fontSize: 18,
  color: 'var(--accent)',
  fontWeight: 700,
} as const;
