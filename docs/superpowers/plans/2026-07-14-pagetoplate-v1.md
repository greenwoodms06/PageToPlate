# PageToPlate v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy PageToPlate — a mobile-first cookbook-index PWA (generate → plan → cook → track) recreating the approved "Card Catalog" design at high fidelity, per `background/design_handoff_pagetoplate/`.

**Architecture:** Static single-page PWA on GitHub Pages. Vite + React + TypeScript; plain CSS with custom properties for the design tokens (no CSS framework). All data in IndexedDB behind a memory-first `Store` (load-all-on-start, mutate → persist → notify; ~1.6k recipes is trivial in memory). Pure logic (pills, generation, CSV, import mapping, backup, orphans) lives in dependency-free modules under `src/logic/` and `src/data/`, unit-tested with Vitest; UI verified by Playwright smoke E2E.

**Tech Stack:** Vite, React 18, TypeScript, `idb`, `fflate` (backup zip), `lucide-react` (icons), `@fontsource/bricolage-grotesque` + `@fontsource/instrument-sans` (self-hosted fonts, offline-safe), `vite-plugin-pwa`, Vitest + `fake-indexeddb`, Playwright.

---

## Sources of truth

- **Behavior:** `background/design_handoff_pagetoplate/cookbook-app-spec.md` (the handoff copy — newer than `background/cookbook-app-spec.md`). Key Behavioral Rules 1–12 at its end are the test checklist.
- **Visuals:** `background/design_handoff_pagetoplate/README.md` (tokens, component vocabulary, per-screen specs) + `PageToPlate Directions.dc.html` (inline-styled HTML per screen, roots carry `data-screen-label`) + `screenshots/*.png` (01–16). Fidelity is **pixel-perfect intent**; when this plan omits a style value, extract it from the canvas HTML for the named screen — that file is the markup-level reference, not a suggestion.
- **Canonical wizard logic:** the `Component` class in `PageToPlate Wizard Prototype.dc.html` (lines 167–465). Tasks below port it typed, near-verbatim. Port, don't reinvent.

## Decisions locked by owner interview (2026-07-14)

| Decision | Value |
|---|---|
| Default categories | **11** (was 12): Mains, Sides, Soups & Stews, Salads, Breakfast & Brunch, Breads, Desserts, Drinks, Sauces & Condiments, Preserves & Pickles, Basics |
| Appetizers & Small Plates | Merged into **Sides**; appetizer-vocabulary sections (Starters, Meze, Tapas, Antipasti, Dim Sum, Hors d'oeuvres, Snacks…) map to Sides **and auto-tag `appetizer`** |
| Stack | Vite + React + TypeScript, plain CSS custom properties |
| Scope | Full app; Library tab real, wired to `catalog.json`; archive.org pack-curation pipeline deferred |
| ATK data | `atk_index.csv` ships as the **first index-only pack** |
| Testing | Vitest units pinning spec rules + Playwright core-loop smoke |
| Device priority | Android / Chrome |
| Deploy | GitHub Pages via Actions at end of build, after local review |
| Cadence | Continuous build; demo checkpoints after the wizard works (Milestone D) and before deploy (Milestone H) |

Conventional calls (stated, not open): hash-based routing (`HashRouter`), dark mode = system + manual override, memory-first store over `idb`, photos compressed to ≤1200px long edge JPEG ~0.82, Lucide icons ~18px in nav.

## Checkpoint 1 amendments (owner, 2026-07-14, after live wizard demo)

1. **Chip defaults approved as proposed** (Task 4 values ship).
2. **ATK pack title confirmed:** "The Complete America's Test Kitchen TV Show Cookbook 2001–2025" (replaces the devSeed placeholder; feeds Task 25 pack build).
3. **Index-card ruling removed from recipe cards** — owner: the background lines make cards hard to read. Overrides the handoff's signature ruling on hero recipe cards, app-wide (results cards now; Task 22's universal recipe card must NOT be ruled either). The `.index-ruling` utility stays in base.css, unused, for reference.
4. **Regenerate covers "never" cards too** — owner: regenerate should replace both rejected AND never'd cards (supersedes spec/prototype rejected-only). Never'd recipes stay `excluded` (undo via toast/Browse); their cards are replaced on regenerate. Footer button appears when rejected+never > 0, label "↻ Regenerate N". `regenerate()` logic + tests updated accordingly.
5. **Bug fix:** rejected-state button contrast (owner saw gray fill with unreadable text) — add dark `--rejected-fill` + correct text token in both themes.

## Checkpoint 2 amendments (owner, 2026-07-15, after full-app demo)

1. **License: MIT** (add LICENSE file; About screen references it).
2. **Flexible rating filter in Browse** — replace the fixed "★ 8+" chip with a dropdown: star value + mode (and above / exactly / and below) + clear.
3. **Rating display scale setting** — `settings.ratingScale: 5 | 10`, default 10. Storage stays canonical 1–10 forever; 5-scale is display-only binning (1–2→1, 3–4→2, 5–6→3, 7–8→4, 9–10→5; input on 5-scale stores ×2). Switching never mutates data. 1–100 / fully-custom scales considered and rejected (false precision, UI + complexity cost); the canonical 1–10 storage leaves room to add display options later without migration.
4. **Polish:** Generate step 1 empty state with zero books says "No books yet — add one in Books", not `No books match ""`.

## Post-deploy amendments, round 1 (owner, 2026-07-15, after phone use)

