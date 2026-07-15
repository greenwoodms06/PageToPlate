// Add-to-plan dialog (plan Task 22; spec rule 10): pick an existing open plan
// or start a new MANUAL plan. Manual plans carry NO genContext on purpose —
// Swap on such a plan draws from the same category across all active books
// (see PlanCard.swap), because there was never a generation session whose
// books/filters could be re-used.
import { store, useStore } from '../../data/store';
import { newId, todayISO } from '../../data/types';
import type { Plan } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { monthDayLong } from '../../logic/dates';

export function AddToPlanDialog({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const showToast = useToast();
  useStore((s) => s.version);
  const recipe = store.recipes.find((r) => r.id === recipeId);

  // "Open plans" = plans with at least one open item, newest first.
  const openPlans = store.plans
    .filter((p) => p.items.some((i) => i.state === 'open'))
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));

  const addTo = (plan: Plan) => {
    const prior = plan.items;
    void store.updatePlan(plan.id, { items: [...prior, { recipeId, state: 'open' as const }] });
    showToast(`Added to plan · ${monthDayLong(plan.acceptedAt)}`, () =>
      void store.updatePlan(plan.id, { items: prior }),
    );
    onClose();
  };

  const newPlan = () => {
    const id = newId();
    void store.addPlan({ id, acceptedAt: todayISO(), items: [{ recipeId, state: 'open' }] });
    showToast('New plan created', () => void store.deletePlan(id));
    onClose();
  };

  return (
    <Dialog open onClose={onClose} label="Add to plan">
      <div className="screen-title" style={{ fontSize: 21 }}>Add to plan</div>
      <p className="meta" style={{ margin: '4px 0 14px' }}>{recipe?.name}</p>

      {openPlans.map((p) => {
        const open = p.items.filter((i) => i.state === 'open').length;
        return (
          <button
            key={p.id}
            onClick={() => addTo(p)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-card)',
              padding: '11px 13px',
              marginBottom: 8,
            }}
          >
            <b style={{ fontSize: 14 }}>Planned {monthDayLong(p.acceptedAt)}</b>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              {open} open recipe{open === 1 ? '' : 's'} · add to this plan
            </span>
          </button>
        );
      })}
      {openPlans.length === 0 && (
        <p className="meta" style={{ marginBottom: 10 }}>No open plans — start a new one.</p>
      )}

      <button
        onClick={newPlan}
        style={{
          width: '100%',
          minHeight: 48,
          border: '1.5px solid var(--accent)',
          background: 'none',
          color: 'var(--accent)',
          borderRadius: 'var(--r-cta)',
          fontSize: 14,
          fontWeight: 700,
          marginTop: 4,
        }}
      >
        + New plan
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', marginTop: 4 }}
      >
        Cancel
      </button>
    </Dialog>
  );
}
