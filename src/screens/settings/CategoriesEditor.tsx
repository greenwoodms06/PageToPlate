// Categories editor (plan Task 26 Step 2). List in store order with recipe
// counts; add (order appended last, isDefault false, no chips); rename via ✎
// (updates the category AND every recipe's category string — recipes reference
// categories by name); delete via a reassign-then-confirm dialog (default
// target Uncategorized — a virtual fallback string, not a Category row, which
// deleteCategoryReassign handles fine since it only writes the string).
// Default categories are deletable too (spec allows) but get a warning line.
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { UNCATEGORIZED } from '../../data/categories';
import { store, useStore } from '../../data/store';
import { newId } from '../../data/types';
import type { Category } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { WarningNote } from '../../components/WarningNote';
import { Card, SettingsHeader } from './settingsUi';

type DialogState =
  | { mode: 'add' }
  | { mode: 'rename'; cat: Category }
  | { mode: 'delete'; cat: Category }
  | null;

export function CategoriesEditor() {
  const categories = useStore((s) => s.categories);
  const recipes = useStore((s) => s.recipes);
  const showToast = useToast();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState(UNCATEGORIZED);

  const countFor = (name: string) => recipes.filter((r) => r.category === name).length;

  const nameTaken = (name: string, exceptId?: string) =>
    name.toLowerCase() === UNCATEGORIZED.toLowerCase() ||
    categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());

  const addCategory = () => {
    const name = draft.trim();
    if (!name || nameTaken(name)) return;
    const order = categories.length === 0 ? 0 : Math.max(...categories.map((c) => c.order)) + 1;
    void store.addCategory({ id: newId(), name, order, isDefault: false, chips: [] });
    setDialog(null);
    showToast(`Added “${name}”`);
  };

  const renameCategory = async (cat: Category) => {
    const name = draft.trim();
    setDialog(null);
    if (!name || name === cat.name || nameTaken(name, cat.id)) return;
    const oldName = cat.name;
    const rename = async (from: string, to: string) => {
      await store.updateCategory(cat.id, { name: to });
      // The store has no rename helper, and per-recipe updateRecipe would
      // notify + write settings once per recipe. addRecipes is an upsert
      // (Map.set + one bulkPut + ONE bump), so the whole rename costs two
      // notifies. Presets/plans that referenced the old name keep the old
      // string — their config for it simply stops matching, same as deletion.
      const moved = store.recipes.filter((r) => r.category === from).map((r) => ({ ...r, category: to }));
      if (moved.length > 0) await store.addRecipes(moved);
    };
    await rename(oldName, name);
    showToast(`Renamed to “${name}”`, () => void rename(name, oldName));
  };

  const deleteCategory = (cat: Category) => {
    setDialog(null);
    void store.deleteCategoryReassign(cat.id, target);
    // No Undo: recreating the category is easy, but un-reassigning N recipes
    // is not — deletion sits behind this confirm dialog instead (UX Safeguards).
    showToast(`Deleted “${cat.name}”`);
  };

  const iconBtn = {
    width: 36,
    height: 36,
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    border: '1.5px solid var(--line)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--ink-soft)',
  } as const;

  return (
    <main style={{ padding: '20px 16px 24px' }}>
      <SettingsHeader title="Categories" sub="Categories group recipes in generation and browse." />

      <Card>
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderBottom: i === categories.length - 1 ? 'none' : '1px dashed var(--line)',
              minHeight: 52,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontWeight: 600, fontSize: 14.5 }}>{cat.name}</b>
              {!cat.isDefault && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 'var(--r-tag)',
                    background: 'var(--rejected-fill)',
                    color: 'var(--ink-soft)',
                    marginLeft: 6,
                  }}
                >
                  custom
                </span>
              )}
              <br />
              <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                {countFor(cat.name)} recipe{countFor(cat.name) === 1 ? '' : 's'}
              </small>
            </span>
            <button
              aria-label={`Rename ${cat.name}`}
              onClick={() => {
                setDraft(cat.name);
                setDialog({ mode: 'rename', cat });
              }}
              style={iconBtn}
            >
              <Pencil size={14} />
            </button>
            <button
              aria-label={`Delete ${cat.name}`}
              onClick={() => {
                setTarget(UNCATEGORIZED);
                setDialog({ mode: 'delete', cat });
              }}
              style={{ ...iconBtn, color: 'var(--danger)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </Card>

      <button
        onClick={() => {
          setDraft('');
          setDialog({ mode: 'add' });
        }}
        style={{
          width: '100%',
          minHeight: 48,
          marginTop: 10,
          border: '1.5px dashed var(--dash)',
          borderRadius: 'var(--r-card)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink-soft)',
        }}
      >
        + Add category
      </button>

      {/* add / rename dialog */}
      <Dialog
        open={dialog?.mode === 'add' || dialog?.mode === 'rename'}
        onClose={() => setDialog(null)}
        label={dialog?.mode === 'add' ? 'Add category' : 'Rename category'}
      >
        <div className="screen-title" style={{ fontSize: 21 }}>
          {dialog?.mode === 'add' ? 'Add category' : `Rename ${dialog?.mode === 'rename' ? dialog.cat.name : ''}`}
        </div>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (dialog?.mode === 'add') addCategory();
            else if (dialog?.mode === 'rename') void renameCategory(dialog.cat);
          }}
          placeholder="Category name"
          aria-label="Category name"
          style={{
            width: '100%',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-inner)',
            padding: '10px 12px',
            fontSize: 14,
            background: 'var(--card)',
            margin: '12px 0 4px',
          }}
        />
        {draft.trim() !== '' && nameTaken(draft.trim(), dialog?.mode === 'rename' ? dialog.cat.id : undefined) && (
          <div style={{ fontSize: 12, color: 'var(--danger)' }}>That name is already in use.</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              if (dialog?.mode === 'add') addCategory();
              else if (dialog?.mode === 'rename') void renameCategory(dialog.cat);
            }}
            disabled={draft.trim() === ''}
            style={{
              flex: 1,
              minHeight: 44,
              background: draft.trim() === '' ? 'var(--accent-disabled)' : 'var(--accent)',
              color: 'var(--on-accent)',
              borderRadius: 'var(--r-cta)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {dialog?.mode === 'add' ? 'Add' : 'Rename'}
          </button>
          <button
            onClick={() => setDialog(null)}
            style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
          >
            Cancel
          </button>
        </div>
      </Dialog>

      {/* delete dialog */}
      <Dialog
        open={dialog?.mode === 'delete'}
        onClose={() => setDialog(null)}
        label="Delete category"
      >
        {dialog?.mode === 'delete' && (
          <>
            <div className="screen-title" style={{ fontSize: 21 }}>Delete “{dialog.cat.name}”?</div>
            {dialog.cat.isDefault && (
              <div style={{ marginTop: 10 }}>
                <WarningNote>
                  This is a built-in category — deleting it also removes its filter chips.
                </WarningNote>
              </div>
            )}
            {countFor(dialog.cat.name) > 0 ? (
              <>
                <p style={{ fontSize: 13.5, color: 'var(--ink-mid)', margin: '10px 0 6px' }}>
                  Reassign {countFor(dialog.cat.name)} recipe{countFor(dialog.cat.name) === 1 ? '' : 's'} to:
                </p>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="Reassign recipes to"
                  style={{
                    width: '100%',
                    border: '1.5px solid var(--line)',
                    borderRadius: 'var(--r-inner)',
                    padding: '10px 12px',
                    fontSize: 14,
                    background: 'var(--card)',
                  }}
                >
                  <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
                  {categories
                    .filter((c) => c.id !== dialog.cat.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--ink-mid)', margin: '10px 0 0' }}>
                No recipes use this category.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => deleteCategory(dialog.cat)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: 'var(--r-cta)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Delete category
              </button>
              <button
                onClick={() => setDialog(null)}
                style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </Dialog>
    </main>
  );
}