1. **Recipe card:** add a recipe-level Notes section (`Recipe.notes?: string`, instant-save textarea) — distinct from per-MadeEntry notes. Backup covers it automatically (whole-recipe serialization).
2. **Recipe card book selector:** replace the confusing tap-to-select pill with an explicit "Move to book…" chooser dialog (keeps the spec's move-recipe capability; owner may still opt to remove).
3. **App-wide swipe navigation:** horizontal swipe switches bottom-nav tabs (interpretation of owner's "left/right swipe to change tabs" — flagged; alternative reading was next/prev recipe in the card). Must not misfire on horizontally scrollable chip rows or open overlays.
4. **Plans:** swap gets an undo toast (restores previous recipe); plans are deletable via confirm dialog (history/MadeEntries survive); calendar day-detail plan lines tap through to that plan in list view.
5. **Browse:** rating filter chip moves from the status row up to the Books/Categories dropdown row.
6. **Backup export:** prefer `navigator.share({files})` (phone share sheet) whenever supported; download is fallback only. File type stays JSON / ZIP-with-photos, `schemaVersion` already stamped.

## File structure

```
/ (repo root)
├── index.html  vite.config.ts  tsconfig.json  package.json  playwright.config.ts
├── .github/workflows/deploy.yml
├── public/
│   ├── icons/ (pwa-192.png, pwa-512.png, maskable-512.png, favicon.svg)
│   └── packs/
│       ├── catalog.json
│       └── atk-complete.json          # generated by tools/build_pack.py
├── src/
│   ├── main.tsx  App.tsx
│   ├── styles/tokens.css  styles/base.css
│   ├── data/
│   │   ├── types.ts                   # all interfaces
│   │   ├── categories.ts              # 11 defaults + chips + synonym map (DECISION RECORD lives here)
│   │   ├── db.ts                      # idb schema + raw CRUD
│   │   ├── store.ts                   # memory-first Store + React hooks
│   │   ├── backup.ts                  # export/restore, schemaVersion
│   │   └── packs.ts                   # catalog fetch, install/update/uninstall
│   ├── logic/
│   │   ├── pills.ts                   # Pill type, matching, add/toggle/remove
│   │   ├── generate.ts                # eligibility, pick, generate, regenerate
│   │   ├── csv.ts                     # forgiving CSV parser + column mapping
│   │   ├── importer.ts                # category mapping, appetizer tag, dedupe, tag-redundancy
│   │   ├── orphans.ts                 # orphaned history + fuzzy re-association
│   │   └── images.ts                  # compressImage()
│   ├── components/                    # Pill, Chip, StatusTag, Stepper, Toast, Sheet, Dialog,
│   │   │                              # SpineStripe, PageTab, SpineChip, OrderBadge, WarningNote,
│   │   │                              # SegmentToggle, BottomNav, RecipeRow, RecipeResultCard
│   ├── screens/
│   │   ├── generate/ (BooksStep, CategoriesStep, ResultsStep, PlanCreated)
│   │   ├── plans/ (PlansTab, PlanCard, CalendarView)
│   │   ├── browse/ (BrowseTab)
│   │   ├── books/ (BooksTab, LibrarySection, BookDetail, CsvImport, CsvPreview)
│   │   ├── settings/ (SettingsHome, ChipsEditor, CategoriesEditor, PresetsEditor, BackupRestore, AiImportHelp)
│   │   └── recipe/ (RecipeCardSheet, MarkAsMadeDialog, AddToPlanDialog)
│   └── theme.ts                       # theme resolution + toggle
├── tools/
│   ├── recipe_organize.py  recipe_enrich.py   # moved from background/
│   ├── build_pack.py                          # CSV → pack JSON
│   └── README.md                              # pipeline docs
├── e2e/core-loop.spec.ts
└── background/                        # handoff bundle — untouched historical record
```

Unit tests co-locate as `*.test.ts` next to sources.

---

## Milestone A — Foundation

### Task 1: Scaffold, tooling, repo layout

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder), `.gitignore`; `git mv background/recipe_organize.py background/recipe_enrich.py tools/`; create `tools/README.md`.

- [ ] **Step 1:** Scaffold with Vite: `npm create vite@latest . -- --template react-ts` (into repo root; keep existing files). Then `npm i idb fflate lucide-react @fontsource/bricolage-grotesque @fontsource/instrument-sans` and `npm i -D vitest fake-indexeddb @vitest/ui jsdom vite-plugin-pwa @playwright/test`.
- [ ] **Step 2:** `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/PageToPlate/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'PageToPlate', short_name: 'PageToPlate',
      description: 'Actually use your cookbooks.',
      theme_color: '#F6F4EC', background_color: '#F6F4EC', display: 'standalone',
      icons: [
        { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'] },
  })],
  test: { environment: 'node' },
});
```

- [ ] **Step 3:** Move the Python scripts: `git mv` as above; write `tools/README.md` describing the pre-import pipeline (organize → enrich → AI region pass → apply), citing spec §CSV Import. Note explicitly: *the AI region-pass prompt file was not included in the handoff bundle — currently an unfilled slot, do not invent one.*
- [ ] **Step 4:** `npm run dev` starts; `npx vitest run` passes (no tests yet → "no test files" is fine); commit: `feat: scaffold Vite+React+TS app, move import tools to tools/`.

### Task 2: Design tokens + base styles + theme

**Files:** Create `src/styles/tokens.css`, `src/styles/base.css`, `src/theme.ts`.

- [ ] **Step 1:** `tokens.css` — transcribe the handoff README's color/type/shape sections as custom properties. Complete light + dark sets:

```css
:root {
  /* paper & ink (light) */
  --paper:#F6F4EC; --card:#FFFEF9; --panel:#FBFAF3;
  --ink:#23241E; --ink-soft:#75766B; --ink-mid:#54554B; --ink-disabled:#B9B6A8;
  --line:#E2DFD2; --dash:#DAD7C8; --ruling:#E7E4D6;
  --accent:#2D6A4F; --accent-tint:#EDF3EE; --accent-disabled:#B9C6BF;
  --danger:#A9553F; --danger-tint:#F8ECE8;
  --warn-bg:#FBF4DE; --warn-border:#EBDCAA;
  --gold:#C08A17; --planned:#8A8DDF;
  --readable-bg:#EEF1F7; --readable-text:#4C5C88;
  --neutral-spine:#DAD7C8; --rejected-fill:#EEEDE5;
  --on-accent:#FFFFFF; --tab-text:#FFFFFF;
  --spine-1:#0072B2; --spine-2:#E69F00; --spine-3:#009E73; --spine-4:#CC79A7;
  --spine-5:#D55E00; --spine-6:#56B4E9; --spine-7:#8172B3; --spine-8:#B4A200;
  /* shape */
  --r-tag:5px; --r-inner:10px; --r-card:12px; --r-cta:14px; --r-sheet:22px; --r-pill:999px;
  --shadow-sheet:0 -8px 30px rgba(0,0,0,.25); --shadow-dialog:0 12px 40px rgba(0,0,0,.35);
  --font-display:'Bricolage Grotesque',sans-serif; --font-body:'Instrument Sans',sans-serif;
}
[data-theme="dark"] {
  --paper:#211F1A; --card:#2A2822; --panel:#26241F;
  --ink:#EDEAE0; --ink-soft:#9A9788; --ink-mid:#C4C1B2; --ink-disabled:#6E6B5E;
  --line:#3A382F; --dash:#4A4840; --ruling:#34322A;
  --accent:#7FB89A; --accent-tint:rgba(127,184,154,.15); --accent-disabled:#4A5F54;
  --danger:#C97B63; --danger-tint:rgba(201,123,99,.15);
  --gold:#E0B24A; --on-accent:#161511; --tab-text:#161511;
  --spine-1:#4FA3D9; --spine-2:#E8B84B; --spine-3:#3FC79A;
}
```

(Dark spine palette brightens slots 1–3 per README; slots 4–8 keep light values. Dark `--warn-bg/--warn-border/--readable-*`: extract from canvas turn-3 dark screens; if absent there, derive as alpha washes of the light values and note it.)

- [ ] **Step 2:** `base.css` — reset, `body{background:var(--paper);color:var(--ink);font:15px/1.45 var(--font-body)}`, max-width 430px centered app column, type utility classes: `.screen-title` (display 800 24px, letter-spacing -.01em), `.section-label` (display 800 12px uppercase +.12em), `.meta` (12.5px soft), `.hint` (11.5px), `.field-label` (11px uppercase +.1em 700). Index-card ruling helper class: `repeating-linear-gradient(transparent, transparent 26px, var(--ruling) 26px, var(--ruling) 27px)`.
- [ ] **Step 3:** `theme.ts`:

```ts
export type ThemePref = 'system' | 'light' | 'dark';
export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function watchSystemTheme(getPref: () => ThemePref) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getPref()));
}
```

- [ ] **Step 4:** Import fonts + both stylesheets in `main.tsx` (`@fontsource/bricolage-grotesque/400.css`, `/600.css`, `/800.css`; `@fontsource/instrument-sans/400.css` … `/700.css`). Render a token sample page in `App.tsx` temporarily; eyeball against screenshot `03`. Commit: `feat: Card Catalog design tokens, base styles, theme switching`.

### Task 3: Data types + IndexedDB layer

**Files:** Create `src/data/types.ts`, `src/data/db.ts`, `src/data/db.test.ts`.

- [ ] **Step 1:** `types.ts` — the complete data model (spec §Data Model):

```ts
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
}
export const DEFAULT_SETTINGS: Settings = {
  preferUnmade: true, theme: 'system', backupReminder: true,
  changesSinceBackup: 0, verifiedPagesOnly: false,
};
export const newId = () => crypto.randomUUID();
export const todayISO = () => new Date().toISOString().slice(0, 10);
```

- [ ] **Step 2 (failing test first):** `db.test.ts` with `fake-indexeddb/auto` imported at top: opening the DB creates stores `books, recipes, madeEntries, plans, categories, presets, attachments, settings`; `putAll`/`getAll` round-trips a Recipe. Run `npx vitest run src/data/db.test.ts` → FAIL (module missing).
- [ ] **Step 3:** `db.ts` — `openDB('pagetoplate', 1)` via `idb`, creating the 8 stores (keyPath `id`; `settings` keyed by literal `'app'`); indexes: recipes `by-book`, madeEntries `by-recipe`, `by-date`. Export typed helpers `getAll(store)`, `put(store, val)`, `bulkPut(store, vals)`, `del(store, id)`, `clearAll()`.
- [ ] **Step 4:** Test passes. Commit: `feat: data model types and IndexedDB layer`.

### Task 4: Category defaults (the 11) + synonym map — decision recorded in code

**Files:** Create `src/data/categories.ts`, `src/data/categories.test.ts`.

- [ ] **Step 1 (failing tests):** assert exactly 11 defaults in the order below; assert `'Appetizers & Small Plates'` is NOT among them; assert `mapRawCategory('Starters')` → `{ category: 'Sides', addTags: ['appetizer'] }`; `mapRawCategory('Desserts & Sweets')` → Desserts, no tags; `mapRawCategory(' Drinks ')` → Drinks; `mapRawCategory('Household Hints')` → `{ category: null, addTags: [] }`.
- [ ] **Step 2:** Implement:

```ts
// DECISION (owner, 2026-07-14): 11 default categories, not the spec's 12 —
// "Appetizers & Small Plates" merged into Sides (appetizer-vocab sections auto-tag
// "appetizer" so the distinction stays filterable); "Desserts & Sweets"→"Desserts";
// "Basics & Staples"→"Basics". Supersedes cookbook-app-spec.md §Category.
// The test in categories.test.ts fails if this list drifts.
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; chips: string[] }> = [
  { name: 'Mains',               chips: ['beef','chicken','pork','fish','seafood','vegetarian','pasta'] },
  { name: 'Sides',               chips: ['vegetable','potato','grain','appetizer','dip'] },
  { name: 'Soups & Stews',       chips: ['creamy','brothy','chili','stew'] },
  { name: 'Salads',              chips: ['green','grain','fruit'] },
  { name: 'Breakfast & Brunch',  chips: ['egg','pancake','muffin','oat'] },
  { name: 'Breads',              chips: ['yeasted','quick','flatbread','biscuit'] },
  { name: 'Desserts',            chips: ['chocolate','fruit','cake','cookie','pie'] },
  { name: 'Drinks',              chips: ['cocktail','coffee','tea','punch'] },
  { name: 'Sauces & Condiments', chips: ['sauce','dressing','salsa','chutney'] },
  { name: 'Preserves & Pickles', chips: ['jam','pickle','ferment','jelly'] },
  { name: 'Basics',              chips: ['stock','dough','spice blend'] },
];

const SYN: Record<string, string> = {
  'entrées':'Mains','entrees':'Mains','main dishes':'Mains','main courses':'Mains','primi':'Mains','secondi':'Mains',
  'side dishes':'Sides','vegetables':'Sides',
  'appetizers & small plates':'Sides','appetizers':'Sides','starters':'Sides','small plates':'Sides',
  "hors d'oeuvres":'Sides','hors d’oeuvres':'Sides','meze':'Sides','tapas':'Sides','antipasti':'Sides',
  'dim sum':'Sides','snacks':'Sides','canapés':'Sides','canapes':'Sides',
  'soups':'Soups & Stews','stews':'Soups & Stews','soups and stews':'Soups & Stews','chowders':'Soups & Stews',
  'breakfast':'Breakfast & Brunch','brunch':'Breakfast & Brunch',
  'rolls':'Breads','biscuits':'Breads',
  'desserts & sweets':'Desserts','sweets':'Desserts','puddings':'Desserts','cakes':'Desserts','pies':'Desserts',
  'cookies':'Desserts','confections':'Desserts','dolci':'Desserts',
  'beverages':'Drinks','cocktails':'Drinks',
  'sauces':'Sauces & Condiments','condiments':'Sauces & Condiments','dressings':'Sauces & Condiments','salsas':'Sauces & Condiments',
  'preserves':'Preserves & Pickles','pickles':'Preserves & Pickles','canning':'Preserves & Pickles',
  'jams':'Preserves & Pickles','jellies':'Preserves & Pickles',
  'basics & staples':'Basics','staples':'Basics','stocks':'Basics','fundamentals':'Basics',
};
const APPETIZER_SECTIONS = new Set(['appetizers & small plates','appetizers','starters','small plates',
  "hors d'oeuvres",'hors d’oeuvres','meze','tapas','antipasti','dim sum','snacks','canapés','canapes']);

export function mapRawCategory(raw: string, extraNames: string[] = []): { category: string | null; addTags: string[] } {
  const norm = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const addTags = APPETIZER_SECTIONS.has(norm) ? ['appetizer'] : [];
  const direct = [...DEFAULT_CATEGORIES.map(c => c.name), ...extraNames].find(n => n.toLowerCase() === norm);
  if (direct) return { category: direct, addTags };
  if (SYN[norm]) return { category: SYN[norm], addTags };
  return { category: null, addTags };
}
export const UNCATEGORIZED = 'Uncategorized';
```

- [ ] **Step 3:** Tests pass. Commit: `feat: 11 default categories + synonym mapper (decision record)`.

> **Chip defaults above are the owner-review proposal** (spec left them "to be tuned"). Owner reviews at Checkpoint 1; chips are user-editable in Settings regardless, so tuning later is cheap.

### Task 5: Memory-first Store + React hooks

**Files:** Create `src/data/store.ts`, `src/data/store.test.ts`.

- [ ] **Step 1 (failing tests):** with fake-indexeddb: `Store.init()` seeds the 11 categories on first run (and does NOT re-seed on second init); `addBook`/`addRecipes` persist and appear in a fresh Store after re-init; every mutation increments `settings.changesSinceBackup`; `subscribe` fires on mutation.
- [ ] **Step 2:** Implement `Store`: loads all stores into memory maps on `init()`; exposes typed getters (`books`, `recipes`, `plans`, `madeEntries`, `categories`, `presets`, `settings`), mutators (`addBook`, `updateBook`, `deleteBookKeepHistory`, `deleteBookHard`, `addRecipes`, `updateRecipe`, `deleteRecipe`, `addMadeEntry`, `updateMadeEntry`, `deleteMadeEntry`, `addPlan`, `updatePlan`, `savePreset`, `deletePreset`, `updateCategory`, `addCategory`, `deleteCategoryReassign(catId, targetName)`, `updateSettings`, attachments CRUD), each: mutate memory → persist via `db.ts` → `notify()`. Derived helpers: `madeCountFor(recipeId)`, `lastMadeFor(recipeId)`, `plannedRecipeIds()` (open plan items). React glue: `useStore(selector)` via `useSyncExternalStore`.
- [ ] **Step 3:** Tests pass. Commit: `feat: memory-first store over IndexedDB with change subscription`.

---

## Milestone B — Behavioral logic (spec rules pinned by tests)

### Task 6: Pills

**Files:** Create `src/logic/pills.ts`, `src/logic/pills.test.ts`.

- [ ] **Step 1 (failing tests, one per spec rule):** matching is case-insensitive substring over `name + ' ' + tags.join(' ')` (Rule 1: works with zero tags); multiple pills AND; `neg` pill excludes; `addPill` lowercases/trims/dedupes; `togglePill` flips `neg`; `removePill` removes by index.
- [ ] **Step 2:** Implement (port of prototype `matches` inner loop):

```ts
import type { Pill } from '../data/types';
export function recipeMatches(r: { name: string; tags: string[] }, pills: Pill[]): boolean {
  const hay = (r.name + ' ' + r.tags.join(' ')).toLowerCase();
  return pills.every(p => { const has = hay.includes(p.text); return p.neg ? !has : has; });
}
export const addPill = (pills: Pill[], text: string): Pill[] => {
  const t = text.trim().toLowerCase();
  return !t || pills.some(p => p.text === t) ? pills : [...pills, { text: t, neg: false }];
};
export const togglePill = (pills: Pill[], i: number): Pill[] => pills.map((p, j) => j === i ? { ...p, neg: !p.neg } : p);
export const removePill = (pills: Pill[], i: number): Pill[] => pills.filter((_, j) => j !== i);
```

- [ ] **Step 3:** Pass; commit: `feat: pill filter state machine and matching (spec rule 1)`.

### Task 7: Generation engine

**Files:** Create `src/logic/generate.ts`, `src/logic/generate.test.ts`.

- [ ] **Step 1 (failing tests):** seeded-rng tests pin: (a) eligibility excludes `excluded` recipes, archived books, unselected books, non-matching pills (Rules 2, 3); (b) prefer-unmade: with pool of 3 unmade + 3 made and count 3, all picks unmade; (c) exhausted → least-recently-made first (Rule 5): all-made pool orders by oldest `lastMade`; (d) partial pool returns all available + note text `Only 1 of 3 requested match your filters — showing what's available.` (Rule 9); (e) `regenerate` replaces only rejected cards, never re-deals session-rejected or currently-shown names, and emits `No more matches to replace N rejected — pool exhausted.` when dry; (f) filters scoped per category (a `beef` pill on Mains never affects Desserts) (Rule 2).
- [ ] **Step 2:** Implement — typed port of prototype `matches`/`pick`/`doGenerate`/`doRegenerate`:

```ts
import type { Recipe, Cookbook, CatConfig } from '../data/types';
import { recipeMatches } from './pills';

export interface Candidate extends Recipe { madeCount: number; lastMade?: string }
export interface GenGroup { category: string; want: number; cards: { recipe: Candidate; status: 'kept' | 'rejected' | 'never' }[]; note: string | null }
type Rng = () => number;

export function eligible(recipes: Candidate[], books: Cookbook[], bookIds: string[], category: string, pills: CatConfig['pills']): Candidate[] {
  const archived = new Set(books.filter(b => b.archived).map(b => b.id));
  return recipes.filter(r =>
    r.category === category && bookIds.includes(r.bookId) && !archived.has(r.bookId) &&
    r.status === 'active' && recipeMatches(r, pills));
}

export function pick(pool: Candidate[], count: number, preferUnmade: boolean, rng: Rng = Math.random): Candidate[] {
  const shuffle = <T,>(a: T[]) => a.map(x => [rng(), x] as const).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const ordered = preferUnmade
    ? [...shuffle(pool.filter(r => r.madeCount === 0)),
       // spec rule 5: cycle restarts preferring least-recently-made; shuffle-then-stable-sort randomizes ties
       ...shuffle(pool.filter(r => r.madeCount > 0)).sort((a, b) => (a.lastMade ?? '').localeCompare(b.lastMade ?? ''))]
    : shuffle(pool);
  return ordered.slice(0, count);
}

export function generate(recipes: Candidate[], books: Cookbook[], bookIds: string[],
    config: Record<string, CatConfig>, preferUnmade: boolean, rng: Rng = Math.random): GenGroup[] {
  return Object.entries(config).filter(([, c]) => c.count > 0).map(([category, c]) => {
    const picked = pick(eligible(recipes, books, bookIds, category, c.pills), c.count, preferUnmade, rng);
    return { category, want: c.count, cards: picked.map(recipe => ({ recipe, status: 'kept' as const })),
      note: picked.length < c.count ? `Only ${picked.length} of ${c.count} requested match your filters — showing what's available.` : null };
  });
}

