// Cooking-journal calendar (plan Task 20; canvas 2c bottom, dark 3d).
// Sun-start month grid: violet ring (--planned) = a plan was ACCEPTED that day
// (Rule 4: plans are dated by acceptance, not cooking), solid green dot = ≥1
// MadeEntry that day — both can coexist. Tapping a day shows the detail block
// under the grid; orphaned entries (book deleted, history kept) render neutral
// from their {recipeName, bookTitle} snapshot.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { store, useStore } from '../../data/store';
import { todayISO } from '../../data/types';
import { fromISO } from '../../logic/dates';
import { displayRating } from '../../logic/rating';
import { RecipeCardSheet } from '../recipe/RecipeCardSheet';

const pad2 = (n: number) => String(n).padStart(2, '0');

// Markers, canvas-exact: 5px in day cells, 8px in legend/detail lines. All are
// flex children (inline <i> would ignore width/height otherwise).
const ring5: CSSProperties = { width: 5, height: 5, borderRadius: '50%', border: '1.5px solid var(--planned)', flex: 'none' };
const dot5: CSSProperties = { width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flex: 'none' };
const ring8: CSSProperties = { width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--planned)', flex: 'none' };
const dot8: CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flex: 'none' };
const dotNeutral8: CSSProperties = { ...dot8, background: 'var(--neutral-spine)' };

export function CalendarView({ onOpenPlan }: { onOpenPlan: (planId: string) => void }) {
  useStore((s) => s.version);
  const today = todayISO();
  const [ym, setYm] = useState(today.slice(0, 7)); // 'YYYY-MM'
  const [selected, setSelected] = useState<string>(today);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);

  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const lead = new Date(y, m - 1, 1).getDay(); // 0 = Sunday → Sun-start grid
  const daysInMonth = new Date(y, m, 0).getDate();
  const prevMonthDays = new Date(y, m - 1, 0).getDate();

  // Cells: grayed prev-month tail, the month itself (with ISO date), grayed
  // next-month lead to square off the final week.
  const cells: { key: string; label: number; iso?: string }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ key: `p${i}`, label: prevMonthDays - lead + 1 + i });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: `d${d}`, label: d, iso: `${ym}-${pad2(d)}` });
  for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ key: `n${d}`, label: d });

  const planDates = new Set(store.plans.map((p) => p.acceptedAt));
  const madeDates = new Set(store.madeEntries.map((e) => e.date));

  const move = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  };

  const title = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const chev: CSSProperties = {
    minWidth: 36,
    minHeight: 32,
    fontSize: 18,
    color: 'var(--ink-mid)',
    borderRadius: 'var(--r-inner)',
  };

  return (
    <section
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, flex: 1 }}>{title}</div>
        <button aria-label="Previous month" onClick={() => move(-1)} style={chev}>‹</button>
        <button aria-label="Next month" onClick={() => move(1)} style={chev}>›</button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          fontSize: 11,
          color: 'var(--ink-mid)',
          fontWeight: 600,
          margin: '2px 0 8px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <i aria-hidden style={ring8} />plan accepted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <i aria-hidden style={dot8} />recipe made
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} style={{ color: 'var(--ink-soft)', fontWeight: 700, fontSize: 10, padding: '3px 0' }}>
            {d}
          </span>
        ))}
        {cells.map((c) =>
          c.iso ? (
            <button
              key={c.key}
              aria-label={c.iso}
              aria-pressed={selected === c.iso}
              onClick={() => setSelected(c.iso!)}
              style={{
                padding: '7px 0 9px',
                position: 'relative',
                borderRadius: 8,
                background: selected === c.iso && c.iso !== today ? 'var(--accent-tint)' : 'none',
                // Today gets the accent outline + bold (canvas day 13).
                border: c.iso === today ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                fontWeight: c.iso === today || selected === c.iso ? 700 : 400,
                fontSize: 12,
                color: 'var(--ink)',
              }}
            >
              {c.label}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 2,
                  display: 'flex',
                  gap: 2,
                  justifyContent: 'center',
                }}
              >
                {planDates.has(c.iso) && <i style={ring5} />}
                {madeDates.has(c.iso) && <i style={dot5} />}
              </span>
            </button>
          ) : (
            <span key={c.key} style={{ padding: '7px 0 9px', fontSize: 12, color: 'var(--ink-disabled)' }}>
              {c.label}
            </span>
          ),
        )}
      </div>

      <DayDetail iso={selected} onOpenRecipe={setOpenRecipeId} onOpenPlan={onOpenPlan} />
      {openRecipeId && <RecipeCardSheet recipeId={openRecipeId} onClose={() => setOpenRecipeId(null)} />}
    </section>
  );
}

function DayDetail({
  iso,
  onOpenRecipe,
  onOpenPlan,
}: {
  iso: string;
  onOpenRecipe: (recipeId: string) => void;
  onOpenPlan: (planId: string) => void;
}) {
  const plans = store.plans.filter((p) => p.acceptedAt === iso);
  const entries = store.madeEntries.filter((e) => e.date === iso);
  const header = fromISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const line: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 };

  return (
    <div style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 9 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 6,
        }}
      >
        {header} — selected
      </div>
      {plans.map((p) => {
        const open = p.items.filter((i) => i.state === 'open').length;
        return (
          // Tappable (round-1 amendment 4c): jumps to this plan in List view.
          <button key={p.id} onClick={() => onOpenPlan(p.id)} style={{ ...line, width: '100%', textAlign: 'left' }}>
            <i aria-hidden style={ring8} />
            <span style={{ flex: 1 }}>
              Plan accepted · {p.items.length} recipes{open > 0 ? `, ${open} still open` : ''}
            </span>
            <span aria-hidden style={{ color: 'var(--ink-soft)', fontSize: 15 }}>›</span>
          </button>
        );
      })}
      {entries.map((e) => {
        const recipe = e.recipeId !== null ? store.recipes.find((r) => r.id === e.recipeId) : undefined;
        const orphaned = e.recipeId === null;
        const name = recipe?.name ?? e.orphan?.recipeName ?? 'Unknown recipe';
        const body = (
          <>
            {name} made
            {e.rating !== undefined && (
              <>
                {' · '}
                <b style={{ color: 'var(--gold)' }}>★ {displayRating(e.rating, store.settings.ratingScale)}</b>
              </>
            )}
            {orphaned && e.orphan && (
              <small style={{ color: 'var(--ink-soft)' }}> — {e.orphan.bookTitle}</small>
            )}
          </>
        );
        return (
          <div key={e.id} style={line}>
            <i aria-hidden style={orphaned ? dotNeutral8 : dot8} />
            {/* Live entries open the universal recipe card (Task 22);
                orphaned ones have no recipe to open. */}
            {recipe ? (
              <button
                onClick={() => onOpenRecipe(recipe.id)}
                style={{ flex: 1, textAlign: 'left', fontSize: 13 }}
              >
                {body}
              </button>
            ) : (
              <span style={{ flex: 1 }}>{body}</span>
            )}
          </div>
        );
      })}
      {plans.length === 0 && entries.length === 0 && (
        <div className="meta">Nothing planned or made this day.</div>
      )}
    </div>
  );
}
