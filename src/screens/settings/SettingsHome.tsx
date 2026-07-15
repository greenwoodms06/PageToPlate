// Settings home (plan Task 26; canvas 4a, screenshot 11): grouped card lists
// under uppercase section labels — Generation, Your data, About — behind the
// gear icon. Back arrow, no bottom nav (canvas 4a; history.back() plays nicely
// with hash routing).
import { version } from '../../../package.json';
import { store, useStore } from '../../data/store';
import { applyTheme, type ThemePref } from '../../theme';
import { SegmentToggle } from '../../components/SegmentToggle';
import { Card, NavRow, SectionLabel, SettingsHeader, ToggleRow } from './settingsUi';

const REPO_URL = 'https://github.com/greenwoodms06/PageToPlate';
const THEME_OPTIONS = ['System', 'Light', 'Dark'] as const;
const RATING_SCALE_OPTIONS = ['1–5', '1–10'] as const;

export const DAY_MS = 86_400_000;
export const BACKUP_OVERDUE_DAYS = 30;

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

export function SettingsHome() {
  const settings = useStore((s) => s.settings);
  const categories = useStore((s) => s.categories);
  const presets = useStore((s) => s.presets);

  const defaults = categories.filter((c) => c.isDefault).length;
  const customs = categories.length - defaults;

  const presetSub =
    presets.length === 0
      ? 'None yet — save one from the Generate wizard'
      : presets
          .slice(0, 2)
          .map((p) => p.name)
          .join(', ') + (presets.length > 2 ? `, +${presets.length - 2}` : '');

  // Backup subtitle: 'Never backed up' / 'Last backup <Month D>' normally;
  // flips to danger copy once lastBackupAt is >30 days old (canvas 4a).
  let backupSub: string;
  let backupOverdue = false;
  if (!settings.lastBackupAt) {
    backupSub = 'Never backed up';
  } else {
    const days = daysSince(settings.lastBackupAt);
    backupOverdue = days > BACKUP_OVERDUE_DAYS;
    backupSub = backupOverdue
      ? `Last backup ${days} days ago — back up soon`
      : `Last backup ${new Date(settings.lastBackupAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  }

  const themeValue = THEME_OPTIONS.find((o) => o.toLowerCase() === settings.theme) ?? 'System';

  return (
    <main style={{ padding: '20px 16px 24px' }}>
      <SettingsHeader title="Settings" />

      <SectionLabel>Generation</SectionLabel>
      <Card>
        <NavRow
          title="Categories"
          sub={customs > 0 ? `${defaults} default + ${customs} custom` : `${defaults} default`}
          onClick={() => (window.location.hash = '#/settings/categories')}
        />
        <NavRow
          title="Filter chips"
          sub="Quick keywords shown per category"
          onClick={() => (window.location.hash = '#/settings/chips')}
        />
        <NavRow
          title="Saved presets"
          sub={presetSub}
          onClick={() => (window.location.hash = '#/settings/presets')}
        />
        <ToggleRow
          title="Prefer unmade recipes"
          sub="Generation picks recipes you haven’t made first"
          on={settings.preferUnmade}
          onChange={(on) => void store.updateSettings({ preferUnmade: on })}
        />
        {/* Checkpoint 2 amendment 3: display-only scale. Ratings are stored
            1–10 forever (logic/rating.ts); this toggle never touches data. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', minHeight: 52 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            <b style={{ fontWeight: 600, fontSize: 14.5 }}>Rating scale</b>
            <br />
            <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
              Display only — saved ratings never change.
            </small>
          </span>
          <SegmentToggle
            options={RATING_SCALE_OPTIONS}
            value={settings.ratingScale === 5 ? '1–5' : '1–10'}
            onChange={(v) => void store.updateSettings({ ratingScale: v === '1–5' ? 5 : 10 })}
          />
        </div>
      </Card>

      <SectionLabel>Your data</SectionLabel>
      <Card>
        <NavRow
          title="Back up & restore"
          sub={backupSub}
          subColor={backupOverdue ? 'var(--danger)' : undefined}
          onClick={() => (window.location.hash = '#/settings/backup')}
        />
        <NavRow
          title="Import a book with AI help"
          sub="Photograph a table of contents → CSV"
          onClick={() => (window.location.hash = '#/settings/ai-import')}
          last
        />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card style={{ padding: 14, fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.6 }}>
        Page to Plate v{version} · open source
        <br />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
        >
          Source & issues on GitHub
        </a>
        <br />
        <a
          href={`${REPO_URL}/blob/main/tools/CURATION.md`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
        >
          Contribute a cookbook pack ›
        </a>
        <br />
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          Linked packs courtesy of the Internet Archive.
          <br />
          {/* Checkpoint 2 amendment 1: the owner chose MIT — LICENSE at the
              repo root is the authoritative text. */}
          MIT license.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>Theme</span>
          <SegmentToggle
            options={THEME_OPTIONS}
            value={themeValue}
            onChange={(v) => {
              const pref = v.toLowerCase() as ThemePref;
              // App.tsx re-applies on settings change too; applying here as
              // well makes the flip instant even mid-write.
              applyTheme(pref);
              void store.updateSettings({ theme: pref });
            }}
          />
        </div>
      </Card>
    </main>
  );
}