export function regenerate(groups: GenGroup[], recipes: Candidate[], books: Cookbook[], bookIds: string[],
    config: Record<string, CatConfig>, sessionRejected: Set<string>, preferUnmade: boolean, rng: Rng = Math.random): GenGroup[] {
  return groups.map(g => {
    const kept = g.cards.filter(c => c.status !== 'rejected');
    const need = g.cards.length - kept.length;
    if (!need) return g;
    const shown = new Set(kept.map(c => c.recipe.id));
    const pool = eligible(recipes, books, bookIds, g.category, config[g.category]?.pills ?? [])
      .filter(r => !shown.has(r.id) && !sessionRejected.has(r.id));
    const repl = pick(pool, need, preferUnmade, rng);
    return { ...g, cards: [...kept, ...repl.map(recipe => ({ recipe, status: 'kept' as const }))],
      note: repl.length < need ? `No more matches to replace ${need - repl.length} rejected — pool exhausted.` : g.note };
  });
}

export const availability = (recipes: Candidate[], books: Cookbook[], bookIds: string[], category: string, pills: CatConfig['pills']) =>
  eligible(recipes, books, bookIds, category, pills).length;
```

(Session-reject keys on recipe `id`, not name as the prototype did — ids exist now. Reject stays session-only per Rule 3.)
- [ ] **Step 3:** Pass; commit: `feat: generation engine (spec rules 2,3,5,9)`.

### Task 8: Forgiving CSV parser

**Files:** Create `src/logic/csv.ts`, `src/logic/csv.test.ts`, `src/logic/fixtures/atk_sample.csv` (first 30 lines of `background/atk_index.csv`).

- [ ] **Step 1 (failing tests):** header row detected by presence of non-numeric page cell / header words (`page`, `recipe`, `name`, `category`, `keywords`/`tags`); headerless files assume column order `name,page[,category[,tags]]`; ATK column order (`Page Number,Recipe Name,Category,Keywords`) maps correctly by header names; quoted fields with commas survive; CRLF and stray whitespace tolerated (`"Drinks "` → `Drinks` after trim); tags split on `,`/`;` inside the keywords cell; full `background/atk_index.csv` parses to exactly 1645 rows (read fixture via `fs` in the test).
- [ ] **Step 2:** Implement `parseRecipeCsv(text: string): { rows: { name: string; page: string; category?: string; tags: string[] }[]; hadHeader: boolean }` — hand-rolled quote-aware splitter (~40 lines: state machine over chars, `""` escape), header mapping by fuzzy header names, positional fallback.
- [ ] **Step 3:** Pass; commit: `feat: forgiving CSV parser (handles real ATK export quirks)`.

### Task 9: Import mapper

**Files:** Create `src/logic/importer.ts`, `src/logic/importer.test.ts`.

- [ ] **Step 1 (failing tests):** (a) rows with `Appetizers & Small Plates` map to Sides and gain tag `appetizer`; (b) `Desserts & Sweets` → Desserts; (c) unrecognized categories are collected with counts for the preview UI, not silently created (Rule 7); (d) duplicate detection: same normalized name in the target book → action `skip` when page+category identical, `update` otherwise; brand-new → `add` (spec: "skip or update, never double-enter"); (e) tag-redundancy rule: keyword `chicken` on "Classic Chicken Noodle Soup" is dropped, tag `international` on it is kept; (f) re-running the same import plan yields zero `add`s.
- [ ] **Step 2:** Implement:

```ts
import { mapRawCategory, UNCATEGORIZED } from '../data/categories';
import type { Recipe } from '../data/types';
import type { parseRecipeCsv } from './csv';

