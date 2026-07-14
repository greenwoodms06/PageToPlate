// Generate step 4 — plan created (plan Task 17; prototype step 4). Rows open
// the universal recipe card once Task 22 lands; until then a placeholder
// toast, exactly like the prototype. "Generate another" keeps books+filters
// (wizardReducer 'generateAnother').
import type { Dispatch } from 'react';
import { RecipeRow, RowList } from '../../components/RecipeRow';
import { useToast } from '../../components/Toast';
import { spineColor } from '../../components/spine';
import type { Cookbook } from '../../data/types';
import { GhostBtn, PrimaryCta } from './wizardUi';
import type { WizardAction, WizardState } from './wizardState';

export function PlanCreated({
  state,
  books,
  dispatch,
}: {
  state: WizardState;
  books: Cookbook[];
  dispatch: Dispatch<WizardAction>;
}) {
  const showToast = useToast();
  const kept = (state.groups ?? []).flatMap((g) => g.cards.filter((c) => c.status === 'kept'));
  const bookName = (id: string) => books.find((b) => b.id === id)?.name ?? '?';

  // 'Planned July 14' — from the plan's acceptedAt (Rule 4: dated by acceptance).
  const date = state.plannedAt
    ? new Date(`${state.plannedAt}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--accent-tint)',
          border: '2px solid var(--accent)',
          color: 'var(--accent)',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        ✓
      </div>
      <h1 className="screen-title">Plan created</h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 18px' }}>
        Planned {date} · {kept.length} recipe{kept.length === 1 ? '' : 's'}
      </div>
      <div style={{ textAlign: 'left' }}>
        <RowList>
          {kept.map((c) => (
            <RecipeRow
              key={c.recipe.id}
              name={c.recipe.name}
              meta={`${bookName(c.recipe.bookId)} · p. ${c.recipe.page}`}
              color={spineColor(state.sel.indexOf(c.recipe.bookId))}
              chevron
              onClick={() => showToast('Opens the universal recipe card')}
            />
          ))}
        </RowList>
      </div>
      <PrimaryCta
        label="View plan in Plans →"
        onClick={() => {
          window.location.hash = '#/plans';
        }}
        marginTop={12}
      />
      <GhostBtn
        label="Generate another"
        onClick={() => dispatch({ type: 'generateAnother' })}
        minHeight={46}
        style={{ marginTop: 8 }}
      />
      <div className="hint" style={{ marginTop: 10 }}>
        Your books and filters are remembered.
      </div>
    </div>
  );
}
