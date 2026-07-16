# cu31924000722862 — curation notes

Tags: german

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Davidis, Henriette, *German National Cookery for American Kitchens* (C.N.
Caspar, Milwaukee, 1904). **English-language** German cookbook with a large
back-of-book **Alphabetical Index** (966 entries; the 2 parsed "chapters" are
roman-numeral-prefixed and map to null, so categorization is name-based). Curated
via the **name classifier under the clean-subset policy** (witness P2P-007):
`classify` + a judgment-pass OCR cleanup on top.

Most dish names are English ("Apple Soup", "Beef Rolls", "Sugar Cookies"), so the
classifier placed them well out of the box (820 clean before any change).

### Reusable classifier / metadata additions this pass (selftest stays green)

- **`_clf_words` strips leading/trailing apostrophe-&-hyphen debris per token.**
  "White Bean Soup**'**" (trailing OCR apostrophe) tokenized to `soup'`, missed
  the soup rule, and landed in Sides; now → Soups & Stews. Internal apostrophes
  ("pig's") are preserved. Reusable across all packs.
- **Game/meat words → `_MEAT`**: `pig, boar, peacock, guinea, carp` — rescues
  "Pig, roast", "Boar", "Peacock, roast", "Guinea Fowl", and routes their pies to
  Mains ("Peacock Pie" was falling to Desserts via bare `_rz_pie`).
- **`_rz_souffle` savory set += `meat, veal, ham, game, liver, crab`** — "Meat
  Souffle" → Sides (was Desserts).
- **German sides rule** → Sides 0.6: `sauerkraut, kraut, sourkrout, spatzle,
  spatzen, knodel, klosse` (rescues "Sourkrout"; reusable for future German packs).
- `_PUBLISHER_CITIES` += **milwaukee → US** (this book's imprint).
- `clean_creator` now strips a **death/birth-only date**: "Davidis, Henriette,
  d. 1876" → "Davidis, Henriette".
- `CUISINE_VOCAB` += **german, spanish** so `--book-tags german` becomes the
  catalog cuisine (mirrors the precedent that added `chinese`).

### Judgment-pass OCR cleanup — the index is two/three-column and merged badly

The alphabetical index OCR'd with section-letter headers, adjacent-column page
numbers, and neighbouring entries glued into single lines. Extraction was NOT
degenerate (827 good entries), so per the guidance the extractor was left alone
and the 39 garbled shipped names were handled in the judgment pass (hand-decisions
logged in `build` step; see below), giving **0 residual-garble names in
final.csv**:

- **26 recoverable single names cleaned & shipped** — stripped a leading lone
  section-letter that equals the entry's initial ("S Salted Tongue…" →
  "Salted Tongue…", "P Peacock…", "L Lamb Fricassee…"), leading page-number runs
  ("157 158 Turkey with Forcemeat" → "Turkey with Forcemeat"), and trailing debris
  ("Currant Cake ..... £84" → "Currant Cake"). A few merged lines were reduced to
  their first, clean dish ("Spare Ribs, stuffed... / Sweet-sour Ragout of Pork" →
  "Spare Ribs, stuffed").
- **13 irrecoverable merges / non-recipe instructions held** — page-number garble
  ("51 49 48 V Veal Soilp .... Veal Soup…"), 3-4-entry pile-ups, and how-to lines
  ("Directions for preparing Dumplings", "To prevent Preserves from becoming
  candied").
- Category hand-fixes from the audit: "Filled Capon in Jelly" → **Mains** (aspic,
  not a preserve), "Goulash (an Hungarian dish)" → **Mains**, "Spring Chicken in
  Sauce" → **Mains**, "Mixed Fruits in Brandy" → **Preserves & Pickles**, savory
  "Souffle of Rice, Sweetbreads and Crab Butter" → **Sides**.

Required savory-in-Desserts / sweet-in-Mains grep: **clean** after fixes (meat/fish
pies and puddings correctly route to Mains — "Crab Pie", "Eel Pie", "Liver
Pudding", "Fish Pudding" — via the resolvers; this validates the classifier).

### Counts and histogram

- **966 raw index → 814 clean (84.3%) shipped, 147 held (15.2%), 5 dropped (0.5%).**
- Links: **778 / 814 verified (95.6%)**; 36 unverified (their printed page did not
  resolve in the reader page map — shown with a "page unverified" badge, links
  still open the book). `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 966` (withheld 15.7% > 5%).

| category | count | % |
|---|---:|---:|
| Mains | 208 | 26% |
| Desserts | 198 | 24% |
| Sides | 128 | 16% |
| Soups & Stews | 95 | 12% |
| Sauces & Condiments | 56 | 7% |
| Preserves & Pickles | 41 | 5% |
| Breakfast & Brunch | 28 | 3% |
| Salads | 25 | 3% |
| Breads | 23 | 3% |
| Basics | 10 | 1% |
| Drinks | 2 | 0% |

**All 11 categories present.** Reads like a real German household cookbook:
Mains (26%) and Desserts (24%) co-lead honestly — a huge meats/poultry/game/fish
range plus an equally huge Kuchen/Torten/puddings/candies dessert range — with
strong Soups (12%) and a real Preserves & Pickles section (41). No category
runs away.

### Held (147) / dropped (5) — the honest residual

Held: non-recipe prep/instructions ("Larding", "Serving", "Cleanliness", "General
directions"), OCR-garbled tails whose head was elided ("Schnitzel)",
"Schnitzchen)", "Rehrippchen)"), the irrecoverable merges above, generic bare
labels ("Soup", "Sauce", "Gravy", "Bread", "Roast"), and exotic game the Western
table doesn't carry ("Badger, roast", "Bear, roast", "Beaver Tails, roast",
"Coot") — consistent with the Chinese pack holding "Shark"/"Deer". Dropped: 4
non-recipe how-to fragments ("When Vegetables should be thickened", "How Puddings
are cooked", "The various stocks for Jellies", "To Color Icing") + 1 accepted
false-drop, "H Hasty Patties made from Meat remnants" (leading-"H" fragment rule,
same known limitation as the Chinese "Why Shon" note).

### Unsure — for owner audit

- A few **preliminary-section prep entries** (pages 3-13: "Goose Oil", "Kidney
  Suet, to prepare") ship as **Mains** on their meat word though they are really
  fat/suet preparations (Basics). Minor; the recipe/prep filter is the known
  future-work limitation noted for other packs.
- Catalog **title** is the full archive subtitle ("…: a practical book of the art
  of cooking as performed in Germany"). Left as the metadata default; could be
  shortened with `--title` if the owner prefers.
