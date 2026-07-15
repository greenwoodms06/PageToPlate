// Shared Settings chrome (plan Task 26; canvas 4a–4c). Every settings screen
// uses the same back-arrow header (values match AiImportHelp: 38px circle,
// 1.5px line border, display-font title), the canvas 4a uppercase section
// label (11px/.1em — deliberately NOT .section-label, which is the larger
// display-font variant), card containers, tappable nav rows with dashed
// dividers, and the 46×28 switch from canvas 4c's reminder row.
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export function SettingsHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          aria-label="Back"
          onClick={() => window.history.back()}
          style={{
            width: 38,
            height: 38,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-pill)',
            background: 'var(--card)',
            color: 'var(--ink-mid)',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="screen-title">{title}</h1>
      </div>
      {sub && <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 14px' }}>{sub}</p>}
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        fontWeight: 700,
        margin: '18px 0 8px',
      }}
    >
      {children}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Grouped-list nav row: bold title, small subtitle, chevron. */
export function NavRow({
  title,
  sub,
  subColor,
  onClick,
  last,
}: {
  title: string;
  sub?: string;
  /** Subtitle color override (danger for the overdue-backup warning). */
  subColor?: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: last ? 'none' : '1px dashed var(--line)',
        padding: 14,
        fontSize: 14.5,
        minHeight: 52,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{title}</b>
        {sub && (
          <>
            <br />
            <small style={{ color: subColor ?? 'var(--ink-soft)', fontSize: 12 }}>{sub}</small>
          </>
        )}
      </span>
      <span aria-hidden style={{ color: 'var(--ink-disabled)' }}>›</span>
    </button>
  );
}

/** Canvas 4c reminder switch: 46×28 pill, 22px knob inset 3px. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        flex: 'none',
        width: 46,
        height: 28,
        borderRadius: 'var(--r-pill)',
        background: on ? 'var(--accent)' : 'var(--dash)',
        position: 'relative',
        transition: 'background .2s',
      }}
    >
      <i
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s',
        }}
      />
    </button>
  );
}

/** Row with a Switch on the right (canvas 4c "Remind me to back up"). */
export function ToggleRow({
  title,
  sub,
  on,
  onChange,
  last,
}: {
  title: string;
  sub?: string;
  on: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: last ? 'none' : '1px dashed var(--line)',
        padding: '12px 14px',
        minHeight: 52,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <b style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</b>
        {sub && (
          <>
            <br />
            <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{sub}</small>
          </>
        )}
      </span>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}
