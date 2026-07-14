# Handoff: PageToPlate — mobile-first cookbook PWA

## Overview
PageToPlate helps people actually use their physical cookbooks. Users catalog recipe names + page numbers, the app randomly picks recipes ("2 mains, 1 dessert from these 3 books"), tracks what was made (dates/ratings/photos/notes), and offers installable content packs of public-domain cookbooks readable online via archive.org deep links.

`cookbook-app-spec.md` (included) is the **source of truth for features, flows, and behavioral rules**. This README covers the visual design and interaction layer.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's environment**. Per the spec: this is a static-site PWA (GitHub Pages, IndexedDB, no backend) built directly in HTML/JS or React — if no codebase exists yet, plain React (or Preact) with no CSS framework is a fine choice; the design uses simple flat styles throughout.

- `PageToPlate Directions.dc.html` — the full design canvas. **Turn 2 is the approved deep dive** (direction "1a Card Catalog"); turn 3 adds the mark-as-made dialog + dark mode; turn 4 Settings; turn 5 AI import + book detail. Turn 1 is the historical direction bake-off (1b/1c were NOT chosen — ignore their styles).
- `PageToPlate Wizard Prototype.dc.html` — a working interactive prototype of the Generate wizard (the hero flow). Its logic class is a readable reference implementation of tap-order colors, per-category pill filtering, live availability counts, prefer-unmade selection, partial results, keep/reject/never, and regenerate-rejected.
- `cookbook-app-spec.md` — full product spec.

Note: `.dc.html` files contain the designs as inline-styled HTML inside `<x-dc>` tags; all style values below are also readable directly in those files.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and copy are final intent; recreate pixel-perfectly. The one deliberately unfinished element: image placeholders (diagonal-striped boxes labeled in monospace, e.g. "book page photo") stand in for user photos.

## Design System — "Card Catalog"

### The signature rule: book colors by tap order
Books get a color from the palette **in the order selected this session** — colors are never permanently bound to books. The palette (Okabe–Ito, colorblind-safe, 8 max):
`#0072B2` `#E69F00` `#009E73` `#CC79A7` `#D55E00` `#56B4E9` `#8172B3` `#B4A200`

The color must survive everywhere a recipe appears:
- Recipe cards: 7px spine stripe on the left edge (rounded 12px 0 0 12px) + a hanging page tab top-right (`p. 142`, white 11px/700 text, radius 0 0 7px 7px)
- Book selection cards: 14×44px spine chip + 24px numbered circle badge (tap order)
- Plan items: 5×28px stripe
- Legend rows: 11×16px swatch with `inset -2px 0 0 rgba(0,0,0,.18)` (fake book-spine shading)
- Books not selected / not installed: neutral `#DAD7C8` (uninstalled packs use a horizontal-striped spine)

### Colors (light)
- Paper background `#F6F4EC` · card `#FFFEF9` · panel tint `#FBFAF3`
- Ink `#23241E` · soft ink `#75766B` · mid ink `#54554B` · disabled `#B9B6A8`
- Line `#E2DFD2` · rule/dash `#DAD7C8` · index-card ruling `#E7E4D6`
- Accent green `#2D6A4F` (+ tint `#EDF3EE`, disabled button `#B9C6BF`)
- Danger `#A9553F` (+ tint `#F8ECE8`)
- Warning note `#FBF4DE` bg / `#EBDCAA` border
- Rating gold `#C08A17` · planned-marker violet `#8A8DDF`
- "Readable online" badge `#EEF1F7` bg / `#4C5C88` text

### Colors (dark) — warm ink, not gray
- Paper `#211F1A` · card `#2A2822` · panel `#26241F` · line `#3A382F` · ruling `#34322A` · dash `#4A4840`
- Ink `#EDEAE0` · soft `#9A9788` · mid `#C4C1B2` · disabled `#6E6B5E`
- Accent `#7FB89A` — **primary buttons flip to dark text `#161511` on this**
- Danger `#C97B63` (+ `rgba(201,123,99,.15)`) · gold `#E0B24A`
- Spine palette brightens one step: `#4FA3D9` `#E8B84B` `#3FC79A` (page-tab/badge text goes dark `#161511`)
- Green/danger tints become alpha washes: `rgba(127,184,154,.15)` / `rgba(201,123,99,.15)`

