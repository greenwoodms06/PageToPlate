// Generate step 2 — categories & filters (plan Task 15; canvas 2b;
// screenshot 04). Rows are data-driven from store categories (11 defaults +
// customs, ordered). Availability recomputes on every render — i.e. every
// keystroke/pill change — scoped to the selected books and that category.
import { useState } from 'react';
import type { Dispatch } from 'react';
import { useToast } from '../../components/Toast';
import { Dialog } from '../../components/Dialog';
import { PillEditor } from '../../components/PillEditor';
import { Stepper } from '../../components/Stepper';
import { availability } from '../../logic/generate';
import type { Candidate } from '../../logic/generate';
import { store } from '../../data/store';
import { newId } from '../../data/types';
import type { Category, Cookbook } from '../../data/types';
import { GhostBtn, PrimaryCta } from './wizardUi';
import { cfgFor } from './wizardState';
import type { WizardAction, WizardState } from './wizardState';

// Prototype caps a category count at 9 (`Math.min(9, count + 1)`).
const MAX_COUNT = 9;

export function CategoriesStep({
  state,
  categories,
  candidates,
  books,
  onGenerate,
  dispatch,
}: {
  state: WizardState;
  categories: Category[];
  candidates: Candidate[];
  books: Cookbook[];
  onGenerate: () => void;
  dispatch: Dispatch<WizardAction>;
}) {
  const showToast = useToast();
  const [presetDialog, setPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const total = categories.reduce((n, c) => n + cfgFor(state.cfg, c.name).count, 0);

  return (
    <div>
      <h1 className="screen-title">What are we making?</h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 12px' }}>
        Set a count per category. Filters apply only to their category.
      </div>

      {categories.map((cat) => {
        const cfg = cfgFor(state.cfg, cat.name);
        const active = cfg.count > 0;
        const expanded = state.open === cat.name;
        const hasPills = cfg.pills.length > 0;
        const avail = availability(candidates, books, state.sel, cat.name, cfg.pills);
        return (
          <div
            key={cat.id}
            data-category={cat.name}
            style={{
              background: 'var(--card)',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
              borderRadius: 'var(--r-card)',
              marginBottom: 9,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 12px' }}>
              <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{cat.name}</span>
              <span
                data-testid="availability"
                style={{
                  fontSize: 11.5,
                  color: hasPills ? 'var(--accent)' : 'var(--ink-soft)',
                  fontWeight: hasPills ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {avail} {hasPills ? 'match' : 'available'}
              </span>
              <Stepper
                value={cfg.count}
                onInc={() =>
                  dispatch({ type: 'setCount', cat: cat.name, count: Math.min(MAX_COUNT, cfg.count + 1) })
                }
                onDec={() => dispatch({ type: 'setCount', cat: cat.name, count: Math.max(0, cfg.count - 1) })}
              />
              <button
                aria-label={`Filters for ${cat.name}`}
                aria-expanded={expanded}
                onClick={() => dispatch({ type: 'setOpen', cat: expanded ? null : cat.name })}
                style={{
                  border: '1.5px solid var(--line)',
                  background: 'none',
                  borderRadius: 'var(--r-pill)',
                  width: 36,
                  height: 36,
                  flex: 'none',
                  fontSize: 14,
                  color: hasPills ? 'var(--accent)' : 'var(--ink-soft)',
                }}
              >
                ⚲
                {hasPills && (
                  <span
                    style={{
                      position: 'absolute',
                      margin: '-4px 0 0 -3px',
                      fontSize: 9,
                      background: 'var(--accent)',
                      color: 'var(--on-accent)',
                      borderRadius: '50%',
                      width: 13,
                      height: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {cfg.pills.length}
                  </span>
                )}
              </button>
            </div>
            {expanded && (
              <div style={{ borderTop: '1.5px dashed var(--line)', padding: '10px 12px 12px', background: 'var(--panel)' }}>
                <PillEditor
                  pills={cfg.pills}
                  chips={cat.chips}
                  onChange={(pills) => dispatch({ type: 'setPills', cat: cat.name, pills })}
                />
                <div className="hint" style={{ marginTop: 6 }}>
                  Tap a pill to flip include ↔ not. Filters match recipe names and tags.
                </div>
              </div>
            )}
          </div>
        );
      })}

      <PrimaryCta
        label={total > 0 ? `Generate ${total} recipe${total > 1 ? 's' : ''} →` : 'Set at least one count'}
        disabled={total === 0}
        onClick={onGenerate}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <GhostBtn label="← Books" onClick={() => dispatch({ type: 'setStep', step: 1 })} style={{ flex: 1 }} />
        <GhostBtn
          label="Save as preset"
          onClick={() => {
            setPresetName('');
            setPresetDialog(true);
          }}
          style={{ flex: 1 }}
        />
      </div>

      <Dialog open={presetDialog} onClose={() => setPresetDialog(false)} label="Save as preset">
        <div className="screen-title" style={{ fontSize: 21 }}>Save as preset</div>
        <p className="meta" style={{ margin: '6px 0 12px' }}>
          Saves these books and category filters for one-tap reuse.
        </p>
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name"
          aria-label="Preset name"
          style={{
            width: '100%',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-inner)',
            padding: '10px 12px',
            fontSize: 14,
            background: 'var(--card)',
            marginBottom: 12,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPresetDialog(false)}
            style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-mid)' }}
          >
            Cancel
          </button>
          <button
            disabled={presetName.trim() === ''}
            onClick={() => {
              void store.savePreset({
                id: newId(),
                name: presetName.trim(),
                bookIds: [...state.sel],
                config: structuredClone(state.cfg),
              });
              setPresetDialog(false);
              showToast('Preset saved');
            }}
            style={{
              flex: 1,
              minHeight: 44,
              background: presetName.trim() === '' ? 'var(--accent-disabled)' : 'var(--accent)',
              color: 'var(--on-accent)',
              borderRadius: 'var(--r-cta)',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Save
          </button>
        </div>
      </Dialog>
    </div>
  );
}