export interface ImportRow {
  name: string; page: string; rawCategory?: string;
  category: string | null;                 // null ⇒ needs user mapping
  tags: string[]; action: 'add' | 'skip' | 'update'; existingId?: string;
}
export interface ImportPlan { rows: ImportRow[]; unrecognized: Map<string, number>; adds: number; skips: number; updates: number }

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function planImport(parsed: ReturnType<typeof parseRecipeCsv>['rows'], existing: Recipe[],
    categoryNames: string[], fallbackCategory?: string): ImportPlan {
  const byName = new Map(existing.map(r => [normName(r.name), r]));
  const unrecognized = new Map<string, number>();
  const rows = parsed.map(p => {
    let category: string | null; let addTags: string[] = [];
    if (p.category?.trim()) {
      const m = mapRawCategory(p.category, categoryNames);
      category = m.category; addTags = m.addTags;
      if (!category) unrecognized.set(p.category.trim(), (unrecognized.get(p.category.trim()) ?? 0) + 1);
    } else category = fallbackCategory ?? UNCATEGORIZED;
    const name = p.name.trim();
    // spec: never store a tag whose text already appears in the recipe name
    const tags = [...new Set([...p.tags, ...addTags])]
      .map(t => t.trim().toLowerCase()).filter(t => t && !name.toLowerCase().includes(t));
    const prior = byName.get(normName(name));
    const action = !prior ? 'add'
      : prior.page === p.page && (category === null || prior.category === category) ? 'skip' : 'update';
    return { name, page: p.page, rawCategory: p.category, category, tags, action, existingId: prior?.id };
  });
  return { rows, unrecognized,
    adds: rows.filter(r => r.action === 'add').length,
    skips: rows.filter(r => r.action === 'skip').length,
    updates: rows.filter(r => r.action === 'update').length };
}
export function resolveUnrecognized(plan: ImportPlan, mapping: Map<string, string>): ImportPlan {
  // mapping: rawCategory → chosen category name (existing, newly created, or UNCATEGORIZED)
  const rows = plan.rows.map(r => r.category === null && r.rawCategory && mapping.has(r.rawCategory.trim())
    ? { ...r, category: mapping.get(r.rawCategory.trim())! } : r);
  return { ...plan, rows, unrecognized: new Map() };
}
```

- [ ] **Step 3:** Pass; commit: `feat: import mapper — synonym nudges, appetizer auto-tag, dedupe, tag redundancy`.

### Task 10: Backup / restore + orphaned history

**Files:** Create `src/data/backup.ts`, `src/data/backup.test.ts`, `src/logic/orphans.ts`, `src/logic/orphans.test.ts`.

- [ ] **Step 1 (failing tests, backup):** export → restore into a cleared store reproduces books/recipes/plans/madeEntries/categories/presets/settings exactly (Rule: restore is replace); export JSON carries `schemaVersion: 1` (Rule 11); with attachments present, export is a zip (`fflate.zipSync`) containing `backup.json` + `photos/<id>`; restore of that zip restores blobs.
- [ ] **Step 2:** Implement `exportBackup(store): Promise<{ blob: Blob; filename: string }>` (JSON if no attachments, else zip; filename `pagetoplate-backup-YYYY-MM-DD.{json,zip}`) and `restoreBackup(store, file: Blob): Promise<void>` (detect zip by magic bytes `PK`, validate `schemaVersion`, `clearAll()` then bulk-load). On export success: `lastBackupAt = now`, `changesSinceBackup = 0`.
- [ ] **Step 3 (failing tests, orphans):** deleting a book with "keep history" nulls `recipeId` on its MadeEntries and snapshots `{bookTitle, recipeName, page}`; `findReassociation` matches a re-added book by fuzzy title (token-set Jaccard ≥ 0.5 over lowercased, punctuation-stripped, stopword-free tokens — stopwords `the a an of book cookbook`) and matches entries to new recipes by normalized name with page tiebreak; unmatched entries stay orphaned (never guessed).
- [ ] **Step 4:** Implement `orphans.ts` (`orphanBook`, `titleSimilarity`, `findReassociation(orphanEntries, newBook, newRecipes): { titleMatch: boolean; pairs: { entryId: string; recipeId: string }[] }`); wire `deleteBookKeepHistory` in store to it.
- [ ] **Step 5:** All pass; commit: `feat: versioned backup round-trip + orphaned-history re-association (spec rules 8, 11)`.

### Task 11: Image compression

**Files:** Create `src/logic/images.ts`.

- [ ] **Step 1:** `compressImage(file: Blob, maxEdge = 1200, quality = 0.82): Promise<Blob>` via `createImageBitmap` → offscreen canvas scale → `canvas.toBlob('image/jpeg', quality)`. (Browser-API-bound; verified in E2E/manual, not unit tests — note this as unrun-by-unit-tests.) Commit: `feat: photo compression for attachments`.

---

## Milestone C — App shell & component library

### Task 12: Shell, routing, providers

**Files:** Create `src/App.tsx` (replace placeholder), `src/components/BottomNav.tsx`, `src/components/Toast.tsx`.

- [ ] **Step 1:** App = `HashRouter`-style hash navigation (hand-rolled, ~30 lines: `useHash()` hook, routes `#/generate` (default) `#/plans` `#/browse` `#/books` `#/settings/*`); providers: Store init gate ("loading" splash until `init()` resolves), theme applied from settings, global `ToastProvider` (`showToast(msg, undoFn?)`, 3.5s timeout, ink pill bottom-center above nav, optional green Undo button — port of prototype `showToast`).
- [ ] **Step 2:** `BottomNav`: 4 tabs Generate/Plans/Browse/Books, Lucide icons (`dices`, `layout-list`, `search`, `library-big`) 18px, 11px/600 labels, active = accent + 700. Settings gear reachable from tab headers (top-right icon per canvas).
- [ ] **Step 3:** First-meaningful-use hook: after first book/import exists, call `navigator.storage.persist()` once; store result in `settings.persistGranted` (Rule 11).
- [ ] **Step 4:** Manual check: tabs switch, hash back/forward works, toast shows/undoes. Commit: `feat: app shell — hash routing, bottom nav, toast, persistent-storage request`.