### Typography
- Display: **Bricolage Grotesque** 800 — screen titles 24px (letter-spacing −.01em), section headers 12px uppercase +.12em, stat numbers 17–18px
- Body: **Instrument Sans** — body 15px/1.45, card titles 16px/600, meta 12.5px soft ink, hints 11.5px, field labels 11px uppercase +.1em 700
- Monospace only inside image placeholders and the AI-prompt block

### Shape & spacing
- Cards radius 12px, screens padded 20px 16px, cards gap 9–10px, card padding ~13px 14px (recipe cards 14px 14px 12px 20px to clear the spine)
- Pills/chips/steppers fully rounded (999px); large buttons radius 14px
- Index-card ruling on hero recipe cards: `repeating-linear-gradient(transparent, transparent 26px, #E7E4D6 26px, #E7E4D6 27px)` offset below the title
- Touch targets: ≥40px on card actions, 44–52px elsewhere; primary CTAs 52px

### Component vocabulary
- **Keyword pill** (search/filters/tags): rounded, 12.5px/700; include = green border/text on `#EDF3EE`; exclude = danger colors with label prefixed "not "; body tap cycles include ↔ not; 18px circular × button removes. Free-typed keyword + Return adds a pill.
- **Chip** (inactive suggestion): same shape, line border, soft-ink text; tap converts it to a pill.
- **Status tags**: 10.5px uppercase 700, radius 5px — Made (green tint), Never make (danger tint), Installed, Readable online, Index only.
- **Stepper**: pill-shaped, 38×36px +/− buttons in accent green, count 700 (disabled-gray at 0).
- **Toast**: ink pill bottom-center (above nav), white text, optional green "Undo".
- **Bottom nav**: 4 tabs (Generate ⚄ / Plans ▤ / Browse ⌕ / Books ▥), 11px/600 labels, active = accent green + 700. Icons in the mocks are Unicode placeholders — substitute a proper icon set.

## Screens (all 390px design width)

Canvas IDs refer to `PageToPlate Directions.dc.html`; each screen root carries a matching `data-screen-label`. Dark variants: 3b–3g mirror 2a–2f.

### 2a · Generate step 1 — books
Header (kicker "PAGE TO PLATE" 11px uppercase +.16em / step counter) → 3-segment progress bar (4px, green = done) → open-plans banner (single line, "**Plan status** not yet updated" + "Plans →" link) → title "Choose your cookbooks" + sub "Each book gets a color in the order you tap it." → "⌕ Filter books…" field → book cards (spine chip, name 600, meta 12.5px, numbered badge when selected; selected border = book color + 1px spread shadow) → "Presets: … ▾" dropdown pill → primary "Next: categories →" (disabled `#B9C6BF` until ≥1 book).

### 2b · Generate step 2 — categories & filters
Title "What are we making?" / "Set a count per category. Filters apply only to their category." Category rows: bold name (ink for ALL categories), live availability ("7 match" green when filtered, "31 available" soft otherwise), stepper, ⚲ filter button (green + count badge when pills active). Active category row gets green border. Expanded panel (dashed top border, `#FBFAF3`): pills + remaining default chips + keyword input + hint "Tap a pill to flip include ↔ not. Filters match recipe names and tags." Category list is data-driven (12 defaults, see spec). Footer: primary "Generate N recipes →", ghost "← Books" / "Save as preset".

### Results (see 1a card on canvas + working prototype step 3)
Title "Your picks" (**never** time-of-day phrasing). Book legend → groups by category (uppercase header with hairline + "2 of 2" count) → recipe cards with keep/reject/never. Selected-state styling: Keep active = green tint; Rejected = "✕ Rejected — undo" neutral fill `#EEEDE5`, card at 55% opacity + line-through; Never = "Never — undo" danger tint + toast undo. Partial pool → warning note ("Only 1 dessert matches **chocolate** — showing what's available."). Footer: ghost "↻ Regenerate N rejected" (only when rejections exist), primary "Plan these N →".

