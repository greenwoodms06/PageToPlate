// Saved presets editor (plan Task 26 Step 2): list each preset with a summary
// line ('2 books · Mains 2 chicken, not fried · Desserts 1'), rename via ✎,
// delete behind a confirm dialog with toast Undo (savePreset is an upsert, so
// Undo simply re-saves the deleted preset).
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { store, useStore } from '../../data/store';
import type { Preset } from '../../data/types';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { Card, SettingsHeader } from './settingsUi';

function summarize(preset: Preset): string {
  const parts = [`${preset.bookIds.length} book${preset.bookIds.length === 1 ? '' : 's'}`];
  for (const [cat, cfg] of Object.entries(preset.config)) {
    if (cfg.count === 0) continue;
    const pills = cfg.pills.map((p) => (p.neg ? `not ${p.text}` : p.text)).join(', ');
    parts.push(`${cat} ${cfg.count}${pills ? ` ${pills}` : ''}`);
  }
  return parts.join(' · ');
}

export function PresetsEditor() {
  const presets = useStore((s) => s.presets);
  const showToast = useToast();
  const [dialog, setDialog] = useState<{ mode: 'rename' | 'delete'; preset: Preset } | null>(null);
  const [draft, setDraft] = useState('');

  const rename = (preset: Preset) => {
    const name = draft.trim();
    setDialog(null);
    if (!name || name === preset.name) return;
    void store.savePreset({ ...preset, name });
    showToast(`Renamed to “${name}”`, () => void store.savePreset(preset));
  };

  const remove = (preset: Preset) => {
    setDialog(null);
    void store.deletePreset(preset.id);
    showToast(`Deleted “${preset.name}”`, () => void store.savePreset(preset));
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
      <SettingsHeader title="Saved presets" sub="A preset restores its books, counts, and filters in the wizard." />

      {presets.length === 0 ? (
        <Card style={{ padding: 14 }}>
          <span className="meta">No saved presets yet — save one from step 2 of the Generate wizard.</span>
        </Card>
      ) : (
        <Card>
          {presets.map((preset, i) => (
            <div
              key={preset.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderBottom: i === presets.length - 1 ? 'none' : '1px dashed var(--line)',
                minHeight: 52,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 600, fontSize: 14.5 }}>{preset.name}</b>
                <br />
                <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{summarize(preset)}</small>
              </span>
              <button
                aria-label={`Rename ${preset.name}`}
                onClick={() => {
                  setDraft(preset.name);
                  setDialog({ mode: 'rename', preset });
                }}
                style={iconBtn}
              >
                <Pencil size={14} />
              </button>
              <button
                aria-label={`Delete ${preset.name}`}
                onClick={() => setDialog({ mode: 'delete', preset })}
                style={{ ...iconBtn, color: 'var(--danger)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        label={dialog?.mode === 'rename' ? 'Rename preset' : 'Delete preset'}
      >
        {dialog?.mode === 'rename' && (
          <>
            <div className="screen-title" style={{ fontSize: 21 }}>Rename preset</div>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && rename(dialog.preset)}
              aria-label="Preset name"
              style={{
                width: '100%',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-inner)',
                padding: '10px 12px',
                fontSize: 14,
                background: 'var(--card)',
                margin: '12px 0 0',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => rename(dialog.preset)}
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
                Rename
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
        {dialog?.mode === 'delete' && (
          <>
            <div className="screen-title" style={{ fontSize: 21 }}>Delete “{dialog.preset.name}”?</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-mid)', margin: '10px 0 0' }}>
              Your books and recipes are untouched — this only removes the saved wizard setup.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => remove(dialog.preset)}
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
                Delete preset
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