### Task 13: Card Catalog component library

**Files:** Create in `src/components/`: `Pill.tsx`, `Chip.tsx`, `StatusTag.tsx`, `Stepper.tsx`, `Sheet.tsx`, `Dialog.tsx`, `SpineStripe.tsx`, `PageTab.tsx`, `SpineChip.tsx`, `OrderBadge.tsx`, `WarningNote.tsx`, `SegmentToggle.tsx`, `RecipeRow.tsx`.

Build each to the handoff README "Component vocabulary" + token values; visual reference = canvas + screenshots. Key contracts:

- [ ] **Step 1:** `Pill` (`{label, neg, onCycle, onRemove}`): rounded 999px, 12.5px/700; include = accent border/text on `--accent-tint`; neg = danger colors, label auto-prefixed "not "; body tap → `onCycle`; 18px circular × → `onRemove`. `Chip` (`{label, onAdd}`): line border, soft ink. `PillEditor` (composed in screens): pills + remaining chips + free-text input (Enter → `addPill`).
- [ ] **Step 2:** `Stepper` (`{value, onInc, onDec}`): pill-shaped, 38×36 accent +/− buttons, count 700 (disabled-gray at 0). `StatusTag` (`{kind: 'made'|'never'|'installed'|'readable'|'index-only'}`): 10.5px uppercase 700 radius 5px with per-kind tints. `WarningNote`: `--warn-bg`/`--warn-border`. `SegmentToggle`: generic two/three-segment chip row.
- [ ] **Step 3:** Book-color primitives: `SpineStripe` (7px left stripe, radius `12px 0 0 12px`), `PageTab` (hanging top-right tab `p. 142`, white—or `#161511` in dark—11px/700, radius `0 0 7px 7px`), `SpineChip` (14×44 spine + `inset -2px 0 0 rgba(0,0,0,.18)` shading; horizontal-striped variant for uninstalled), `OrderBadge` (24px numbered circle). Session palette helper `spineColor(orderIndex)` → `var(--spine-N)`.
- [ ] **Step 4:** `Sheet` (bottom sheet: radius 22px top, drag handle, dim+blur backdrop, slide-up transition, closes on backdrop tap/back) and `Dialog` (centered, `--shadow-dialog`). Both push a hash-history entry so Android back closes them.
- [ ] **Step 5:** `RecipeRow` (Browse/plan rows: spine stripe, name+page, meta line, optional StatusTag/rating). Temporary `#/dev` gallery route rendering all components in both themes; eyeball vs screenshots `01`,`06`,`07`. Commit: `feat: Card Catalog component library`.

