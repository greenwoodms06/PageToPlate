// Recipe list row (plan Task 13 Step 5; canvas 2d Browse rows): card with a
// 7px spine stripe, name 15.5px/600 + right-aligned page, 12px soft meta line
// with optional StatusTag and gold ★ rating. Excluded recipes render dimmed
// (handoff 2d: "Excluded recipes at 60% opacity"). Presentational only —
// data comes in as strings; the caller resolves book/category names and the
// session spine color. Renders a <button> when tappable (rows open the
// universal recipe card from Task 22 on).
import type { ReactNode } from 'react';
import { SpineStripe } from './SpineStripe';
import { StatusTag, type StatusKind } from './StatusTag';

export function RecipeRow({
  name,
  page,
  meta,
  color = 'var(--neutral-spine)',
  tag,
  rating,
  dimmed = false,
  onClick,
}: {
  name: string;
  /** Page label, rendered right-aligned as "p. N". */
  page?: string;
  /** e.g. "The Woks of Life · Mains". */
  meta?: string;
  /** Session spine color (spineColor(i)); neutral when not in a session. */
  color?: string;
  tag?: { kind: StatusKind; label?: string };
  /** Gold ★ score (Browse shows the max across made entries). */
  rating?: number;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <SpineStripe color={color} />
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 15.5 }}>{name}</span>
        {page !== undefined && (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>p. {page}</span>
        )}
      </span>
      {(meta || tag || rating !== undefined) && (
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {meta && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{meta}</span>}
          {tag && <StatusTag kind={tag.kind} label={tag.label} />}
          {rating !== undefined && (
            <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>★ {rating}</span>
          )}
        </span>
      )}
    </>
  );

  const style = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-card)',
    padding: '12px 12px 12px 18px', // 18 left clears the 7px stripe
    position: 'relative',
    opacity: dimmed ? 0.6 : 1,
  } as const;

  return onClick ? (
    <button onClick={onClick} style={style}>
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
}

/** Shared list wrapper matching the canvas 9px row rhythm. */
export function RowList({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>;
}
