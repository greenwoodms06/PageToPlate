# calendarofdinner00neiluoft — curation notes

Tags: american

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Neil, Marion Harris, *A Calendar of Dinners, with 615 Recipes* (Procter & Gamble
/ Crisco, 1922). A **Crisco promotional cookbook** organized by MONTH/DATE:
each day gets a dinner menu, and recipes for the starred dishes follow. Metadata:
**year 1922** (`date: 1922`) — clearly public domain. `country` set to **US**
via `--country` (American author, American company P&G/Crisco of Cincinnati,
American cuisine); the digitized edition's imprint is the Canadian distribution
arm ("Hamilton, Ont. : Procter & Gamble Distributing Co. of Canada"), noted here
for transparency. Book-tag `american` → catalog cuisine.

### Structure & extraction — the book has a RECIPE INDEX, but it is TWO-COLUMN

Despite the monthly-menu organization, the book carries a real back-of-book
`RECIPE INDEX` (289 entries), so extraction was NOT blocked by the menus — the
recipes have names+pages and were extracted and NAME-classified as usual.

**BUT the index is a two-column layout with a SEPARATED page-number column** in
many sections (BREADS-Biscuits/Muffins, CAKES, part of COOKIES, "Other Fowls",
Hare/Rabbit, etc.): recipe names stack in one block, a `Page` sub-header, then the
page numbers stack in a parallel block. The extractor's inline `name … page`
assumption handles the inline sections (FISH, main MEATS, CROQUETTES, SALADS, the
quickbread list) correctly but mis-handles the column-separated ones, producing
two failure modes:
1. **OCR-merged multi-entry names** — adjacent index entries glued into one:
   `"C CAKES Almond and Citron Black Cake with Prune Filling"`, `"F FISH, Etc
   Blue, Baked"`, `"Clams, Steamed Codfish Balls… 22S . 1S2 Cod, Boiled"`.
2. **Wrong page numbers** — a clean name paired with the wrong column page:
   `"Turkey, Roast"` shipped p217 but the roast-turkey recipe is at ~p63.

Extraction was not degenerate (289 real entries, and the majority correctly
paged — see below), so **the shared extractor was NOT modified** (fixing the
two-column layout would be a risky rewrite of code the other 8 packs depend on).
Instead the damage was measured and repaired in the judgment pass.

### Page-accuracy audit (investigate-the-cached-text step)

Because `verify-links` only proves a URL resolves (archive.org 200s any valid
`/page/nN`), not that the page matches the recipe, I verified page accuracy
directly against the **body**: the recipe text carries sequential printed page
markers (plain standalone numbers), so I tracked the true page of every recipe
and compared it to each shipped entry. Result over the 192 name-classified
shipped entries: **168 correctly paged (87.5%)**, 11 demonstrably wrong, 13
unlocatable by the fuzzy matcher (mostly single-common-word names like "Corn",
"Coffee" — spot-checked as fine on the inline quickbread list). The wrong ones
were almost all the garbled merges above; only three were clean names with a
genuinely wrong page.

### Judgment-pass edits