---

## Milestone D — Generate wizard (hero flow; port of prototype logic)

State: wizard session lives in a React reducer scoped to the Generate tab (survives tab switches within a session): `{ step, sel: string[], cfg: Record<cat, CatConfig>, open: string|null, groups: GenGroup[]|null, sessionRejected: Set<string> }`. Book colors: `spineColor(sel.indexOf(bookId))` — deselect splices and colors reflow (prototype `toggle`).

### Task 14: Step 1 — books (screen 2a, screenshot 03)

- [ ] **Step 1:** Build `BooksStep`: kicker header + step counter, 3-segment progress bar (4px, green when reached), open-plans banner when any plan has open items (single line + "Plans →" link), title/sub copy exactly per README §2a, "⌕ Filter books…" field (substring filter on name), book cards (SpineChip, name 600, meta 12.5px = `N recipes · M made`, OrderBadge when selected, selected border = book color + `0 0 0 1px` spread), Presets dropdown pill (applies preset: sets `sel` + `cfg`), primary CTA 52px "Next: categories →" disabled at 0 books (`--accent-disabled`). Archived books never listed (Rule: archived hidden from generation).
- [ ] **Step 2:** Manual verify vs screenshot 03 incl. tap-order color reflow on deselect. Commit: `feat: generate step 1 — book selection with tap-order colors`.

### Task 15: Step 2 — categories & filters (screen 2b, screenshot 04)

- [ ] **Step 1:** Build `CategoriesStep`: data-driven rows from store categories (11 defaults + customs, ordered): bold name, live availability via `availability()` — `N match` in green when pills active, `N available` soft otherwise, recomputed per keystroke/pill change scoped to `sel` — Stepper, ⚲ filter button (green + count badge when pills active), active row = green border. Expanded panel (dashed top border, `--panel` bg): PillEditor with the category's chips + hint copy "Tap a pill to flip include ↔ not. Filters match recipe names and tags." Footer: primary `Generate N recipes →` (sum of counts; disabled at 0 with label "Set at least one count"), ghost "← Books" / "Save as preset" (name prompt dialog → `savePreset`).
- [ ] **Step 2:** Manual verify vs screenshot 04. Commit: `feat: generate step 2 — per-category counts and pill filters with live availability`.

### Task 16: Results (screen 1a, screenshots 01–02; prototype step 3)

- [ ] **Step 1:** Build `ResultsStep` on `generate()` output: title "Your picks" (never time-of-day), book legend (11×16 swatches), category groups (uppercase header + hairline + "2 of 2" count of non-struck cards), `RecipeResultCard` per pick: ruled index-card face, SpineStripe + PageTab in book color, name, meta `book · made N×|never made`, actions **Keep / Reject / Never** with exact state styling from prototype `renderVals` (kept = accent tint; rejected = `✕ Rejected — undo`, fill `--rejected-fill`, card 55% opacity + line-through; never = `Never — undo` danger tint). Never → `store.updateRecipe(status:'excluded')` + toast with Undo (Rule 3, Rule 8-undo); undo reverts status and card state. Partial-pool notes render as `WarningNote`. Footer: ghost `↻ Regenerate N rejected` (only when rejections exist) → adds rejected ids to `sessionRejected`, calls `regenerate()`; primary `Plan these N →` (disabled at 0 kept).
- [ ] **Step 2:** Manual verify vs screenshots 01 (light) and 02 (dark). Commit: `feat: results — keep/reject/never, regenerate, partial-pool notes`.

### Task 17: Plan creation + confirmation (prototype step 4)

- [ ] **Step 1:** "Plan these" → `store.addPlan({ acceptedAt: todayISO(), items: kept.map(...state:'open'), genContext: { bookIds: sel, config: cfg } })` (Rule 4: dated by acceptance). Build `PlanCreated`: green check disc, "Plan created", `Planned <date> · N recipes`, tappable recipe rows (chevron ›, opens RecipeCardSheet once Task 22 lands — until then a placeholder toast), primary "View plan in Plans →", ghost "Generate another" (keeps `sel`+`cfg`, clears `groups`+`sessionRejected`), reassurance line.
- [ ] **Step 2:** Manual verify. Commit: `feat: plan creation from wizard results`.

> **⛳ DEMO CHECKPOINT 1** — `npm run dev`; owner drives the wizard with real data (import ATK via a temporary seed script until Task 24: `node`-side script or a dev-only button calling `parseRecipeCsv` + `planImport` on `background/atk_index.csv`). Owner also reviews the proposed chip defaults and the ATK pack's exact book title here.

---

## Milestone E — Plans & making

### Task 18: Mark-as-made dialog (screen 3a, screenshot 09)

- [ ] **Step 1:** Build `MarkAsMadeDialog` (`{recipeId, onSaved}`): title + recipe line (SpineChip in current session/neutral color, name, **book bold**, page) + "Open page ↗" outline button in book color (linked-pack recipes only; unverified → search-inside URL); Date: single `Today · Jul 13 ▾` button → native-style calendar (`<input type="date">` styled); Rating: 10-cell grid of 44px buttons, selected filled accent; photo add tile (→ `compressImage` → attachment); notes field; primary `Save · Made <date> ✓`; borderless Cancel. Save → `addMadeEntry` (+ mark plan item made when opened from a plan, storing `madeEntryId`) → undo toast (deletes the entry + reverts plan item).
- [ ] **Step 2:** Manual verify vs screenshot 09 in dark. Commit: `feat: mark-as-made dialog`.

### Task 19: Plans tab — list (screen 2c, screenshot 05)

- [ ] **Step 1:** Build `PlansTab` list mode: List/Calendar SegmentToggle; stat strip (made this year / open plans / avg rating — display-font 17–18px numbers); plan cards `PLANNED JULY 11 · 3 RECIPES` + Share ↗ (`navigator.share` text `This week's menu: …` list, clipboard fallback); per-recipe rows (5×28 stripe — colors by position-in-plan using session palette, Made ✓ outline button → opens MarkAsMadeDialog → row shows filled `Made · 8/10`), Swap (re-pick from `genContext` pool for that category excluding plan's recipes; if no `genContext` — manual plans — pool = same category across the recipe's book; exhausted → toast), Dismiss (item `state:'dismissed'`, snackbar undo per UX Safeguards); plans with all items made/dismissed collapse at 75% opacity ("older plans").
- [ ] **Step 2:** Manual verify vs screenshot 05. Commit: `feat: plans tab — list, share, swap, dismiss, mark made`.

### Task 20: Plans tab — calendar (screen 2c bottom)

- [ ] **Step 1:** Build `CalendarView`: month grid with prev/next; **planned = violet ring outline (`--planned`), made = solid green dot**, inline legend; tapping a day shows a detail block under the grid (day name; "plan accepted" line with ring marker; made line with dot + rating). Data: plans by `acceptedAt`, MadeEntries by `date` (orphaned entries included — neutral spine, snapshot names).
- [ ] **Step 2:** Manual verify. Commit: `feat: plans calendar — cooking journal view`.

---

## Milestone F — Browse & the universal recipe card

### Task 21: Browse tab (screen 2d, screenshot 06)