### Plan created (prototype step 4)
Green check disc, "Plan created", "Planned <date> · N recipes", tappable recipe rows (open universal recipe card, chevron ›), primary "View plan in Plans →", ghost "Generate another", reassurance "Your books and filters are remembered."

### 2c · Plans tab
List/Calendar segment toggle · stat strip (made this year / open plans / avg rating) · plan cards ("PLANNED JULY 11 · 3 RECIPES" + Share ↗) with per-recipe rows (color stripe, Made ✓ outline → filled "Made · 8/10" once rated) + Swap / Dismiss · older plans collapsed at 75% opacity. Calendar: month grid, **planned = violet ring outline, made = solid green dot** (legend inline); tapping a day shows a detail block under the grid (day name, plan accepted line with ring marker, made line with dot + rating).

### 2d · Browse tab
Pill search field (pills live inside the field, "⌕ add keyword…" ghost text) → two collapsible dropdowns "Books: 2 selected ▾" / "Categories: all ▾" (expanded = dashed panel of book chips with color swatches, **"All books" chip first**, chips support the same not-state — e.g. "not Boston Cooking-School" in danger colors) → status chip row (Active / Made ✓ / Planned / Never make / ★ 8+) → result count line → recipe rows (spine stripe, name + page, book · category · tags meta, status tag, gold ★ rating). Excluded recipes at 60% opacity.

### 2e · Universal recipe card (sheet)
Bottom sheet (radius 22px top, drag handle) over a dimmed/blurred backdrop; never navigates away. Inside, one big ruled index card: editable title (✎) · pill-shaped selectors for book (with color swatch), category, page · Tags section (pill editor: removable pills + "+ add tag" dashed chip) · Attachments (photo thumbnails + add tile) · History (each MadeEntry: date · gold ★ rating · note quote, with edit ✎ and delete 🗑 per row) · status row ("Status: **Active**" + "Never make" ghost-danger button). Footer: primary "✓ Mark as made" (wider) + outline "+ Add to plan". Caption: "Edits save instantly · **Undo**". For linked-pack recipes add the open-page action (see 3a) and page-status badge.

### 3a · Mark as made dialog (shown in dark)
Centered dialog over dimmed backdrop: title + recipe line (spine chip, recipe name, **book name bold**, page) + "Open page ↗" outline button in the book color (linked packs only) · Date: single "Today · Jul 13 ▾" button — tapping opens a calendar picker (no yesterday/quick buttons) · Rating: 10-cell grid of 44px buttons, selected = filled green · Photos add tile · Notes field · primary "Save · Made Jul 13 ✓" / borderless Cancel · undo toast after save.

### 2f · Library (Books tab)
"My shelf · 5" / "Library · 24 packs" segment chips · catalog search + filter chips (Readable online / Index only / Era ▾ / Cuisine ▾) · pack rows: installed = colored spine + green "Installed" tag; uninstalled = **grayed** (striped neutral spine, soft-ink title, muted badges) + 44px "Install" outline button. Badges: "Readable online" (blue-gray) vs "Index only — own the book" (warm gray); meta shows recipe count and "12 unverified pages" where applicable. Footer caption: "Linked packs open at the exact page on archive.org — free to cook from."

### 4a–4c · Settings
- **4a Home**: grouped card lists under uppercase section labels — Generation (Categories / Filter chips / Saved presets), Your data (Back up & restore — subtitle turns danger when overdue: "Last backup 34 days ago — back up soon"; Import a book with AI help), About card.
- **4b Filter chips editor**: one card per category, removable chips, custom chips highlighted green, "Restore defaults" link, "+ add chip", empty custom categories collapsed.
- **4c Backup & restore**: warning note ("Your data lives only on this device. **Last backup: June 9** — 34 days and 61 changes ago."), Export card (primary), Restore card (explicit "**Replaces** everything — it does not merge."), 30-day reminder toggle, persistent-storage status line.

