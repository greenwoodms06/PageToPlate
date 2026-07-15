// One plan card (plan Task 19; canvas 2c, dark 3d): uppercase "PLANNED
// JULY 11 · 3 RECIPES" header + Share ↗, per-recipe rows with 5×28 stripes
// colored by position-in-plan, per-item actions (Made ✓ / Swap / Dismiss),
// dismissed rows dimmed with inline undo, all-done plans collapsed at 75%
// opacity until tapped.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { store } from '../../data/store';
import { useToast } from '../../components/Toast';
import { spineColor } from '../../components/spine';
import { eligible, pick } from '../../logic/generate';
import type { Candidate } from '../../logic/generate';
import type { Plan, PlanItem, Recipe } from '../../data/types';
import { monthDayLong } from '../../logic/dates';

const card: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-card)',
  padding: '13px 14px',
  marginBottom: 11,
};

const headerStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft)',
};

const pill: CSSProperties = {
  borderRadius: 'var(--r-pill)',
  padding: '8px 13px',
  fontSize: 12,
  fontWeight: 700,
  minHeight: 36,
  flex: 'none',
};

export function PlanCard({
  plan,
  onMarkMade,
  onEditEntry,
  onOpenRecipe,
}: {
  plan: Plan;
  /** Open the mark-as-made dialog for an open item (caller passes this plan's id). */
  onMarkMade: (recipeId: string) => void;
  /** Open the dialog in edit mode for a made item's entry. */
  onEditEntry: (recipeId: string, madeEntryId: string) => void;
  /** Row body tap → universal recipe card (Task 22); action buttons keep their own handlers. */
  onOpenRecipe: (recipeId: string) => void;
}) {
  const showToast = useToast();
  const [expandedDone, setExpandedDone] = useState(false);

  const recipeById = (id: string) => store.recipes.find((r) => r.id === id);
  const bookNameOf = (r?: Recipe) => store.books.find((b) => b.id === r?.bookId)?.name ?? 'Unknown book';

  const allDone = plan.items.length > 0 && plan.items.every((i) => i.state !== 'open');
  const header = `Planned ${monthDayLong(plan.acceptedAt)}`;

  const setItem = (index: number, next: PlanItem) => {
    void store.updatePlan(plan.id, { items: plan.items.map((it, i) => (i === index ? next : it)) });
  };

  const dismiss = (index: number) => {
    const priorItems = plan.items;
    setItem(index, { ...priorItems[index], state: 'dismissed' });
    showToast('Recipe dismissed', () => void store.updatePlan(plan.id, { items: priorItems }));
  };

  const swap = (index: number) => {
    const cur = recipeById(plan.items[index].recipeId);
    if (!cur) return;
    const candidates: Candidate[] = store.recipes.map((r) => ({
      ...r,
      madeCount: store.madeCountFor(r.id),
      lastMade: store.lastMadeFor(r.id),
    }));
    // Generated plans re-pick from the SAME pool the wizard used (genContext
    // snapshot: its books + that category's pills); manual plans (no
    // genContext) draw from the same category across all active books.
    const bookIds = plan.genContext?.bookIds ?? store.books.filter((b) => !b.archived).map((b) => b.id);
    const pills = plan.genContext?.config[cur.category]?.pills ?? [];
    const inPlan = new Set(plan.items.map((i) => i.recipeId));
    const pool = eligible(candidates, store.books, bookIds, cur.category, pills).filter((r) => !inPlan.has(r.id));
    const [next] = pick(pool, 1, store.settings.preferUnmade);
    if (!next) {
      showToast('No more matches to swap in.');
      return;
    }
    setItem(index, { recipeId: next.id, state: 'open' });
    showToast(`Swapped in ${next.name}`);
  };

  const share = async () => {
    const lines = plan.items
      .filter((i) => i.state !== 'dismissed')
      .map((i) => {
        const r = recipeById(i.recipeId);
        return `- ${r?.name ?? 'Removed recipe'} (${bookNameOf(r)} p. ${r?.page ?? '?'})`;
      });
    const text = `This week's menu:\n${lines.join('\n')}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User closed the share sheet — nothing to do.
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Menu copied to clipboard');
    }
  };

  // "Older plans" (canvas 2c): every item made/dismissed → collapse until tapped.
  if (allDone && !expandedDone) {
    return (
      <button
        onClick={() => setExpandedDone(true)}
        style={{ ...card, opacity: 0.75, width: '100%', textAlign: 'left', display: 'block' }}
      >
        <div style={headerStyle}>{header}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-mid)', marginTop: 4 }}>
          {plan.items.length} recipes · all done
        </div>
      </button>
    );
  }

  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={headerStyle}>
          {header} · {plan.items.length} recipes
        </div>
        <button
          onClick={() => void share()}
          style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', padding: '2px 0 2px 8px', flex: 'none' }}
        >
          Share ↗
        </button>
      </div>

      {plan.items.map((item, i) => {
        const recipe = recipeById(item.recipeId);
        const entry = item.madeEntryId ? store.madeEntries.find((m) => m.id === item.madeEntryId) : undefined;
        const dismissed = item.state === 'dismissed';
        return (
          <div
            key={`${item.recipeId}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 0',
              borderBottom: i === plan.items.length - 1 ? 'none' : '1px dashed var(--line)',
              opacity: dismissed ? 0.55 : 1,
            }}
          >
            <i
              aria-hidden
              style={{
                display: 'inline-block',
                width: 5,
                height: 28,
                borderRadius: 2,
                background: spineColor(i),
                flex: 'none',
              }}
            />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              {/* Name + meta are the tap target for the universal recipe
                  card; Made/Swap/Dismiss stay separate buttons (Task 22). */}
              <button
                onClick={() => recipe && onOpenRecipe(recipe.id)}
                disabled={!recipe}
                style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 14, cursor: recipe ? 'pointer' : 'default' }}
              >
                <span style={{ textDecoration: dismissed ? 'line-through' : 'none' }}>
                  {recipe?.name ?? 'Removed recipe'}
                </span>
                <br />
                <small style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>
                  {bookNameOf(recipe)} · p. {recipe?.page ?? '?'}
                </small>
              </button>
              {item.state === 'open' && recipe && (
                <span style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                  <button
                    onClick={() => swap(i)}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', padding: '3px 0' }}
                  >
                    Swap
                  </button>
                  <button
                    onClick={() => dismiss(i)}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', padding: '3px 0' }}
                  >
                    Dismiss
                  </button>
                </span>
              )}
            </span>
            {item.state === 'open' && recipe && (
              <button
                onClick={() => onMarkMade(item.recipeId)}
                style={{ ...pill, border: '1.5px solid var(--accent)', color: 'var(--accent)', background: 'none' }}
              >
                Made ✓
              </button>
            )}
            {item.state === 'made' && (
              <button
                onClick={() => item.madeEntryId && onEditEntry(item.recipeId, item.madeEntryId)}
                style={{ ...pill, background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {entry?.rating !== undefined ? `Made · ${entry.rating}/10` : 'Made ✓'}
              </button>
            )}
            {dismissed && (
              <button
                onClick={() => setItem(i, { ...item, state: 'open' })}
                style={{ ...pill, border: '1.5px solid var(--line)', color: 'var(--ink-soft)', background: 'none', fontWeight: 600 }}
              >
                Dismissed — undo
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