- [ ] **Step 1:** Build `BrowseTab`: pill search field (pills live inside the field, ghost "⌕ add keyword…"; global flat matching per Rule 2); two collapsible dashed dropdowns `Books: N selected ▾` / `Categories: all ▾` — book chips with color swatches (session-order colors for selected, neutral otherwise), **"All books" chip first**, chips support not-state (e.g. "not Boston Cooking-School" in danger colors; a neg book chip excludes that book); status chip row Active / Made ✓ / Planned / Never make / ★ 8+; result count line; `RecipeRow` list (status tag, gold ★ rating = max of entries); excluded recipes at 60% opacity. Empty selections mean "all". Row tap → RecipeCardSheet (Task 22).
- [ ] **Step 2:** Manual verify vs screenshot 06 with ATK data (1,645 rows — confirm list stays snappy; virtualize with simple windowing only if it visibly janks). Commit: `feat: browse — global pill search, book/category dropdowns, status filters`.

### Task 22: Universal recipe card sheet (screen 2e, screenshot 07)

- [ ] **Step 1:** Build `RecipeCardSheet` in `Sheet`: one big ruled index card — editable title (✎ inline input); pill-shaped selectors for book (swatch; move recipe), category, page; Tags section = PillEditor writing to `recipe.tags` (Rule 12: two-tap fix for import misses); Attachments (thumbnails via object URLs + add tile → compressImage); History: each MadeEntry row (date · gold ★ · note quote) with edit ✎ (reopens MarkAsMadeDialog prefilled) and delete 🗑 (confirm); status row `Status: Active` + "Never make" ghost-danger toggle; linked-pack recipes: open-page action + page-status badge ("page unverified — may need searching" → search-inside fallback); custom recipes: recipe text block (editable). Footer: primary `✓ Mark as made` + outline `+ Add to plan` (`AddToPlanDialog`: pick open plan or create new manual plan — Rule 10). Caption "Edits save instantly · Undo" — every edit commits immediately with toast-undo (Rule 12).
- [ ] **Step 2:** Wire every recipe tap in the app (results, plan rows, browse rows, plan-created rows, calendar detail) to this sheet.
- [ ] **Step 3:** Manual verify vs screenshot 07; verify sheet never navigates away (backdrop + back button return to the same scroll position). Commit: `feat: universal recipe card — edit-in-place everywhere (spec rule 12)`.

---

## Milestone G — Books, import, packs

### Task 23: Books tab + book detail (screens 2f shelf part, 5c; screenshots 08, 16)

- [ ] **Step 1:** Build `BooksTab`: `My shelf · N` / `Library · N packs` segment chips (Library = Task 25); shelf rows: SpineChip (neutral — colors are session-scoped to generation), name, meta (recipe count · made count), Installed tag for pack books; "+ Add book" (name prompt → empty book) and "Import CSV" entry points.
- [ ] **Step 2:** Build `BookDetail` (5c): spine + editable title ✎ + meta; Book tags PillEditor (book-level tags inherited by recipes at search time — implement inheritance inside `recipeMatches` hay-building at call sites by appending `book.tags`); stat card (made / % explored = recipes with ≥1 entry ÷ total / avg rating / most-made); action list (Browse recipes → Browse pre-filtered to the book / Add recipe manually / Re-import CSV "never duplicates"); "Disable book" + "Delete…" pair with the recommended-over-delete caption. Delete flow (Rule 8): confirm dialog with two choices — "Delete everything" (strong warning) vs "Delete book, keep cooking history" (default; runs `orphanBook`). Manual add-recipe form: name, page, category, tags; "custom recipe" expander adds recipe text + attachments (`isCustom`).
- [ ] **Step 3:** On any book add (manual, CSV, pack), run `findReassociation` against orphaned entries; on title match, prompt `Found N past entries from '<title>' — reconnect them?` → apply pairs; unmatched stay orphaned.
- [ ] **Step 4:** Manual verify vs screenshots 08/16. Commit: `feat: books tab, book detail, disable/delete with orphaned history`.

### Task 24: CSV import flow + AI help page (screens 5a–5b, screenshots 14–15)

- [ ] **Step 1:** Build `AiImportHelp` (5a): 4 numbered steps with 30px green discs; mono prompt block + "⧉ Copy full prompt" (prompt text: instruct the chatbot to transcribe a photographed TOC/index into CSV `Recipe Name,Page,Category` using the 11 standard category names where possible; full copy drafted in-code); primary "Choose CSV file to import…" (file input `.csv`); reassurance line "Names + page numbers only — no recipe text is copied."
- [ ] **Step 2:** Build `CsvPreview` (5b): green summary note `312 recipes found · 11 categories · 0 duplicates` (from `planImport` — adds/updates/skips + distinct categories); **editable Book name field (✎)** (default: filename sans extension); **Book tags pill row** with caption "applied to every recipe, filterable everywhere"; unrecognized-category warning per raw value with count and mapping choices — `Map to <closest>` (best synonym/first category), `Create category`, `Uncategorized` — via `resolveUnrecognized`; sample table (first ~8 rows; unmapped rows flagged in danger); footer `Import N recipes` / Cancel. Import → create/update book, `addRecipes` per plan (skip/update honored), toast.
- [ ] **Step 3:** End-to-end manual test with the real `background/atk_index.csv`: expect 1645 parsed; `Desserts & Sweets`(303)→Desserts, `Appetizers & Small Plates`(9)→Sides+`appetizer`, `Basics & Staples`(1)→Basics, `"Drinks "`(2)→Drinks; zero unrecognized. Re-import same file → 0 adds. Commit: `feat: CSV import flow with preview, mapping, dedupe + AI help page`.

### Task 25: Content packs — format, ATK pack, Library UI (screen 2f, screenshot 08)

- [ ] **Step 1:** Define formats (documented in `tools/README.md`):

```jsonc
// public/packs/catalog.json
{ "catalogVersion": 1, "packs": [{
  "id": "atk-complete", "title": "<owner-confirmed ATK edition title>",
  "author": "America's Test Kitchen", "year": 2023, "country": "US",
  "cuisines": ["american"], "era": "modern", "type": "index-only",
  "recipeCount": 1645, "categories": ["Mains","Desserts","..."],
  "file": "packs/atk-complete.json", "version": 1
}]}
// pack file
{ "id": "atk-complete", "version": 1,
  "book": { "name": "…", "tags": [] },
  "recipes": [{ "name": "…", "page": "2", "category": "Soups & Stews", "tags": [] }] }
```

(Linked packs will add `"link": { "url": …, "pageStatus": … }` per recipe — schema slot exists now, pipeline deferred.)
- [ ] **Step 2:** Write `tools/build_pack.py`: `python3 tools/build_pack.py background/atk_index.csv --id atk-complete --name "<title>" --year 2023 -o public/packs/atk-complete.json` — applies the same normalization as the app importer (trim, old-12→new-11 remap incl. appetizer tag, keyword split + redundancy filter); prints category histogram for eyeball check; also updates `catalog.json` entry. Run it; verify output counts match Task 24's numbers.
- [ ] **Step 3:** Build `src/data/packs.ts`: `fetchCatalog()` (relative to `import.meta.env.BASE_URL`, cached in store meta with refresh), `installPack(id)` (fetch pack file → create book with `packId/packVersion` → import recipes through `planImport`/`addRecipes` → re-association check), `updatePack(id)` (non-destructive: add/correct recipes, never touching MadeEntries/tags/status of existing), `uninstallPack(id)` (archive if history exists, else delete — consistent with book rules).
- [ ] **Step 4:** Build `LibrarySection` in BooksTab (2f): catalog search + filter chips (Readable online / Index only / Era ▾ / Cuisine ▾); pack rows: installed = colored spine + green Installed tag; uninstalled = grayed striped neutral spine + muted badges + 44px Install outline button; badges "Readable online" vs "Index only — own the book"; meta `N recipes`; footer caption per README. Install → progress → un-grays.
- [ ] **Step 5:** Manual verify vs screenshot 08: install ATK pack on a fresh profile (wipe via devtools), generate from it. Commit: `feat: content packs — catalog, ATK index-only pack, library install flow`.