### 5a–5c · AI import & book detail
- **5a Help page**: 4 numbered steps (30px green number discs): photograph TOC → paste prompt (mono prompt preview + "⧉ Copy full prompt" button) → save as .csv → import. Primary "Choose CSV file to import…". Reassurance: "Names + page numbers only — no recipe text is copied."
- **5b CSV preview**: green summary note ("312 recipes found · 11 categories · 0 duplicates") · **editable Book name field (✎)** · **Book tags pill row** ("applied to every recipe, filterable everywhere") · unrecognized-category warning with mapping choices (Map to Mains / Create category / Uncategorized) · sample table (unmapped rows flagged in danger) · "Import 312 recipes" / Cancel.
- **5c Book detail**: spine + editable title (✎) + meta · Book tags pill editor · stat card (made / % explored / avg rating / most-made) · action list (Browse recipes / Add recipe manually / Re-import CSV "never duplicates") · "Disable book" + "Delete…" pair with caption "Disable hides it from generation but keeps all history — recommended over delete."

## Interactions & Behavior
The wizard prototype's logic class implements the canonical behavior — port it, don't reinvent:
- **Book toggle**: selecting appends to an ordered array; deselecting splices it, and remaining books' colors reflow to their new order index.
- **Pill state machine**: chip tap → include pill; pill-body tap → toggles `neg`; × removes. Free text + Enter adds (deduped, lowercased). Pills AND together; `neg` pills are NOT-matches. Matching = case-insensitive substring over `name + ' ' + tags.join(' ')`.
- **Live availability** recomputes per keystroke/pill change, scoped to selected books + category.
- **Generation**: shuffle unmade first, then made (prefer-unmade is a settings-level flag), take `count`; short pools return partials + note (rule 9: never fail).
- **Reject** is session-only (a `sessionRejected` set consulted by regenerate); **Never** persists (`excluded` status) and must offer undo (toast + tappable button state).
- **Regenerate** replaces only rejected cards, excluding session-rejected and currently shown recipes; exhausted pool → note.
- Back navigation preserves all selections; after planning, "Generate another" keeps books/filters.
- All destructive one-tap actions get snackbar undo; deletions get confirmations (spec, UX Safeguards).
- Transitions are modest: sheet slides up, toast fades; no elaborate animation language.

## State Management
See spec Data Model (Cookbook, Recipe, Plan, MadeEntry, Category, per-category chips) — all in IndexedDB. Wizard session state: `step, sel[] (ordered book ids), cfg{cat → {count, pills[]}}, open panel, groups (results with per-card status), sessionRejected, toast`. Request persistent storage on first use; backup nudge after 30 days.

## Design Tokens (summary)
Spacing: 2 / 4 / 6–8 / 9–12 / 14–16 / 20px steps. Radii: 5 (tags), 10 (inner), 12 (cards), 14 (CTAs), 18–22 (dialogs/sheets), 999 (pills). Shadows: essentially none on cards (1px lines instead); sheet `0 -8px 30px rgba(0,0,0,.25)`; dialog `0 12px 40px rgba(0,0,0,.35)`. Fonts via Google Fonts: Bricolage Grotesque (400/600/800), Instrument Sans (400/500/600/700).

## Assets
None required. All imagery in the mocks is placeholder (striped boxes with mono labels) — real photos come from users. Nav/UI icons are Unicode stand-ins; pick one icon library (e.g. Lucide/Phosphor) sized ~18px in the nav.

## Screenshots
`screenshots/` contains one PNG per screen, named by canvas id: 01–02 results (light/dark), 03–08 the approved light screens, 09–10 dark examples, 11–13 settings, 14–16 import & book detail.

## Files
- `PageToPlate Directions.dc.html` — design canvas (turn 2 = approved screens; 3 = dialog + dark; 4 = settings; 5 = import/book detail; 1 = historical bake-off)
- `PageToPlate Wizard Prototype.dc.html` — interactive wizard reference implementation
- `cookbook-app-spec.md` — product spec (source of truth for features/flows)
