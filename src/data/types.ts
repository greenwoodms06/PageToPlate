export interface Cookbook {
  id: string; name: string; tags: string[]; archived: boolean;
  packId?: string; packVersion?: number; createdAt: string;
}
export type PageStatus = 'verified' | 'unverified';
export interface Recipe {
  id: string; bookId: string; name: string; page: string;
  category: string; tags: string[];
  status: 'active' | 'excluded';
  isCustom: boolean; text?: string;
  /** Recipe-level notes (round-1 amendment 1) — distinct from per-MadeEntry
   * notes: "always halve the salt" belongs to the recipe, not to one cook. */
  notes?: string;
  attachmentIds: string[];
  link?: { url: string; pageStatus: PageStatus };
  createdAt: string;
}
export interface MadeEntry {
  id: string; recipeId: string | null;      // null ⇒ orphaned
  date: string;                              // 'YYYY-MM-DD'
  rating?: number;                           // 1–10
  notes?: string; photoIds: string[];
  orphan?: { bookTitle: string; recipeName: string; page: string };
}
export interface PlanItem { recipeId: string; state: 'open' | 'made' | 'dismissed'; madeEntryId?: string }
export interface Plan {
  id: string; acceptedAt: string; items: PlanItem[];
  genContext?: { bookIds: string[]; config: Record<string, CatConfig> };
}
export interface Category { id: string; name: string; order: number; isDefault: boolean; chips: string[] }
export interface Pill { text: string; neg: boolean }
export interface CatConfig { count: number; pills: Pill[] }
export interface Preset { id: string; name: string; bookIds: string[]; config: Record<string, CatConfig> }
export interface AttachmentRec { id: string; blob: Blob; name: string; type: string }
export interface Settings {
  preferUnmade: boolean; theme: 'system' | 'light' | 'dark';
  backupReminder: boolean; lastBackupAt?: string; changesSinceBackup: number;
  verifiedPagesOnly: boolean; persistGranted?: boolean;
  /** Display-only rating scale — stored ratings stay canonical 1–10 (see logic/rating.ts). */
  ratingScale: 5 | 10;
}
export const DEFAULT_SETTINGS: Settings = {
  preferUnmade: true, theme: 'system', backupReminder: true,
  changesSinceBackup: 0, verifiedPagesOnly: false, ratingScale: 10,
};
export const newId = () => crypto.randomUUID();
// Local date, not UTC: an evening cook must journal under the user's own day
// (toISOString() rolls to tomorrow after ~7-8pm in US timezones).
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