---

## Milestone H — Settings, dark mode, PWA, E2E

### Task 26: Settings screens (4a–4c, screenshots 11–13)

- [ ] **Step 1:** `SettingsHome` (4a): grouped cards — Generation (Categories / Filter chips / Saved presets / prefer-unmade toggle), Your data (Back up & restore — subtitle turns danger when `lastBackupAt` > 30 days: `Last backup 34 days ago — back up soon`; Import a book with AI help), About card (version from `package.json`, repo link, Internet Archive credit, license).
- [ ] **Step 2:** `ChipsEditor` (4b): one card per category, removable chips, custom chips (not in shipped defaults) highlighted green, "Restore defaults" link per category, "+ add chip", empty custom categories collapsed. `CategoriesEditor`: list + add/rename; delete prompts reassignment target (default Uncategorized). `PresetsEditor`: rename/delete presets.
- [ ] **Step 3:** `BackupRestore` (4c): warning note `Your data lives only on this device. Last backup: <date> — N days and M changes ago.`; Export card (primary; `navigator.share({files})` when supported, else download link); Restore card with explicit copy "**Replaces** everything — it does not merge." + confirm; 30-day reminder toggle; persistent-storage status line from `settings.persistGranted`. Backup nudge: on app open, if reminder on ∧ >30 days ∧ `changesSinceBackup > 0` → toast linking here.
- [ ] **Step 4:** Manual verify vs screenshots 11–13. Commit: `feat: settings — chips/categories/presets editors, backup & restore`.

### Task 27: Dark mode + theme pass

- [ ] **Step 1:** Add theme selector (System/Light/Dark) to Settings About/Generation card area; `applyTheme` on change + system watcher. Sweep every screen in dark against screenshots 02/09/10: primary buttons flip to dark text `#161511`, page-tab/badge text dark on brightened spines 1–3, tints become alpha washes. Fix stragglers (grep for hex literals outside `tokens.css` — there should be none). Commit: `feat: dark mode across all screens`.

### Task 28: PWA polish + icons

- [ ] **Step 1:** Create `public/icons/`: simple index-card + spine-stripe mark (hand-authored SVG → export 192/512/maskable PNGs via `npx sharp-cli` or equivalent); favicon.svg.
- [ ] **Step 2:** `npm run build && npm run preview` — verify: installable (Chrome desktop + Android), offline reload works (service worker precache), manifest colors match paper. Test at 390px viewport. Commit: `feat: PWA manifest, icons, offline precache`.

### Task 29: Playwright core-loop E2E

**Files:** Create `playwright.config.ts`, `e2e/core-loop.spec.ts`, `e2e/fixtures/mini.csv` (12 recipes across 4 categories incl. one `Appetizers & Small Plates` row and a duplicate pair).

- [ ] **Step 1:** Config: chromium, mobile viewport 390×844, `webServer: npm run preview` against built app.
- [ ] **Step 2:** Spec (one long journey, asserting the spec's core loop): import `mini.csv` via Books → CSV flow (assert preview counts; assert appetizer row shows category Sides) → Generate: select book, set Mains 2 + Desserts 1 with pill `chocolate`, assert live availability text → results show 3 cards grouped → reject one → regenerate replaces only it → never-make one → assert toast + Browse shows it excluded → plan the rest → Plans tab shows plan → mark one made (rating 8) → row shows `Made · 8/10` → calendar shows dot on today → recipe card opens from Browse, edit a tag, reload page, tag persisted (IndexedDB survives) → export backup downloads a file.
- [ ] **Step 3:** `npx playwright test` green. Commit: `test: E2E core loop`.

> **⛳ DEMO CHECKPOINT 2** — full app on `npm run preview`; owner review on desktop + phone (dev-server over LAN or `vite preview --host`) before anything is pushed.

---

## Milestone I — Ship

### Task 30: Deploy to GitHub Pages

**Files:** Create `.github/workflows/deploy.yml`.

- [ ] **Step 1:**

```yaml
name: Deploy to GitHub Pages
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vitest run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2:** Update root `README.md` (what/why, live URL, screenshots pointer, tools/ usage, contributing packs). Commit all; push to `main`; enable Pages (Source: GitHub Actions) — via `gh api` or note for owner if permissions block it.
- [ ] **Step 3:** Verify live: `https://greenwoodms06.github.io/PageToPlate/` loads, installs on the owner's Android phone, ATK pack installs, wizard generates. Anything unverifiable from WSL (real-device install) is named and handed to the owner explicitly.
- [ ] **Step 4:** Soul record: append witness entry (P2P-001…) covering the interview decisions + what shipped + what remains unrun; capture the deferred pack-pipeline work in `ideas.md`. Commit: `docs: witness entry for v1 build`.

---

## Self-review notes (spec coverage check)

- Rules 1–12 each pinned: 1→T6, 2→T7/T21, 3→T7/T16, 4→T17, 5→T7, 6→T14 (palette cap 8, `orderIndex % 8`), 7→T4/T9/T24, 8→T10/T23, 9→T7/T16, 10→T22 (AddToPlanDialog), 11→T10/T12/T26, 12→T22.
- Out of scope honored: no shopping lists, no multi-user, no merge-restore.
- Deferred (named, not dropped): archive.org linked-pack pipeline + verified/unverified tooling (schema slots exist: `Recipe.link`, pack `link` field, `verifiedPagesOnly` setting + generation filter hook when linked packs exist); AI region-pass prompt file absent from handoff (flagged in tools/README).
- Known unrun-by-unit-tests: `compressImage` (browser API; covered manually + E2E photo step optional), share-sheet paths (device-dependent; manual on Android at checkpoint 2).

## Post-deploy amendments, round 2 (owner, 2026-07-16, after pack launch)

Verified (no change): Browse search already includes recipe tags AND book tags
(recipeMatches hay = name + recipe.tags + book.tags, BrowseTab.tsx:144).

1. **Generate:** remove the tap-order number badge (color still derives from
   sel.indexOf(id); ordering unaffected). DONE.
2. **Plans — made cue:** each planned recipe's "Made ✓" starts greyed/outline,
   turns solid green once that item is marked made (glance = what's left to cook).
3. **Plans — filtering:** reuse Browse's pill pattern — keyword (over recipe+book
   tags), book/category dropdowns, rating filter — with the status row swapped for
   **Made / Not yet made WITHIN the plan**, plus a **date filter**: preset ranges
   (This month / Last 3 months / This year / **All** — All must be one easy tap) +
   optional custom from–to. Filters which plans (and/or rows) show.
4. **Books — filters on BOTH segments:** the filter row (search, cuisine, era)
   must work on **My shelf** as well as **Library**, so large collections stay
   searchable.
5. **Books — cuisine filter:** dynamic multiselect (include/not/inactive pattern),
   auto-built from the cuisines present in installed books + catalog (no static list).
6. **Books — era filter:** a **year range with dynamic min/max derived from the
   actual books** in the collection (not hardcoded buckets).
7. **Books — metadata + links:** add optional `author?`, `year?`, `infoUrl?` to
   Cookbook (populate from catalog on pack install). Book card shows author/year.
   "Buy / more info" link is smart per type: linked packs → "Read free on
   archive.org" (archive.org/details/{archiveId}); index-only + user books →
   "Find this book" (title+author web search); user books may set their own infoUrl.
   Affiliate (Amazon Associates) deferred — plain links now, add tag later.
8. **Library — book cards:** tapping any pack (installed OR uninstalled) opens a
   book card showing its metadata (+ links), same card used from the shelf.
