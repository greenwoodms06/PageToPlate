// Generate wizard — the hero flow (plan Milestone D, Tasks 14–17).
// Session state lives in a reducer here, mirrored to a module singleton so it
// survives tab switches (see wizardState.ts for the decision note).
import { useEffect, useMemo, useReducer } from 'react';
import { store, useStore } from '../../data/store';
import { useToast } from '../../components/Toast';
import { generate, regenerate } from '../../logic/generate';
import type { Candidate } from '../../logic/generate';
import type { CatConfig } from '../../data/types';
import { newId, todayISO } from '../../data/types';
import { WizardHeader } from './wizardUi';
import { BooksStep } from './BooksStep';
import { CategoriesStep } from './CategoriesStep';
import { ResultsStep } from './ResultsStep';
import { PlanCreated } from './PlanCreated';
import { cfgFor, loadWizard, saveWizard, wizardReducer } from './wizardState';

export function GenerateTab() {
  const [state, dispatch] = useReducer(wizardReducer, undefined, loadWizard);
  useEffect(() => saveWizard(state), [state]);
  const showToast = useToast();

  const version = useStore((s) => s.version); // re-render on any store change

  // Candidates = recipes joined with made stats — the shape generate()/
  // availability() consume. The store mutates in place, so its change counter
  // (`version`) is the real dependency; `void version` makes that legible to
  // exhaustive-deps.
  const candidates = useMemo<Candidate[]>(() => {
    void version;
    return store.recipes.map((r) => ({
      ...r,
      madeCount: store.madeCountFor(r.id),
      lastMade: store.lastMadeFor(r.id),
    }));
  }, [version]);

  const books = useMemo(() => {
    void version;
    return store.books.filter((b) => !b.archived);
  }, [version]);
  const hasOpenPlans = store.plans.some((p) => p.items.some((i) => i.state === 'open'));

  // "312 recipes · 41 made" — made counts distinct recipes cooked ≥1×.
  const bookMeta = (id: string) => {
    const rs = candidates.filter((r) => r.bookId === id);
    const made = rs.filter((r) => r.madeCount > 0).length;
    return `${rs.length.toLocaleString('en-US')} recipes · ${made} made`;
  };

  // cfg in category display order — generate() iterates config entries, so
  // this fixes result-group order to match the step-2 rows (prototype CATS).
  const orderedCfg = (): Record<string, CatConfig> => {
    const out: Record<string, CatConfig> = {};
    for (const c of store.categories) {
      const k = cfgFor(state.cfg, c.name);
      if (k.count > 0 || k.pills.length > 0) out[c.name] = k;
    }
    return out;
  };

  const onGenerate = () => {
    const groups = generate(candidates, books, state.sel, orderedCfg(), store.settings.preferUnmade);
    dispatch({ type: 'setGroups', groups });
  };

  // Prototype doRegenerate: current rejections join sessionRejected, then
  // regenerate() replaces ONLY the rejected cards (kept/never stay put).
  const onRegenerate = () => {
    if (!state.groups) return;
    const sessionRejected = new Set(state.sessionRejected);
    for (const g of state.groups)
      for (const c of g.cards) if (c.status === 'rejected') sessionRejected.add(c.recipe.id);
    const groups = regenerate(
      state.groups,
      candidates,
      books,
      state.sel,
      orderedCfg(),
      sessionRejected,
      store.settings.preferUnmade,
    );
    dispatch({ type: 'regenerated', groups, sessionRejected });
    showToast('Replaced rejected picks');
  };

  // Plan creation (Rule 4: plans are dated by ACCEPTANCE, not cooking).
  // genContext snapshots the books+filters so Plans-tab Swap (Task 19) can
  // re-pick from the same pool.
  const onPlanThese = () => {
    const kept = (state.groups ?? []).flatMap((g) => g.cards.filter((c) => c.status === 'kept'));
    if (kept.length === 0) return;
    const acceptedAt = todayISO();
    void store.addPlan({
      id: newId(),
      acceptedAt,
      items: kept.map((c) => ({ recipeId: c.recipe.id, state: 'open' as const })),
      genContext: { bookIds: [...state.sel], config: structuredClone(orderedCfg()) },
    });
    dispatch({ type: 'planned', plannedAt: acceptedAt });
  };

  return (
    <main style={{ padding: '20px 16px 96px' }}>
      <WizardHeader step={state.step} />
      {state.step === 1 && hasOpenPlans && <OpenPlansBanner />}
      {state.step === 1 && (
        <BooksStep
          books={books}
          sel={state.sel}
          presets={store.presets}
          bookMeta={bookMeta}
          dispatch={dispatch}
        />
      )}
      {state.step === 2 && (
        <CategoriesStep
          state={state}
          categories={store.categories}
          candidates={candidates}
          books={books}
          onGenerate={onGenerate}
          dispatch={dispatch}
        />
      )}
      {state.step === 3 && (
        <ResultsStep
          state={state}
          books={books}
          onRegenerate={onRegenerate}
          onPlanThese={onPlanThese}
          dispatch={dispatch}
        />
      )}
      {state.step === 4 && <PlanCreated state={state} books={books} dispatch={dispatch} />}
    </main>
  );
}

// "Plan status not yet updated · Plans →" (canvas 2a): shown while any plan
// still has open items — a nudge to go mark things made or dismissed.
function OpenPlansBanner() {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-card)',
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 13,
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <b>Plan status</b> not yet updated
      </span>
      <a
        href="#/plans"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--accent)',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
      >
        Plans →
      </a>
    </div>
  );
}
