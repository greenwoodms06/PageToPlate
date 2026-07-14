// Generate step 3 — results (plan Task 16; canvas 1a; screenshots 01/02;
// prototype step 3). Keep/Reject/Never state styling is ported verbatim from
// the prototype's renderVals: kept = ✓ + accent tint; rejected = "✕ Rejected
// — undo" on --rejected-fill with the card struck at 55% opacity; never =
// "Never — undo" danger tint. Reject is session-only; Never persists
// (recipe status 'excluded') and offers undo both via toast and by tapping
// the button again.
import type { Dispatch } from 'react';
import { PageTab } from '../../components/PageTab';
import { SpineStripe } from '../../components/SpineStripe';
import { WarningNote } from '../../components/WarningNote';
import { useToast } from '../../components/Toast';
import { spineColor } from '../../components/spine';
import { store } from '../../data/store';
import type { Cookbook } from '../../data/types';
import { GhostBtn, PrimaryCta } from './wizardUi';
import type { WizardAction, WizardState } from './wizardState';

export function ResultsStep({
  state,
  books,
  onRegenerate,
  onPlanThese,
  dispatch,
}: {
  state: WizardState;
  books: Cookbook[];
  /** Adds current rejections to sessionRejected, replaces only those cards. */
  onRegenerate: () => void;
  onPlanThese: () => void;
  dispatch: Dispatch<WizardAction>;
}) {
  const showToast = useToast();
  const groups = state.groups ?? [];
  const bookName = (id: string) => books.find((b) => b.id === id)?.name ?? '?';
  const bookColor = (id: string) => spineColor(state.sel.indexOf(id));

  const allCards = groups.flatMap((g) => g.cards);
  const rejectedCount = allCards.filter((c) => c.status === 'rejected').length;
  const keptCount = allCards.filter((c) => c.status === 'kept').length;

  const setStatus = (recipeId: string, status: 'kept' | 'rejected' | 'never') =>
    dispatch({ type: 'setCardStatus', recipeId, status });

  return (
    <div>
      <h1 className="screen-title">Your picks</h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 12px' }}>
        Reject any you don’t fancy, then regenerate to replace them.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        {state.sel.map((id, i) => (
          <div
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-mid)' }}
          >
            <i
              aria-hidden
              style={{
                width: 11,
                height: 16,
                borderRadius: 2,
                background: spineColor(i),
                boxShadow: 'inset -2px 0 0 rgba(0,0,0,.18)',
              }}
            />
            {bookName(id)}
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.category}>
          <div
            className="section-label"
            style={{ color: 'var(--ink-soft)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {g.category} <span style={{ flex: 1, height: 1, background: 'var(--dash)' }} />{' '}
            {g.cards.filter((c) => c.status === 'kept').length} of {g.want}
          </div>
          {g.note && (
            <div style={{ marginBottom: 10 }}>
              <WarningNote>{g.note}</WarningNote>
            </div>
          )}
          {g.cards.map((c) => {
            const r = c.recipe;
            const struck = c.status === 'rejected' || c.status === 'never';
            const rejected = c.status === 'rejected';
            const never = c.status === 'never';
            const color = bookColor(r.bookId);
            return (
              <div
                key={r.id}
                data-recipe-id={r.id}
                data-status={c.status}
                className={struck ? undefined : 'index-ruling'}
                style={{
                  // backgroundColor, NOT the background shorthand — the
                  // shorthand would wipe out .index-ruling's background-image.
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-card)',
                  padding: '14px 14px 12px 20px',
                  marginBottom: 10,
                  position: 'relative',
                  opacity: struck ? 0.55 : 1,
                  backgroundPosition: '0 46px', // ruling starts below the title
                }}
              >
                <SpineStripe color={color} />
                <PageTab color={color} page={r.page} />
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    paddingRight: 56,
                    textDecoration: struck ? 'line-through' : 'none',
                  }}
                >
                  {r.name}
                </div>
                <div className="meta" style={{ marginTop: 2 }}>
                  {bookName(r.bookId)}
                  {r.madeCount ? ` · made ${r.madeCount}×` : ' · never made'}
                  {rejected ? ' · rejected' : ''}
                  {never ? ' · never make' : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <button
                    onClick={() => {
                      // Keep on a never'd card must also undo the persisted
                      // exclusion — otherwise the card would read "kept" while
                      // the recipe stays excluded and unplannable. (The
                      // prototype misses this; deliberate divergence.)
                      if (never) void store.updateRecipe(r.id, { status: 'active' });
                      setStatus(r.id, 'kept');
                    }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      border: '1.5px solid var(--accent)',
                      color: 'var(--accent)',
                      background: c.status === 'kept' ? 'var(--accent-tint)' : 'transparent',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {c.status === 'kept' ? '✓ Keep' : 'Keep'}
                  </button>
                  <button
                    onClick={() => {
                      if (never) void store.updateRecipe(r.id, { status: 'active' });
                      setStatus(r.id, rejected ? 'kept' : 'rejected');
                    }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      border: `1.5px solid ${rejected ? 'var(--ink-mid)' : 'var(--dash)'}`,
                      color: rejected ? 'var(--ink)' : 'var(--ink-mid)',
                      background: rejected ? 'var(--rejected-fill)' : 'transparent',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 13,
                      fontWeight: rejected ? 700 : 600,
                    }}
                  >
                    {rejected ? '✕ Rejected — undo' : 'Reject'}
                  </button>
                  <button
                    onClick={() => {
                      if (never) {
                        // Tapping again undoes (prototype behavior).
                        void store.updateRecipe(r.id, { status: 'active' });
                        setStatus(r.id, 'kept');
                        return;
                      }
                      void store.updateRecipe(r.id, { status: 'excluded' });
                      setStatus(r.id, 'never');
                      showToast(`“${r.name}” marked never make`, () => {
                        void store.updateRecipe(r.id, { status: 'active' });
                        setStatus(r.id, 'kept');
                      });
                    }}
                    style={{
                      minHeight: 40,
                      padding: '0 13px',
                      border: `1.5px solid ${never ? 'var(--danger)' : 'var(--dash)'}`,
                      color: 'var(--danger)',
                      background: never ? 'var(--danger-tint)' : 'transparent',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 13,
                      fontWeight: never ? 700 : 600,
                    }}
                  >
                    {never ? 'Never — undo' : 'Never'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {rejectedCount > 0 && (
        <GhostBtn
          label={`↻ Regenerate ${rejectedCount} rejected`}
          onClick={onRegenerate}
          minHeight={48}
          fontSize={15}
          color="var(--ink)"
          style={{ marginTop: 6 }}
        />
      )}
      <PrimaryCta label={`Plan these ${keptCount} →`} disabled={keptCount === 0} onClick={onPlanThese} marginTop={8} />
      <GhostBtn
        label="← Back to filters"
        onClick={() => dispatch({ type: 'setStep', step: 2 })}
        style={{ marginTop: 8 }}
      />
    </div>
  );
}
