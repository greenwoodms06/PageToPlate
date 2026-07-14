// Pill editor (plan Task 13 Step 1): active pills + the category's remaining
// suggestion chips + a free-text input (Enter → addPill, deduped/lowercased
// by logic/pills). Purely presentational — value + onChange in props, no
// store access; pill state transitions come from src/logic/pills.ts.
// Layout/values from canvas 2b filter panel (chips row gap 7, input 1.5px
// line border radius 10 padding 10px 12px).
import { useState } from 'react';
import type { Pill as PillT } from '../data/types';
import { addPill, removePill, togglePill } from '../logic/pills';
import { Chip } from './Chip';
import { Pill } from './Pill';

export function PillEditor({
  pills,
  chips = [],
  onChange,
  placeholder = 'Type a keyword, return adds a pill…',
}: {
  pills: PillT[];
  chips?: string[];
  onChange: (pills: PillT[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  // A chip disappears once it exists as a pill (either polarity).
  const remaining = chips.filter((c) => !pills.some((p) => p.text === c.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {pills.map((p, i) => (
          <Pill
            key={p.text}
            label={p.text}
            neg={p.neg}
            onCycle={() => onChange(togglePill(pills, i))}
            onRemove={() => onChange(removePill(pills, i))}
          />
        ))}
        {remaining.map((c) => (
          <Chip key={c} label={c} onAdd={() => onChange(addPill(pills, c))} />
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const next = addPill(pills, text);
          if (next !== pills) onChange(next);
          setText('');
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--r-inner)',
          padding: '10px 12px',
          fontSize: 14,
          background: 'var(--card)',
          marginTop: 9,
        }}
      />
    </div>
  );
}
