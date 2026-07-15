// Backup export / restore (Task 10, spec rules 8 & 11).
//
// Format: a single JSON document carrying schemaVersion + every store. With no
// attachments the export IS that JSON file; with attachments it becomes a zip
// (fflate) holding backup.json + photos/<attachment id>, because photo blobs
// don't survive JSON. Restore detects the container by the zip magic bytes
// ('PK') rather than trusting file extensions, validates schemaVersion BEFORE
// touching anything destructive, then hands a fully-parsed payload to
// Store.restoreAll (replace, never merge).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Store } from './store';
import { todayISO } from './types';
import type {
  AttachmentRec,
  Category,
  Cookbook,
  MadeEntry,
  Plan,
  Preset,
  Recipe,
  Settings,
} from './types';

export const BACKUP_SCHEMA_VERSION = 1;

interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  books: Cookbook[];
  recipes: Recipe[];
  madeEntries: MadeEntry[];
  plans: Plan[];
  categories: Category[];
  presets: Preset[];
  settings: Settings;
  /** Blob-less metadata; the bytes live in the zip as photos/<id>. */
  attachments: { id: string; name: string; type: string }[];
}

export async function exportBackup(store: Store): Promise<{ blob: Blob; filename: string; exportedAt: string }> {
  const attachments = await store.allAttachments();
  const now = new Date().toISOString();
  // The backup snapshots POST-backup settings (lastBackupAt = now, counter 0):
  // restoring it means "zero changes since this backup", which is true.
  const settings: Settings = { ...store.settings, lastBackupAt: now, changesSinceBackup: 0 };
  const payload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    books: store.books,
    recipes: store.recipes,
    madeEntries: store.madeEntries,
    plans: store.plans,
    categories: store.categories,
    presets: store.presets,
    settings,
    attachments: attachments.map(({ id, name, type }) => ({ id, name, type })),
  };
  const json = JSON.stringify(payload);
  const date = todayISO();

  // The file is named .ptp.txt and typed text/plain REGARDLESS of what it
  // really is (JSON, or a zip when photos exist). Chromium's Web Share API
  // only permits an allowlist of extensions — .json and .zip are both
  // excluded, so canShare({files}) is false and Android users never get the
  // share sheet (P2P-005; owner hit the same wall in a previous app).
  // The costume is safe because restoreBackup identifies the format by
  // CONTENT (PK magic bytes → zip, else JSON), never by extension or MIME —
  // and old .json/.zip backups keep restoring forever. Same name on the
  // download path too: one artifact, one identity (owner decision,
  // 2026-07-15). Do not "clean this up" to honest extensions without
  // re-verifying share on a real Android device.
  const filename = `pagetoplate-backup-${date}.ptp.txt`;
  let blob: Blob;
  if (attachments.length === 0) {
    blob = new Blob([json], { type: 'text/plain' });
  } else {
    const files: Record<string, Uint8Array> = { 'backup.json': strToU8(json) };
    for (const a of attachments) {
      files[`photos/${a.id}`] = new Uint8Array(await a.blob.arrayBuffer());
    }
    blob = new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'text/plain' });
  }

  // Deliberately NO bookkeeping reset here: the caller marks the backup done
  // only after the file actually left the device (share completed or download
  // triggered). A share sheet the user cancels must NOT silence the backup
  // nudge — the file went nowhere. (Post-deploy round 1 follow-up.)
  return { blob, filename, exportedAt: now };
}

/** Call after the exported file was actually delivered (shared or downloaded). */
export async function markBackedUp(store: Store, exportedAt: string): Promise<void> {
  await store.updateSettings({ lastBackupAt: exportedAt, changesSinceBackup: 0 });
}

export async function restoreBackup(store: Store, file: Blob): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  let payload: BackupPayload;
  const photoBytes = new Map<string, Uint8Array>();
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // 'PK' — zip container
    const entries = unzipSync(bytes);
    const backupJson = entries['backup.json'];
    if (!backupJson) throw new Error('restore: zip is missing backup.json');
    payload = JSON.parse(strFromU8(backupJson)) as BackupPayload;
    for (const [name, data] of Object.entries(entries)) {
      if (name.startsWith('photos/')) photoBytes.set(name.slice('photos/'.length), data);
    }
  } else {
    payload = JSON.parse(strFromU8(bytes)) as BackupPayload;
  }

  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `restore: unsupported backup schemaVersion ${String(payload.schemaVersion)} (this app reads version ${BACKUP_SCHEMA_VERSION})`,
    );
  }

  // Rebuild attachment records BEFORE any destructive step: a corrupt zip must
  // fail here, leaving current data intact (restoreAll clears everything).
  const attachments: AttachmentRec[] = (payload.attachments ?? []).map((meta) => {
    const data = photoBytes.get(meta.id);
    if (!data) throw new Error(`restore: backup.json lists attachment ${meta.id} but photos/${meta.id} is missing`);
    return { id: meta.id, name: meta.name, type: meta.type, blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: meta.type }) };
  });

  await store.restoreAll({
    books: payload.books,
    recipes: payload.recipes,
    madeEntries: payload.madeEntries,
    plans: payload.plans,
    categories: payload.categories,
    presets: payload.presets,
    settings: payload.settings,
    attachments,
  });
}
