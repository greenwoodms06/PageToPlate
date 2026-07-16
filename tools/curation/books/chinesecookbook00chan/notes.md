# chinesecookbook00chan — curation notes

Tags: chinese

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Chan, Shiu Wong, *The Chinese Cook Book* (Frederick A. Stokes, New York, 1917).
CONTENTS-based book (no back-of-book index). Categorized by the **name-based
classifier** under the **clean-subset policy** (witness P2P-007):
`python3 tools/curate_packs.py classify chinesecookbook00chan` regenerates
final.csv / needs_review.csv / dropped.csv / stats.json from draft.json.

### Extractor fix — degenerate first extract (26 entries), now 191

First `extract` found only **26** of ~190 CONTENTS entries. Cause: this book's
OCR puts **two spaces between words but only ONE space before the page number**
("`Marketing 6`", "`Chinese Sauce 10`"), and most lines have no leader dots, so
the strict dotted/comma matcher (`[ .]{2,}` leader) missed ~85% of the table.

Fix (reusable, in `match_entry`): added `SPACED_CONTENTS_RE` — a Title-Case name
followed by a single space and an end-of-line page number. Guarded two ways so
it does not over-match:
- tried only AFTER the dotted/comma forms;
- **rejects ALL-CAPS names** — the running page header "THE CHINESE COOK BOOK
  85" repeats on every other page and, unguarded, glued the CONTENTS region to
  the entire book body (291 raw entries, ~85 of them the header). With the
  guard the region stops at the true end of the CONTENTS (191 entries).

Escoffier/Boston parser selftests stay green; Fannie Farmer re-extract moved
only 3,613 → 3,616 entries (negligible), and its TOC now also parses 22 chapters
(all roman-numeral-prefixed "VIII. Soups" → don't map through the synonym table
→ FF still name-classified, unchanged).

### Reusable classifier addition this pass

- **"Bean Cake" → Sides** (savory branch of `_rz_cake`): Chinese *bean cake* is
  dou fu / tofu, not a Western dessert; moved 5 entries Desserts → Sides.
- Added `chinese` to `CUISINE_VOCAB` so `--book-tags chinese` becomes the
  catalog cuisine.
- `clean_creator` now strips trailing `[from old catalog]` archive.org
  annotations (author "Chan, Shiu Wong, 1893- [from old catalog]" → "Chan, Shiu
  Wong").

### Counts and histogram

- **191 raw → 160 clean (83.8%) shipped, 26 held (13.6%), 5 dropped (2.6%).**
- Links: **160 / 160 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 191` (withheld 16% > 5%).

| category | count |
|---|---:|
| Mains | 95 |
| Sides | 26 |
| Soups & Stews | 12 |
| Breakfast & Brunch | 11 |
| Desserts | 8 |
| Breads | 5 |
| Sauces & Condiments | 2 |
| Salads | 1 |

**Mains dominance (59%) is the honest character of this book, not a classifier
artifact** (stated out loud, rule 8). It is a protein-forward Chinese cookbook:
whole CONTENTS sections for Chicken, Duck, Lamb, Pork, Beef, Fish, Shrimp,
Oyster, Crab, Lobster, Pigeon/Quail/Partridge/Goose, plus Chop Suey variants —
all genuine mains by the app's Western meal-role model. Redistributing them to
hit the "<35%" guideline would misclassify real mains, so they stay. 8 of 11
categories present (no Drinks / Preserves / Basics — the book has none).

### Held / dropped are sane

- Held (26): no-signal dish names the Western keyword table cannot place
  ("Shark", "Deer (Lock Yok)", "Chinese Frankfurter", "Immortal Food"), bare
  generic labels ("Soup", "Pudding", "Cake"), and OCR garble ("Soft Immortal
  ^ood"). Honest residual for a future pass — not shipped.
- Dropped (5): leading function-word fragments ("To Fry Rice", "How to Make
  Tea", "The History of Chinese Cooking", "Why Shon Pigeon/Partridge"). Note
  the two "Why Shon …" are real dishes lost to the `why` fragment-lead rule — a
  known, accepted false-drop (removing `why` would admit English "Why …"
  household-hint lines).
- A few non-recipe appendix lines that carry a food keyword shipped
  (e.g. "Chinese Grocery Stores and Noodle Shops" → Sides); the recipe/
  non-recipe filter remains future work (same limitation noted for FF).
