# auntcarolinesdix00mckirich — curation notes

Tags: southern, american

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Emma & Wilbur McKinney, *Aunt Caroline's Dixieland Recipes* (1922). CONTENTS-
based book (no back-of-book index). Categorized by the **name-based classifier**
under the **clean-subset policy** (witness P2P-007):
`python3 tools/curate_packs.py classify auntcarolinesdix00mckirich` regenerates
final.csv / needs_review.csv / dropped.csv / stats.json from draft.json.

### Extraction

Clean CONTENTS with well-formed, self-contained recipe names ("Virginia Beaten
Biscuit", "Spoon Bread", "Chess Pies"). 190 entries, 100% deep-link-verified on
the first pass — no book-specific extractor fix needed (it benefits from the
`SPACED_CONTENTS_RE` dotless-gutter fix added for the Chinese book). The book's
OCR left trailing debris marks on many names ("Chili Sauce ~ ~", "Virginia
Waffles -»", "Sally Lunn *"); the reusable trailing-mark strip in `match_entry`
now removes those, so shipped names are clean.

### Reusable classifier fixes this pass

- **"stewed" removed from the Mains keyword rule.** Meat stews are already
  caught by `_MEAT`, so a remaining "Stewed X" is a vegetable/fruit ("Stewed
  Celery", "Stewed Green Corn") — those now land in Sides via `_VEG`, not Mains.
- **"Iced Tea"/"Iced Coffee" → Drinks** (in `_rz_ice`): previously the `iced`
  ice-resolver sent them to Desserts.

### Counts and histogram

- **190 raw → 176 clean (92.6%) shipped, 14 held (7.4%), 0 dropped.**
- Links: **176 / 176 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 190` (withheld 7.4% > 5%).

| category | count |
|---|---:|
| Desserts | 62 |
| Sides | 28 |
| Breads | 19 |
| Mains | 17 |
| Sauces & Condiments | 11 |
| Soups & Stews | 10 |
| Breakfast & Brunch | 9 |
| Preserves & Pickles | 8 |
| Salads | 7 |
| Drinks | 5 |

Reads like a real Southern cookbook: dessert/baking-forward (Desserts 62 ≈ 35% —
cakes, fillings, cookies, candies, pies, custards fill the book; this is the
book's honest character, not a classifier skew), strong Breads/Breakfast, all
categories represented except Basics (the book has no stocks/doughs section).
10 of 11 categories present. No single category runs away past ~35%.

### Held (14) — the honest residual, not shipped

Low/no-signal names the Western keyword table can't confidently place: regional
dish names ("Syllabub", "Perlean", "Brown Betty", "Food For The Gods"), pickle/
relish terms not in the table ("Tar Heel Chow Chow", "Picalli" = piccalilli),
bare "Southern Pastry"/"Sally Lunn", and honest low-confidence guesses ("Chess
Pies" → Desserts 0.40, "Hot Chocolate" → Drinks 0.40, "Cream Puffs" → Desserts
0.40). These surface for a future human/LLM pass rather than ship at a guessed
category. 0 fragments dropped — this CONTENTS has no leading-preposition tails.
