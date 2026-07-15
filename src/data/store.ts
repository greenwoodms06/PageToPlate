// Memory-first store: the single source of truth lives in memory Maps, every
// mutation writes through to IndexedDB (db.ts) and notifies subscribers.
// React components read via useStore() at the bottom of this file — the Store
// class itself has no React dependency.
//
// Attachments (photo blobs) are the one store NOT held in memory: blobs can be
// megabytes each, so they stay in IndexedDB and are fetched on demand via
// getAttachment(). Everything else is small metadata and loads on init().
import { useSyncExternalStore } from 'react';
import * as db from './db';
import { orphanBook } from '../logic/orphans';
import { DEFAULT_CATEGORIES } from './categories';
import { DEFAULT_SETTINGS, newId } from './types';
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

interface MadeStats {
  count: number;
  last: string;
}

export class Store {
  private booksMap = new Map<string, Cookbook>();
  private recipesMap = new Map<string, Recipe>();
  private madeMap = new Map<string, MadeEntry>();
  private plansMap = new Map<string, Plan>();
  private categoriesMap = new Map<string, Category>();
  private presetsMap = new Map<string, Preset>();
  private settingsObj: Settings = { ...DEFAULT_SETTINGS };

  private listeners = new Set<() => void>();
  private versionNum = 0;

  // Lazy caches, dropped on every notify(). The recipes array in particular is
  // read per render by Browse with ~1,645 recipes — getters must not rebuild
  // arrays unless something actually changed.
  private booksArr: Cookbook[] | null = null;
  private recipesArr: Recipe[] | null = null;
  private madeArr: MadeEntry[] | null = null;
  private plansArr: Plan[] | null = null;
  private categoriesArr: Category[] | null = null;
  private presetsArr: Preset[] | null = null;
  private madeIndex: Map<string, MadeStats> | null = null;
  private plannedCache: Set<string> | null = null;

  // ── lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    const [books, recipes, made, plans, categories, presets, settings] = await Promise.all([
      db.getAll('books'),
      db.getAll('recipes'),
      db.getAll('madeEntries'),
      db.getAll('plans'),
      db.getAll('categories'),
      db.getAll('presets'),
      db.getSettings(),
    ]);
    this.booksMap = new Map(books.map((b) => [b.id, b]));
    this.recipesMap = new Map(recipes.map((r) => [r.id, r]));
    this.madeMap = new Map(made.map((m) => [m.id, m]));
    this.plansMap = new Map(plans.map((p) => [p.id, p]));
    this.presetsMap = new Map(presets.map((p) => [p.id, p]));

    if (categories.length === 0) {
      // First run: seed defaults. Seeding is re-derivable, so it neither bumps
      // changesSinceBackup nor should it ever run twice (guarded by emptiness).
      const seeded: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
        id: newId(),
        name: c.name,
        order: i,
        isDefault: true,
        chips: [...c.chips],
      }));
      await db.bulkPut('categories', seeded);
      this.categoriesMap = new Map(seeded.map((c) => [c.id, c]));
    } else {
      this.categoriesMap = new Map(categories.map((c) => [c.id, c]));
    }

    if (settings) {
      this.settingsObj = settings;
    } else {
      this.settingsObj = { ...DEFAULT_SETTINGS };
      await db.putSettings(this.settingsObj);
    }
    this.notify();
  }

  /**
   * Restore is REPLACE, never merge (spec rule on backups): wipe IndexedDB,
   * bulk-load the backup payload, rebuild memory. Deliberately does NOT bump
   * changesSinceBackup — the restored settings carry their own counter (a
   * just-made backup restores to 0 changes since backup).
   */
  async restoreAll(data: {
    books: Cookbook[];
    recipes: Recipe[];
    madeEntries: MadeEntry[];
    plans: Plan[];
    categories: Category[];
    presets: Preset[];
    settings: Settings;
    attachments: AttachmentRec[];
  }): Promise<void> {
    await db.clearAll();
    await Promise.all([
      db.bulkPut('books', data.books),
      db.bulkPut('recipes', data.recipes),
      db.bulkPut('madeEntries', data.madeEntries),
      db.bulkPut('plans', data.plans),
      db.bulkPut('categories', data.categories),
      db.bulkPut('presets', data.presets),
      db.bulkPut('attachments', data.attachments),
      db.putSettings(data.settings),
    ]);
    this.booksMap = new Map(data.books.map((b) => [b.id, b]));
    this.recipesMap = new Map(data.recipes.map((r) => [r.id, r]));
    this.madeMap = new Map(data.madeEntries.map((m) => [m.id, m]));
    this.plansMap = new Map(data.plans.map((p) => [p.id, p]));
    this.categoriesMap = new Map(data.categories.map((c) => [c.id, c]));
    this.presetsMap = new Map(data.presets.map((p) => [p.id, p]));
    this.settingsObj = data.settings;
    this.notify();
  }

  // ── subscription (useSyncExternalStore contract) ───────────────────────

  // Arrow property: stable identity so it can be handed straight to
  // useSyncExternalStore without re-subscribing every render.
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  get version(): number {
    return this.versionNum;
  }

  private notify(): void {
    this.booksArr = null;
    this.recipesArr = null;
    this.madeArr = null;
    this.plansArr = null;
    this.categoriesArr = null;
    this.presetsArr = null;
    this.madeIndex = null;
    this.plannedCache = null;
    this.versionNum += 1;
    for (const fn of [...this.listeners]) fn();
  }

  // Every mutator EXCEPT updateSettings funnels through here: one user action
  // = one backup-worthy change, persisted immediately so the reminder survives
  // a reload.
  private async bumpAndNotify(): Promise<void> {
    this.settingsObj = {
      ...this.settingsObj,
      changesSinceBackup: this.settingsObj.changesSinceBackup + 1,
    };
    await db.putSettings(this.settingsObj);
    this.notify();
  }

  // ── getters (arrays/objects only — internal Maps never escape) ─────────

  get books(): Cookbook[] {
    return (this.booksArr ??= [...this.booksMap.values()]);
  }

  get recipes(): Recipe[] {
    return (this.recipesArr ??= [...this.recipesMap.values()]);
  }

  get madeEntries(): MadeEntry[] {
    return (this.madeArr ??= [...this.madeMap.values()]);
  }

  get plans(): Plan[] {
    return (this.plansArr ??= [...this.plansMap.values()]);
  }

  get categories(): Category[] {
    return (this.categoriesArr ??= [...this.categoriesMap.values()].sort((a, b) => a.order - b.order));
  }

  get presets(): Preset[] {
    return (this.presetsArr ??= [...this.presetsMap.values()]);
  }

  get settings(): Settings {
    return this.settingsObj;
  }

  // ── books ───────────────────────────────────────────────────────────────

  async addBook(book: Cookbook): Promise<void> {
    this.booksMap.set(book.id, book);
    await db.put('books', book);
    await this.bumpAndNotify();
  }

  async updateBook(id: string, patch: Partial<Cookbook>): Promise<void> {
    const cur = this.booksMap.get(id);
    if (!cur) throw new Error(`updateBook: unknown book ${id}`);
    const next = { ...cur, ...patch };
    this.booksMap.set(id, next);
    await db.put('books', next);
    await this.bumpAndNotify();
  }

  // "Delete book, keep cooking history" (spec rule 8): the book and its
  // recipes go, but their MadeEntries become orphans (recipeId: null +
  // {bookTitle, recipeName, page} snapshot — see src/logic/orphans.ts).
  // Made-entry photos survive with their entries; the deleted recipes' own
  // attachments are removed so no unreferenced blobs leak.
  async deleteBookKeepHistory(id: string): Promise<void> {
    const book = this.booksMap.get(id);
    if (!book) return;
    const recipes = [...this.recipesMap.values()].filter((r) => r.bookId === id);
    const orphaned = orphanBook(book, recipes, [...this.madeMap.values()]);
    const recipeAttachmentIds = recipes.flatMap((r) => r.attachmentIds);

    this.booksMap.delete(id);
    for (const r of recipes) this.recipesMap.delete(r.id);
    for (const m of orphaned) this.madeMap.set(m.id, m);

    await db.del('books', id);
    await db.bulkDel('recipes', recipes.map((r) => r.id));
    await db.bulkPut('madeEntries', orphaned);
    await db.bulkDel('attachments', recipeAttachmentIds);
    await this.bumpAndNotify();
  }

  // Hard delete is "delete everything": the book, its recipes, those recipes'
  // MadeEntries, and every attachment referenced by either.
  async deleteBookHard(id: string): Promise<void> {
    const book = this.booksMap.get(id);
    if (!book) return;
    const recipes = [...this.recipesMap.values()].filter((r) => r.bookId === id);
    const recipeIds = new Set(recipes.map((r) => r.id));
    const made = [...this.madeMap.values()].filter((m) => m.recipeId !== null && recipeIds.has(m.recipeId));
    const attachmentIds = new Set<string>();
    for (const r of recipes) for (const a of r.attachmentIds) attachmentIds.add(a);
    for (const m of made) for (const a of m.photoIds) attachmentIds.add(a);

    this.booksMap.delete(id);
    for (const r of recipes) this.recipesMap.delete(r.id);
    for (const m of made) this.madeMap.delete(m.id);

    await db.del('books', id);
    await db.bulkDel('recipes', [...recipeIds]);
    await db.bulkDel('madeEntries', made.map((m) => m.id));
    await db.bulkDel('attachments', [...attachmentIds]);
    await this.bumpAndNotify();
  }

  // ── recipes ─────────────────────────────────────────────────────────────

  async addRecipes(recipes: Recipe[]): Promise<void> {
    for (const r of recipes) this.recipesMap.set(r.id, r);
    await db.bulkPut('recipes', recipes);
    await this.bumpAndNotify(); // one import = one change, however many rows
  }

  async updateRecipe(id: string, patch: Partial<Recipe>): Promise<void> {
    const cur = this.recipesMap.get(id);
    if (!cur) throw new Error(`updateRecipe: unknown recipe ${id}`);
    const next = { ...cur, ...patch };
    this.recipesMap.set(id, next);
    await db.put('recipes', next);
    await this.bumpAndNotify();
  }

  async deleteRecipe(id: string): Promise<void> {
    if (!this.recipesMap.delete(id)) return;
    await db.del('recipes', id);
    await this.bumpAndNotify();
  }

  // ── made entries ───────────────────────────────────────────────────────

  async addMadeEntry(entry: MadeEntry): Promise<void> {
    this.madeMap.set(entry.id, entry);
    await db.put('madeEntries', entry);
    await this.bumpAndNotify();
  }

  async updateMadeEntry(id: string, patch: Partial<MadeEntry>): Promise<void> {
    const cur = this.madeMap.get(id);
    if (!cur) throw new Error(`updateMadeEntry: unknown entry ${id}`);
    const next = { ...cur, ...patch };
    this.madeMap.set(id, next);
    await db.put('madeEntries', next);
    await this.bumpAndNotify();
  }

  async deleteMadeEntry(id: string): Promise<void> {
    if (!this.madeMap.delete(id)) return;
    await db.del('madeEntries', id);
    await this.bumpAndNotify();
  }

  // ── plans ───────────────────────────────────────────────────────────────

  async addPlan(plan: Plan): Promise<void> {
    this.plansMap.set(plan.id, plan);
    await db.put('plans', plan);
    await this.bumpAndNotify();
  }

  async updatePlan(id: string, patch: Partial<Plan>): Promise<void> {
    const cur = this.plansMap.get(id);
    if (!cur) throw new Error(`updatePlan: unknown plan ${id}`);
    const next = { ...cur, ...patch };
    this.plansMap.set(id, next);
    await db.put('plans', next);
    await this.bumpAndNotify();
  }

  // Added for AddToPlanDialog's "New plan" toast-undo (Task 22) — a plan
  // created by mistake must be removable, matching every other edit's Undo.
  async deletePlan(id: string): Promise<void> {
    if (!this.plansMap.delete(id)) return;
    await db.del('plans', id);
    await this.bumpAndNotify();
  }

  // ── presets ─────────────────────────────────────────────────────────────

  async savePreset(preset: Preset): Promise<void> {
    this.presetsMap.set(preset.id, preset); // upsert
    await db.put('presets', preset);
    await this.bumpAndNotify();
  }

  async deletePreset(id: string): Promise<void> {
    if (!this.presetsMap.delete(id)) return;
    await db.del('presets', id);
    await this.bumpAndNotify();
  }

  // ── categories ─────────────────────────────────────────────────────────

  async addCategory(cat: Category): Promise<void> {
    this.categoriesMap.set(cat.id, cat);
    await db.put('categories', cat);
    await this.bumpAndNotify();
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    const cur = this.categoriesMap.get(id);
    if (!cur) throw new Error(`updateCategory: unknown category ${id}`);
    const next = { ...cur, ...patch };
    this.categoriesMap.set(id, next);
    await db.put('categories', next);
    await this.bumpAndNotify();
  }

  // Deleting a category never strands recipes: they all move to targetName
  // (typically another category, or UNCATEGORIZED).
  async deleteCategoryReassign(catId: string, targetName: string): Promise<void> {
    const cat = this.categoriesMap.get(catId);
    if (!cat) return;
    const moved: Recipe[] = [];
    for (const r of this.recipesMap.values()) {
      if (r.category === cat.name) {
        const next = { ...r, category: targetName };
        this.recipesMap.set(r.id, next);
        moved.push(next);
      }
    }
    this.categoriesMap.delete(catId);
    await db.bulkPut('recipes', moved);
    await db.del('categories', catId);
    await this.bumpAndNotify();
  }

  // ── settings ───────────────────────────────────────────────────────────

  // Deliberately does NOT bump changesSinceBackup: Settings carries the backup
  // counter itself, so counting settings writes would make resetting the
  // counter after a backup self-defeating (the reset would register as a new
  // change and immediately re-arm the reminder).
  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settingsObj = { ...this.settingsObj, ...patch };
    await db.putSettings(this.settingsObj);
    this.notify();
  }

  // ── attachments (on-demand, not memory-resident — see header note) ─────

  async addAttachment(rec: AttachmentRec): Promise<void> {
    await db.put('attachments', rec);
    await this.bumpAndNotify();
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.del('attachments', id);
    await this.bumpAndNotify();
  }

  async getAttachment(id: string): Promise<AttachmentRec | undefined> {
    return db.get('attachments', id);
  }

  /**
   * Every attachment record, blobs included — for backup export only. Loading
   * all blobs at once is exactly what the memory-first design avoids in normal
   * operation (see header note), but a full export needs the bytes anyway.
   */
  async allAttachments(): Promise<AttachmentRec[]> {
    return db.getAll('attachments');
  }

  // ── derived ────────────────────────────────────────────────────────────

  private getMadeIndex(): Map<string, MadeStats> {
    if (!this.madeIndex) {
      const idx = new Map<string, MadeStats>();
      for (const m of this.madeMap.values()) {
        if (m.recipeId === null) continue; // orphaned entries belong to no live recipe
        const cur = idx.get(m.recipeId);
        if (cur) {
          cur.count += 1;
          if (m.date > cur.last) cur.last = m.date; // 'YYYY-MM-DD' compares lexicographically
        } else {
          idx.set(m.recipeId, { count: 1, last: m.date });
        }
      }
      this.madeIndex = idx;
    }
    return this.madeIndex;
  }

  madeCountFor(recipeId: string): number {
    return this.getMadeIndex().get(recipeId)?.count ?? 0;
  }

  lastMadeFor(recipeId: string): string | undefined {
    return this.getMadeIndex().get(recipeId)?.last;
  }

  /** Recipe ids with an 'open' item in any plan (made/dismissed excluded). */
  plannedRecipeIds(): Set<string> {
    if (!this.plannedCache) {
      const ids = new Set<string>();
      for (const p of this.plansMap.values()) {
        for (const item of p.items) if (item.state === 'open') ids.add(item.recipeId);
      }
      this.plannedCache = ids;
    }
    return this.plannedCache;
  }
}

// ── React glue ─────────────────────────────────────────────────────────────

/** App-wide singleton. Tests construct their own `new Store()` instead. */
export const store = new Store();

/**
 * Subscribe a component to the store. The snapshot is a version counter that
 * bumps on every notify(), so the selector re-runs against current state on
 * each mutation; between mutations, cached getter arrays keep selector results
 * referentially stable.
 */
export function useStore<T>(selector: (s: Store) => T): T {
  useSyncExternalStore(
    store.subscribe,
    () => store.version,
    () => store.version,
  );
  return selector(store);
}
