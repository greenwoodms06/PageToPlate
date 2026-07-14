# Cookbook Recipe Randomizer — Design Specification

## Purpose

A progressive web app (PWA) that helps people use their physical cookbooks more effectively. Users catalog recipe names and page numbers from their cookbooks, and the app randomly selects recipes to make based on the user's chosen books, categories, counts, and keyword filters — prioritizing recipes they haven't made yet so they work through their whole collection. The app tracks what was made and when, with photos, ratings, and notes, and supports user-created custom recipes.

## Platform & Architecture

- **Target:** Progressive web app, hosted as a static site on GitHub Pages (installable, offline-capable).
- **No backend.** All data is stored client-side in IndexedDB. Data is device/browser-local.
- **Build directly in HTML/JS (or React).** Do not prototype in Python; the web prototype becomes the product.
- **Backup/restore is a first-class feature** (see Data & Backup) since there is no server sync.
- **Photos are compressed/resized on upload** (e.g., max ~1200px on the long edge) to keep IndexedDB and backup files manageable.
- **No in-app AI.** A static site cannot hide an API key, so AI-assisted book entry is deferred. Instead, a help page provides copy-paste instructions: photograph the cookbook's table of contents, paste it into an AI chatbot with a provided prompt, save the output as CSV, and import it.

## Data Model

**Cookbook**
- name (editable at import time and any time after, from book detail)
- optional book-level tags (e.g., "chinese", "weeknight") — every recipe in the book inherits them for filtering/search, so section- or book-wide traits are filterable even when recipe names don't carry them; editable at import time and from book detail
- archived flag (may be labeled "Disabled" in UI) — archived books are hidden from generation and book selection, but all recipes and history are preserved and remain visible in Browse. This is the recommended path for "done with this book" or a returned library book.
- **Deletion (soft by default):** deleting a book with history offers two choices — "Delete everything" (hard delete, strongly warned) or "Delete book, keep cooking history." The latter removes the book and its recipes from Browse/generation but preserves MadeEntries as **orphaned history**: still visible in the calendar/journal with a neutral spine, displaying the book title and recipe names as text snapshots captured at delete time.
- **Re-association:** whenever a book is added (CSV import, manual entry, or pack install), the app checks orphaned history for a fuzzy book-title match and prompts to reconnect (e.g., "Found 12 past entries from 'Joy of Cooking' — reconnect them?"). Recipes match by normalized name with page number as a tiebreaker; unmatched entries remain orphaned rather than being guessed. Also covers re-importing a book with a cleaner CSV.
- recipes (one-to-many)

**Recipe**
- name
- page number
- book (foreign key)
- category (from the app-level category list; fallback "Uncategorized")
- optional tags (user-added, never required)
- status: `active` | `excluded` ("never make" — hidden from generation, reversible from Browse)
- optional attachments (photos/files) on **any** recipe — notably a photo of the cookbook page itself, so users can cook from their phone without the physical book
- isCustom flag; custom recipes additionally store recipe text (attachments use the same mechanism as above)

