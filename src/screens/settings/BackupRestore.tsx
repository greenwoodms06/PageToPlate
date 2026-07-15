// Backup & restore (plan Task 26 Step 3; canvas 4c, screenshot 13) — the only
// data-loss protection. Warning note with last-backup age + unsaved-change
// count, primary Export card (share sheet where files are shareable, anchor
// download otherwise), Restore card with explicit replace-not-merge copy and
// a confirm dialog, the 30-day reminder toggle, and persistent-storage status.
import { useRef, useState } from 'react';
import { exportBackup, markBackedUp, restoreBackup } from '../../data/backup';
import { store, useStore } from '../../data/store';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { WarningNote } from '../../components/WarningNote';
import { daysSince } from './SettingsHome';
import { Card, SettingsHeader, ToggleRow } from './settingsUi';

/** Anchor-click download — the share-unavailable/share-broken fallback. */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delayed revoke: Chromium starts the download synchronously, but
  // Firefox can still be reading the blob URL right after click().
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function BackupRestore() {
  const settings = useStore((s) => s.settings);
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async (dataOnly = false) => {
    setBusy(true);
    try {
      const { blob, filename, exportedAt, complete } = await exportBackup(store, { dataOnly });
      const file = new File([blob], filename, { type: blob.type });
      // Share FIRST on every device (round-1 amendment 6): the phone share
      // sheet (Drive/Files/messaging) is where a backup actually gets OFF the
      // device; the anchor download is the fallback only — when files aren't
      // shareable (canShare is feature + payload check; desktop Chromium on
      // Linux lacks files-share entirely, which is why the E2E keeps
      // asserting the download path) or when share() itself breaks.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'PageToPlate backup' });
        } catch (err) {
          // AbortError = the user closed the share sheet — they changed
          // their mind. No fallback download, no toast, and CRUCIALLY no
          // markBackedUp: the file went nowhere, the backup nudge must
          // keep counting.
          if ((err as DOMException).name === 'AbortError') return;
          // Any OTHER share failure must still deliver the file.
          downloadFile(blob, filename);
        }
      } else {
        downloadFile(blob, filename);
      }
      // Only now — after the file was shared or handed to the browser's
      // download — does the backup count as done. And ONLY if it covered
      // everything: a data-only export while photos exist must not reset the
      // 30-day nudge, or photos sit unprotected behind a green light.
      if (complete) {
        await markBackedUp(store, exportedAt);
        showToast('Backup exported');
      } else {
        showToast('Data exported — photos not included');
      }
    } catch (e) {
      showToast(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (file: File) => {
    setBusy(true);
    try {
      await restoreBackup(store, file);
      // Full reload, deliberately: restoreAll rebuilds the memory store, but
      // module-level session state (pack-catalog memo, persist guard, any
      // mounted screen holding ids that no longer exist) would go stale. A
      // reload re-inits everything from IndexedDB — the restored truth.
      window.location.reload();
    } catch (e) {
      // Failed BEFORE anything destructive (backup.ts validates first) — the
      // current data is intact, so just report and stay.
      setBusy(false);
      setConfirmFile(null);
      showToast(`Restore failed: ${(e as Error).message}`);
    }
  };

  // Warning note (canvas 4c): 'Your data lives only on this device. Last
  // backup: June 9 — 34 days and 61 changes ago.'
  const days = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
  const changes = settings.changesSinceBackup;

  const persistLine = settings.persistGranted
    ? '✓ Persistent storage: granted — the browser won’t evict your data.'
    : typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function'
      ? 'Persistent storage: not granted — it’s requested once you have data.'
      : 'Persistent storage: unavailable in this browser.';

  return (
    <main style={{ padding: '20px 16px 24px' }}>
      <SettingsHeader title="Back up & restore" />

      <div style={{ margin: '14px 0' }}>
        <WarningNote>
          {settings.lastBackupAt ? (
            <>
              Your data lives only on this device.{' '}
              <b>
                Last backup:{' '}
                {new Date(settings.lastBackupAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </b>{' '}
              — {days} day{days === 1 ? '' : 's'} and {changes} change{changes === 1 ? '' : 's'} ago.
            </>
          ) : (
            <>
              Your data lives only on this device. <b>Never backed up</b>
              {changes > 0 && (
                <>
                  {' '}
                  — {changes} change{changes === 1 ? '' : 's'} at risk
                </>
              )}
              .
            </>
          )}
        </WarningNote>
      </div>

      <Card style={{ padding: 14 }}>
        <b style={{ fontWeight: 600, fontSize: 15.5 }}>Back up everything</b>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '2px 0 12px' }}>
          One file with all books, recipes, history, and photos. Save it to your phone or a drive.
        </div>
        <button
          onClick={() => void doExport()}
          disabled={busy}
          style={{
            width: '100%',
            minHeight: 50,
            background: busy ? 'var(--accent-disabled)' : 'var(--accent)',
            color: 'var(--on-accent)',
            borderRadius: 'var(--r-card)',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          ↑ Export backup file
        </button>
        <button
          onClick={() => void doExport(true)}
          disabled={busy}
          style={{
            width: '100%',
            minHeight: 40,
            marginTop: 8,
            border: '1.5px solid var(--line)',
            background: 'none',
            color: 'var(--ink-mid)',
            borderRadius: 'var(--r-card)',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Export data only — no photos
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
          A small plain-text file. Skipping photos won’t count as a full backup.
        </div>
      </Card>

      <Card style={{ padding: 14, marginTop: 10 }}>
        <b style={{ fontWeight: 600, fontSize: 15.5 }}>Restore from a backup</b>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '2px 0 12px' }}>
          <b style={{ color: 'var(--danger)' }}>Replaces</b> everything currently in the app — it does not merge.
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          style={{
            width: '100%',
            minHeight: 50,
            border: '1.5px solid var(--line)',
            background: 'none',
            color: 'var(--ink)',
            borderRadius: 'var(--r-card)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          ↓ Choose backup file…
        </button>
        <input
          ref={fileInput}
          type="file"
          // NO accept filter, deliberately: Android's document picker maps
          // accept to MIME filters and blocked the owner's .ptp.txt backup
          // outright (2026-07-15). restoreBackup validates by CONTENT before
          // touching anything, so an unfiltered picker is safe — a wrong file
          // fails with a toast and current data stays intact.
          aria-label="Backup file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setConfirmFile(f);
            e.target.value = ''; // re-selecting the same file must re-fire
          }}
        />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <ToggleRow
          title="Remind me to back up"
          sub="After 30 days of unsaved changes"
          on={settings.backupReminder}
          onChange={(on) => void store.updateSettings({ backupReminder: on })}
          last
        />
      </Card>

      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 14, lineHeight: 1.5 }}>
        {persistLine}
        <br />
        Backups include a version stamp so future app versions can read them.
      </div>

      <Dialog open={confirmFile !== null} onClose={() => setConfirmFile(null)} label="Confirm restore">
        <div className="screen-title" style={{ fontSize: 21 }}>Replace everything?</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-mid)', margin: '10px 0 0' }}>
          Restoring <b>{confirmFile?.name}</b> replaces all books, recipes, history, and settings currently in the
          app. It does not merge. The app reloads afterwards.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={() => confirmFile && void doRestore(confirmFile)}
            disabled={busy}
            style={{
              flex: 1,
              minHeight: 44,
              background: 'var(--danger)',
              // on-accent, not #fff: dark --danger brightens to #C97B63, which
              // needs the same dark-ink flip as accent buttons (dark sweep, T27).
              color: 'var(--on-accent)',
              borderRadius: 'var(--r-cta)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {busy ? 'Restoring…' : 'Restore & replace'}
          </button>
          <button
            onClick={() => setConfirmFile(null)}
            disabled={busy}
            style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
          >
            Cancel
          </button>
        </div>
      </Dialog>
    </main>
  );
}
