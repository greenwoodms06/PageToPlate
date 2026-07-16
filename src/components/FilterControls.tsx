// Shared filter primitives (round-2): the dropdown button, dashed panel and
// tri-state select chip first built inline in BrowseTab, extracted so Browse
// and the Books tab render an identical Card Catalog filter UI. Styling is
// canvas-exact (Browse 2d): pill chips, dashed --dash panel, accent-tint
// include / danger not / neutral off.
import type { ReactNode } from 'react';

/** include → not → off cycle over a tap-ordered selection (books, cuisines). */
export type SelEntry = { id: string; neg: boolean };

export const cycleSel = (sel: SelEntry[], id: string): SelEntry[] => {
  const cur = sel.find((e) => e.id === id);
  if (!cur) return [...sel, { id, neg: false }];
  if (!cur.neg) return sel.map((e) => (e.id === id ? { ...e, neg: true } : e));
  return sel.filter((e) => e.id !== id);
};

/** A collapsible dropdown trigger. `▾` affordance, accent when a filter is set. */
export function DropBtn({
  label,
  active,
  open,
  onClick,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      style={{
        // 1 0 auto + nowrap: chips grow to share the row but never squash their
        // labels — overflow makes the row scroll rather than wrap.
        flex: '1 0 auto',
        whiteSpace: 'nowrap',
        minHeight: 40,
        padding: '0 12px',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'var(--accent-tint)' : 'var(--card)',
        borderRadius: 'var(--r-pill)',
        fontSize: 12.5,
        fontWeight: active ? 700 : 600,
        color: active ? 'var(--accent)' : 'var(--ink-mid)',
      }}
    >
      {label} ▾
    </button>
  );
}

export function DashPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1.5px dashed var(--dash)',
        borderRadius: 'var(--r-card)',
        padding: 9,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

/** Dropdown chip: off (neutral) / inc (colored border+tint, ✓) / not (danger, "not " prefix). */
export function SelChip({
  label,
  state,
  swatch,
  onClick,
}: {
  label: string;
  state: 'off' | 'inc' | 'not';
  /** 11×16 spine swatch color; omitted for non-book chips (e.g. cuisines). */
  swatch?: string;
  onClick: () => void;
}) {
  const color = state === 'inc' ? (swatch && swatch !== 'var(--neutral-spine)' ? swatch : 'var(--accent)') : 'var(--danger)';
  const styles =
    state === 'off'
      ? { border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink-soft)', fontWeight: 600 }
      : state === 'inc'
        ? {
            border: `1.5px solid ${color}`,
            // color-mix ≈ the canvas rgba(spine,.09) tints — CSS vars can't take
            // an alpha channel directly.
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color,
            fontWeight: 700,
          }
        : { border: '1.5px solid var(--danger)', background: 'var(--danger-tint)', color: 'var(--danger)', fontWeight: 700 };
  return (
    <button
      onClick={onClick}
      aria-pressed={state !== 'off'}
      style={{
        ...styles,
        borderRadius: 'var(--r-pill)',
        padding: '7px 12px',
        fontSize: 12.5,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {swatch !== undefined && (
        <i
          aria-hidden
          style={{
            width: 11,
            height: 16,
            borderRadius: 2,
            background: state === 'not' ? 'var(--neutral-spine)' : swatch,
            boxShadow: 'inset -2px 0 0 rgba(0,0,0,.18)',
            flex: 'none',
          }}
        />
      )}
      {state === 'not' ? `not ${label}` : state === 'inc' ? `${label} ✓` : label}
    </button>
  );
}