**Dropped 14 rows** (moved out of `final.csv`, not shipped — the German-pack
precedent of holding irrecoverable OCR merges):
- 11 **irrecoverable OCR-merged / section-header / page-number-debris names**
  ("C CAKES Almond and Citron…", "Jumbles… Lemon Wafers", "Cutlet . 16S
  Croquettes", "Friar's …. . 1S9 Kidney", "F FISH, Etc Blue, Baked",
  "Cassolettes of Fish . S3 Clams, Scalloped", "Clams, Steamed Codfish Balls…",
  "56 Fish, Fried", "Terrapin, a la Maryland . 2.^0 Trout, Baked", "Dominion Hot
  Water Puff.. …", "Rhubarb Custard Shepherd's").
- 3 **clean names with a verified-WRONG page** — better dropped than ship a wrong
  deep link: "Turkey, Roast" (p217→recipe at ~63), "Smelts, Broiled" (p214→~157),
  "Coffee" (p99→coffee-bread recipe at ~112).

**Cleaned 5 recoverable OCR names** (kept): "EGGS Omelets Apricot"→"Apricot
Omelet", "Lamb, Spring, Steak, a la Minate"→"Spring Lamb Steak, a la Minute",
"Veniion, Cutlets"→"Venison, Cutlets", "Halibut, a la Poulett<"→"Halibut, a la
Poulette", "Flounder, a la Turqu e"→"Flounder, a la Turque".

**Category hand-fixes (23):**
- Savory-in-Desserts → correct role: "Oyster Shortcake"→Sides, "Beefsteak
  Pudding"→Mains, "Meat Cakes"→Mains (savory ground-meat patties, body-confirmed
  at p63), "Sweet Breads"/"Sweet Breads, Fried"→Mains (sweetbreads = offal, not
  bread), "Hearts, Baked Stuffed"→Mains (offal).
- Sweet-in-Preserves: "Chocolate Jelly"→Desserts (chocolate gelatin dessert).
- Elided-"Bread" (the `B BREADS` quick-bread list) → Breads: "Coffee, Swedish",
  "Corn", "Fruit, Yorkshire", "Raisin and Buttermilk", "Raisin and Nut".
- **SALADS section → Salads (11)** — the index's `S SALADS` section lists salads
  by ingredient with "Salad" elided ("Celery and Nut", "Asparagus", "Cabbage",
  "Carrot", "Cheese", "Orange and Tomato", "Potato and Nut/Pimiento", "Shrimp",
  "Pear and Pimiento"); they had misfiled to Sides/Mains/Desserts, zeroing the
  Salads category. Reclassified (inline pages, reliable). "Potato and Nut" p136
  and "Carrot" p79 are NOT the salads (croquette / other section) — left as Sides.

Required savory-in-Desserts / sweet-in-Mains grep after fixes: **clean.**

### Counts and histogram

- **289 raw index → 178 shipped, 94 held, 17 withheld/dropped** (14 of those 17
  hand-dropped this pass; `stats.json` updated to reflect it).
- Links: **178 / 178 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 289` (withheld 38% > 5%).

| category | count | % |
|---|---:|---:|
| Mains | 79 | 44% |
| Desserts | 34 | 19% |
| Sides | 28 | 16% |
| Salads | 11 | 6% |
| Breads | 10 | 6% |
| Breakfast & Brunch | 10 | 6% |
| Sauces & Condiments | 2 | 1% |
| Preserves & Pickles | 2 | 1% |
| Soups & Stews | 2 | 1% |

**9 of 11 categories (no Drinks / Basics — the book ships neither).** Reads like a
real 1920s American dinner cookbook: **Mains (44%) legitimately leads** — this is
a book of daily *dinner* menus, so it is heavy on fish/meat/poultry entrées;
stated out loud (rule 8), not a classifier artifact. Desserts (19%) is the large
candy/cake/cookie/pudding range typical of a Crisco promo book.

### Unsure — for owner audit

- **Two-column index reliability**: the 178 shipped are the entries whose pages
  I could corroborate against the body plus the reliable inline-format sections.
  The 13 "unlocatable" (common-word) entries shipped on their inline index pages
  (spot-checks passed); if any single-word bread/soup entry lands a page off, it
  is one of these — flag and I will drop it. The held 94 are the honest residual
  (generic labels, lone qualifiers, front/back matter).
- **country = US vs CA**: set US on origin/cuisine grounds; the physical reprint
  imprint is Canadian (see top). Change to CA with `--country` if the owner
  prefers imprint-accuracy over origin.
- A few entries keep a period-specific inverted/OCR-quirky name form (e.g.
  "Steak, Beef, Baked" — body-confirmed correct at p224); left as printed.
