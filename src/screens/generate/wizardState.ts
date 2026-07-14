// Wizard session state (plan Milestone D intro; prototype `state`).
//
// DECISION (Task 14): the reducer runs in GenerateTab via useReducer, but every
// state change is mirrored into a module-level slot (saveWizard/loadWizard).
// App.tsx renders one screen per hash route, so GenerateTab UNMOUNTS on every
// tab switch — component state alone would lose the session, and the handoff
// requires "Back navigation preserves all selections". A module singleton is
// the smallest thing that survives tab switches; it deliberately does NOT
// survive reloads — book colors and picks are session-scoped by design
// (handoff signature rule: colors are "never permanently bound to books").
import type { CatConfig, Pill } from '../../data/types';
import type { GenGroup } from '../../logic/generate';

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  /** Ordered book ids — tap order IS color order (spineColor(sel.indexOf(id))). */
  sel: string[];
  /** Per-category config, keyed by category NAME (matches Preset/Plan genContext). */
  cfg: Record<string, CatConfig>;
  /** Category name whose filter panel is expanded on step 2. */
  open: string | null;
  groups: GenGroup[] | null;
  /** Recipe ids rejected this session — regenerate() never re-picks these. */
  sessionRejected: Set<string>;
  /** acceptedAt of the plan just created; only meaningful on step 4. */
  plannedAt: string | null;
}

export type WizardAction =
  | { type: 'toggleBook'; id: string }
  | { type: 'applyPreset'; bookIds: string[]; config: Record<string, CatConfig> }
  | { type: 'setStep'; step: 1 | 2 | 3 }
  | { type: 'setCount'; cat: string; count: number }
  | { type: 'setPills'; cat: string; pills: Pill[] }
  | { type: 'setOpen'; cat: string | null }
  | { type: 'setGroups'; groups: GenGroup[] }
  | { type: 'regenerated'; groups: GenGroup[]; sessionRejected: Set<string> }
  | { type: 'setCardStatus'; recipeId: string; status: 'kept' | 'rejected' | 'never' }
  | { type: 'planned'; plannedAt: string }
  | { type: 'generateAnother' };

export const cfgFor = (cfg: Record<string, CatConfig>, cat: string): CatConfig =>
  cfg[cat] ?? { count: 0, pills: [] };

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'toggleBook':
      // Prototype `toggle`: select appends (next color slot), deselect splices
      // — the remaining books' colors reflow to their new order index.
      return {
        ...s,
        sel: s.sel.includes(a.id) ? s.sel.filter((x) => x !== a.id) : [...s.sel, a.id],
      };
    case 'applyPreset':
      return { ...s, sel: [...a.bookIds], cfg: structuredClone(a.config) };
    case 'setStep':
      return { ...s, step: a.step };
    case 'setCount':
      return { ...s, cfg: { ...s.cfg, [a.cat]: { ...cfgFor(s.cfg, a.cat), count: a.count } } };
    case 'setPills':
      return { ...s, cfg: { ...s.cfg, [a.cat]: { ...cfgFor(s.cfg, a.cat), pills: a.pills } } };
    case 'setOpen':
      return { ...s, open: a.cat };
    case 'setGroups':
      return { ...s, groups: a.groups, step: 3 };
    case 'regenerated':
      return { ...s, groups: a.groups, sessionRejected: a.sessionRejected };
    case 'setCardStatus':
      return {
        ...s,
        groups: (s.groups ?? []).map((g) => ({
          ...g,
          cards: g.cards.map((c) => (c.recipe.id === a.recipeId ? { ...c, status: a.status } : c)),
        })),
      };
    case 'planned':
      return { ...s, step: 4, plannedAt: a.plannedAt };
    case 'generateAnother':
      // Prototype `startOver` + handoff: "'Generate another' keeps books/filters".
      return { ...s, step: 1, groups: null, sessionRejected: new Set(), plannedAt: null, open: null };
  }
}

export const initialWizard = (): WizardState => ({
  step: 1,
  sel: [],
  cfg: {},
  open: null,
  groups: null,
  sessionRejected: new Set(),
  plannedAt: null,
});

let saved: WizardState | null = null;
export const loadWizard = (): WizardState => saved ?? initialWizard();
export const saveWizard = (s: WizardState): void => {
  saved = s;
};
/** Test/dev hook: forget the session (a fresh GenerateTab mounts pristine). */
export const resetWizard = (): void => {
  saved = null;
};