**Plan**
- acceptance date (auto-stamped when the user confirms "Plan these"; this is the plan's date — it is *not* a target cook date)
- list of planned recipes, each individually markable as made or dismissable
- plans are retrievable and editable later (swap recipes, dismiss, mark items made)

**MadeEntry** (one recipe → many entries, enabling remakes)
- recipe (foreign key)
- date made (user-entered when marking done; defaults to today, editable for backfilling)
- rating (1–10)
- photos
- notes

**Category** (app-level, shared across all books)
- **Guiding principle: categories describe a recipe's role in a meal** — never cuisine, technique, diet, or ingredient (those belong to tags and keyword filters; the book itself carries nationality/focus). Meal-role is the one taxonomy that maps across cookbooks of any nationality or specialty.
- Default set (12): **Mains; Sides; Soups & Stews; Salads; Appetizers & Small Plates** (meze, tapas, antipasti, dim sum, snacks); **Breakfast & Brunch; Breads** (incl. flatbreads, tortillas, biscuits); **Desserts; Drinks** (cocktails, cordials, coffee/tea); **Sauces & Condiments** (salsas, chutneys, dressings, spice blends); **Preserves & Pickles** (jams, canning, ferments — heavily used by historical books); **Basics & Staples** (stocks, doughs, building-block recipes).
- Each recipe belongs to exactly **one** category; overlap is expressed with tags (e.g., a breakfast bread is Breads + tag "breakfast," curator's judgment).
- The CSV/pack import mapper ships with **synonym nudges** ("Entrées"→Mains, "Starters"→Appetizers & Small Plates, "Puddings"→Desserts, "Primi"→Mains, etc.) so varied book vocabularies converge on the standard list instead of spawning near-duplicates.
- Considered and deliberately excluded from defaults: a separate "Pasta, Noodles & Rice" category (violates the meal-role principle and creates classification ambiguity) — users who want it add it as a custom category.
- Users can add custom categories; custom categories behave identically to defaults everywhere (import, generation, browse)
- Deleting a category with recipes prompts reassignment; fallback bucket is "Uncategorized" (also the home for unmappable material, e.g., historical household-hints chapters)

**Per-category filter chips**
- Each category has its own set of quick-filter chips shown in that category's filter panel in the generate flow (and reusable in Browse when that category is selected).
- The app **ships with sensible defaults per category** (e.g., Mains: beef, chicken, pork, fish, vegetarian; Desserts: chocolate, fruit, cake; Soups & Stews: creamy, brothy; Preserves & Pickles: jam, pickle, ferment...) — exact defaults to be tuned.
- Users can add, remove, or edit any category's chips in Settings; custom categories start with an empty chip set. Chips are just stored search strings behind the same pill mechanism.

## Core Loop: Generation Flow

A linear wizard with a progress indicator; back navigation preserves selections.

1. **Book selection** — multi-select cookbook cards. Each selected book is assigned a color **by selection order** (colors are not permanently bound to books). Palette: ~8 distinct, colorblind-friendly colors; if more are ever needed, extend with a secondary scheme (e.g., striped borders) — not expected to be common.
2. **Category & count** — choose categories and, **per category**, set how many recipes to generate and attach keyword filters. Filters use the same **pill mechanism as Browse**: saved chips toggle on with a tap, and free-typed keywords become pills on return; tapping any pill/chip cycles it between include and "not" (exclude), and × removes it. Multiple pills combine (AND), so a category can require *chicken + not fried*. Filters are scoped to their category — "beef" on Main Dishes never affects Desserts. A request is therefore a nested structure: books → [{category, count, keyword pills}]. Show **live availability per category** as its filters/count change (e.g., "7 recipes match") so users see each pool before generating.
   - **Saved presets:** the full nested configuration (books + per-category counts and keywords) can be saved as a named preset (e.g., "Weeknight dinner") for one-tap rerun from the Generate tab.
3. **Generate** — random selection respecting all filters:
   - **Keyword filtering is substring matching against recipe names** (plus optional tags if present). No tagging is required for filtering to work. Show a UI hint: "filters match recipe names and tags."
   - **Prefer unmade recipes.** Selection draws from recipes with no MadeEntry first. If all matching recipes in a category have been made, automatically start a new cycle preferring least-recently-made.
   - `excluded` recipes and recipes from archived books never appear.
   - **Partial results:** if the requested count exceeds the matching pool (e.g., 3 beef mains requested, 2 exist), return what's available with a clear note — never fail silently or error out.
4. **Results** — recipes grouped by category, each card color-coded (border/chip) by source book, showing name, book, and page. Per-card actions:
   - **Keep** / **Reject** — "Regenerate" replaces only rejected cards, still honoring all criteria. Rejected recipes are excluded for the rest of the session only (not persisted, not marked).
   - **Never make** — sets status to `excluded` (reversible later in Browse).
5. **Plan these** — confirming creates a Plan object stamped with today's date and deep-links/badges to the Plans tab.

## Navigation & Screens

Bottom nav with four tabs; settings behind a gear icon.

**Tab 1 — Generate** (default landing tab)
- The wizard above (screens 1–4 + confirmation)
- A badge/card at top when open plans exist ("3 planned — mark made or dismiss"), linking to Plans

**Tab 2 — Plans**
- Reverse-chronological list of plans by acceptance date ("Planned July 11 — 5 recipes")
- Tap into a plan to edit: swap recipes, dismiss the plan or individual items, or mark individual recipes made (quick dialog: date made defaulting to today, rating, photos, notes) — supports batch catch-up when users return much later
- **Calendar view toggle:** month grid with two visually distinct markers — days plans were accepted vs. days recipes were made. Tap a day to see details. Doubles as a backward-looking cooking journal.
- **Share plan as text:** export any plan as a simple text list ("This week's menu: ...") via the native share sheet.
- Small summary stat card (e.g., "14 recipes made this year")

**Tab 3 — Browse** (library/filter mode)
- Full recipe list with search and filters. To keep the screen uncluttered, **book and category selection live in collapsible dropdowns** ("Books: all ▾" / "Categories: 2 selected ▾") that expand to multi-select chips (books shown with their colors) and collapse again — empty selection means "all." **Keyword search uses pills:** typing a word and pressing return adds it as a pill; tapping a pill toggles it between include and "not" (exclude); an × dismisses it. Multiple pills combine (AND), enabling queries like *chicken + not fried*. Status (active / made / planned / excluded) and rating filters round it out. This is where "filter to my favorites to remake" lives. Unlike generation, Browse filters combine flatly (search cuts across the selected books/categories).
- **Recipe detail = the universal recipe card** (see its definition after the tab list). Browse is its most common entry point, but the identical card opens from anywhere.

**Tab 4 — Books**
- Book list: add/edit/disable(archive)/delete, recipe counts (disable is the default suggestion; delete offers "keep cooking history," and hard delete is strongly warned)
- **Book detail / import:**
  - CSV import (see below)
  - Manual "add recipe" form (name, page, book, category); expands for custom recipes to include recipe text and file/photo attachments
  - Per-book stats: recipes made, % of book explored, most-made, average rating

**Settings (gear icon)**
- Manage custom categories, **per-category filter chips** (edit/restore the shipped defaults, add your own), and saved generation presets
- Backup / Restore
- AI-extraction help page with the copy-paste prompt workflow
- **About:** app version, link to the GitHub repo (source, issues, contributing packs), donate/support link, credits (e.g., Internet Archive for linked content packs), license

## The Universal Recipe Card

One shared component, opened by tapping a recipe **anywhere in the app** — generation results, plan items, Browse rows, book views, calendar entries. Same card everywhere; context only changes which action is most prominent.

**Everything on it is viewable AND editable in place:**
- Name, page number, book (move to another book), category (reassign)
- **Tags:** the same pill editor used in filters — add by typing, remove with ✕. This is the primary remedy for imperfect bulk imports: when a filter misses or mislabels a recipe, the user fixes it in two taps right where they noticed it.
- Status: active / excluded ("never make"), toggleable
- Attachments: add/remove photos or files (e.g., the cookbook page photo)
- History: every MadeEntry listed with date, rating, photos, notes — each **editable and deletable** (fix a wrong date, revise a rating)
- For custom recipes: the recipe text itself
- For linked pack recipes: the open-page / search-in-book action and page-status badge

**Actions:** Mark as made (quick dialog: date defaulting to today, rating, photos, notes) · Add to plan (existing open plan or new) · Delete recipe (confirmed; history handling follows the orphaning rules)

**Behavior:** edits save immediately with snackbar undo (no Save button); the card is a sheet/overlay so it never loses the user's place in whatever list they came from.

## CSV Import

- **Minimal required columns:** `recipe name, page`
- **Optional `category` column.** If present, use it; if absent, apply the book + category chosen in the upload dialog (so one-CSV-per-category and whole-book-in-one-CSV both work). Design leaves room for an optional `tags` column later.
- **Unrecognized category values:** prompt the user to map to an existing category or create a new one — nudge toward standard categories; never silently create near-duplicates ("Mains" vs "Main Dishes"). Fallback: "Uncategorized."
- **Preview before commit:** "47 recipes found" with a sample, confirm/cancel.
- **Duplicate detection** on re-import to the same book: skip or update, never double-enter.
- **Forgiving parsing:** tolerate stray whitespace, quoted names containing commas, and header row present or absent (AI-generated CSVs vary run to run).

*Lessons from the first real import (1,645-recipe compendium):*
- **Companion-recipe phenomenon:** cookbooks print accompaniments (pan sauces, gravies, dressings, compound butters, croutons) inside the chapter of the dish they accompany, so a naive section-based import files ~15% of recipes under the wrong meal-role category. Cleanup uses a **head-noun heuristic** — classify by the words before "with"/"for" and outside parentheses — so "Stir-Fried Beef *with Oyster Sauce*" stays a Main while a standalone "Scallion Dipping Sauce" is flagged for Sauces & Condiments.
- **Keyword redundancy rule:** never store a tag whose text already appears in the recipe name (filters substring-match names, so it adds nothing). Do store section-level tags the names don't carry — e.g., "international" on a mixed international chapter, so it's filterable even for recipes named in English.
- **Deterministic scripts for structure, AI for dish knowledge.** Region/cuisine tagging (small fixed vocabulary: italian, french, european, asian, indian, mexican, latin, middle eastern, african, caribbean, plus "international" as the umbrella) is done as an **AI pass over the CSV**, not by keyword matching — only an LLM knows Carbonara is Italian or Karaage is Japanese. Pipeline order: organize → enrich (script) → AI region pass → apply reviewed recategorizations. The AI pass prompt lives in `tools/` alongside the scripts.
- **Human-review pattern for bulk cleanup:** auto-apply only safe fixes (category-name normalization, keyword dedupe/redundancy removal); write ambiguous recategorizations to a small review CSV with a YES/NO Accept column, then apply accepted rows in a second pass. Turns reviewing ~1,600 rows into scanning ~300 proposals.
- **Tooling lives outside the app:** these pre-import scripts (organize, enrich/review/apply) ship in a `tools/` folder of the repo with usage docs — the app itself stays a simple CSV consumer. In-app import may later adopt the same synonym nudges and optionally the head-noun flagging, but v1 keeps cleanup external.

## Data & Backup

- **Backup:** one-tap export of everything to a single file — JSON for data; if photos exist, bundle JSON + photos as a zip — delivered via the native share sheet so users can save to their phone or Google Drive.
- **Restore:** import that file to fully rebuild state. Restore is a **replace**, not a merge — say so clearly in the UI.
- Include export/import from v1; it is the only data-loss protection in a backend-less app.
- **Request the Persistent Storage API** (`navigator.storage.persist()`) on first meaningful use — iOS Safari can evict IndexedDB from unused sites, which would be catastrophic here.
- **Backup nudge:** gently prompt when data has changed and no backup has been made recently (e.g., "You haven't backed up in 30 days").
- **Version the backup format:** include a `schemaVersion` field in exports so future app versions can migrate old backup files.

## UX Safeguards

- **Undo on destructive one-tap actions:** "never make," "mark as made," plan dismissal, and recipe rejection should offer a snackbar-style undo; permanent deletions (book, recipe, plan) require confirmation.

## Content Packs (curated cookbook library)

Pre-built recipe indexes users can install instead of typing or importing CSVs. Hosted in the app's own GitHub repo (same origin — no CORS issues, no third-party runtime dependency).

**Two pack types:**
- **Linked packs (public domain):** books from open archives (e.g., the Internet Archive's Cookbook and Home Economics Collection, largely pre-1931 US public domain, already OCR-digitized). Each recipe carries a deep link to its exact page in the archive's online reader (e.g., `archive.org/details/{book-id}/page/{n}`), so these books are fully cookable in-app without owning them. Only clearly public-domain works are curated; access-restricted/lending-library items are excluded.
  - **Per-recipe page status:** `verified` (deep link resolved against the book's page mapping) or `unverified` (recipe confirmed present, but the page couldn't be resolved — shown with an asterisk/badge like "page unverified — may need searching"). Unverified recipes still participate everywhere; their "open" action falls back to the reader's **search-inside** pre-loaded with the recipe name (exact URL parameter to be confirmed at build time), so hunting is usually one tap. Generation offers an optional **"verified pages only"** toggle for linked books (default off).
- **Index-only packs (modern, in-copyright books):** recipe names, page numbers, and categories only — factual index data, no links, no content. Value: owners of the physical book skip manual data entry entirely.

**Two-tier architecture:**
- `catalog.json` — one lightweight file listing every pack's metadata: id, title, author, publication year, country, cuisine(s), era, categories covered, recipe count, pack type (linked / index-only), pack file URL, pack version. Downloaded once (and refreshed periodically); all catalog search/filtering is client-side, so it stays instant with no backend even at thousands of entries.
- Individual pack files (JSON: book metadata + recipe list with name, page, category, optional tags, optional per-recipe deep link) — fetched only on install.

**Library UI:** a "Library" section in the Books tab (and from the add-book flow). Uninstalled packs render grayed out with an install affordance; tapping one fetches the pack and imports it automatically — the book un-grays and becomes a first-class book everywhere (generation, colors, tracking, browse). Catalog filters: text search, year range, country, cuisine, era, pack type, category coverage. Start as a section within Books; once the catalog grows past a few dozen packs, promote it to its own full screen (reached from Books) — the interaction model stays identical.

**Behavior of installed packs:**
- Recipes from linked packs show an "open page" action on recipe cards and in recipe detail (opens the archive reader at that page).
- Installed packs record their pack id + version; when the catalog lists a newer version, offer a non-destructive update (add/correct recipes without touching the user's MadeEntries, tags, or statuses).
- Uninstalling a pack archives it rather than deleting if any history exists (consistent with the book-archiving rule).
- Users can add their own recipes/tags to pack books like any other book.

**Curation pipeline (outside the app):** packs are produced with the same AI-assisted workflow users already use for CSVs (OCR'd tables of contents → cleaned index), stored as files in a `packs/` folder in the repo, and validated by a schema check in CI. Community contributions arrive as pull requests. Note: OCR of older books is messy; every pack needs a human sanity pass before merging.

*Verified technical basis (archive.org):*
- Every scanned item auto-derives machine-readable text: `{id}_djvu.txt` (plaintext), `{id}_djvu.xml` (word bounding boxes), and `{id}_hocr.html` (recommended OCR parse format), all at predictable `archive.org/download/{id}/...` URLs — no scraping of page images needed.
- The advanced search API returns bulk metadata (identifier, title, creator, date, subject, rights) for an entire collection as JSON/CSV, so `catalog.json` can be **seeded programmatically** from `collection:cbk` filtered to public-domain items, then enriched by hand (cuisine, era tags).
- Printed page ≠ scan leaf: each book's Book Data exposes a `pageNums` array mapping every leaf to its printed page-number string (may be empty where detection failed). Reader URLs accept printed page numbers or the unambiguous index form (`/page/n{index}`); the pipeline resolves printed TOC numbers to the index form for reliable deep links.
- **Triage step (no "has recipe index" flag exists):** for each candidate book, fetch `_djvu.txt`; detect a CONTENTS/INDEX section with *name … number* line patterns; verify the numbers resolve against `pageNums`; score OCR quality. Recipes whose pages resolve are marked `verified`; recipes confidently present but unresolvable are kept and marked `unverified` rather than dropped. Books passing overall → auto-draft pack for human review; books failing entirely → flag "needs manual curation" in a worklist. This lets the whole collection be processed unattended with a clear list of what remains.

## Deferred / Future (v2+)

- In-app AI extraction of tables of contents (blocked on key management; revisit if browser-native AI APIs mature or a lightweight proxy becomes acceptable)
- Multi-device sync via a free-tier backend (e.g., Supabase/Firebase) if demand appears
- Optional `tags` column in CSV import
- Dedicated analytics screen (data model already captures everything needed: MadeEntries with dates and ratings)

## Explicitly Out of Scope

Do not build these — the app intentionally excludes them:

- **Shopping lists and ingredient scaling** — the app only knows recipe names and page numbers, not ingredients
- **Multi-user / household accounts** — single-user, single-device by design
- **Merging data across devices** — restore replaces state; it does not merge two divergent datasets

## Key Behavioral Rules (summary)

1. Filtering never requires tags; it substring-matches recipe names, with tags as an optional supplement.
2. **Generation filters are scoped per category** (a "beef" filter on mains never hides desserts); Browse search is intentionally global and flat.
3. Rejected-in-session recipes are only excluded for that session; "never make" is the persistent exclusion, always reversible in Browse.
4. Plans are dated by acceptance, not by intended cook date; made-dates are added later per recipe.
5. Generation prefers unmade recipes, then least-recently-made when a filter set is exhausted.
6. Colors follow selection order per session, capped at ~8 accessible colors.
7. Categories are one shared app-level list (defaults + custom); imports are nudged to map onto it.
8. Disable (archive) books instead of deleting; history is sacred — delete defaults to keeping orphaned history, which can be re-associated by fuzzy name matching when a book returns; hard delete always warns; one-tap destructive actions always offer undo.
9. If the filtered pool is smaller than the requested count, return partial results with a note; never fail silently.
10. Plans can be created manually from Browse, not just via the randomizer.
11. Request persistent storage on first use and nudge periodic backups; backups carry a `schemaVersion`.
12. Tapping a recipe anywhere opens the same universal recipe card; all recipe metadata (tags, category, page, book, status, history entries) is editable in place with instant save + undo.
