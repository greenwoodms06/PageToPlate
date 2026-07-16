# goldenrulecookbo00shar — curation notes

Tags: vegetarian

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Sharpe, M. R. L. (Maud Russell Lorraine), *The Golden Rule Cook Book: Six
Hundred Recipes for Meatless Dishes* (Little, Brown, Boston, 1912). A large
**vegetarian** ("non-flesh-eating") cookbook. `vegetarian` is a **diet** book-tag,
not a cuisine — `cuisines` is intentionally empty in the catalog entry. Curated
via the **name classifier under the clean-subset policy** (witness P2P-007), with
a substantial **chapter-map judgment pass** on top (see below).

Metadata: **year 1912** (`date: 1912`), US (Boston). Clearly public domain.

### Extraction: healthy entries, but the chapter map did NOT parse

`extract` found **650** index entries (98.8% verified links) — NOT degenerate —
so per pipeline guidance the extractor was **left untouched**. But the book has a
real 22-chapter front CONTENTS (`SOUPS 45`, `VEGETABLES 79`, `NUT DISHES 177`,
`CROQUETTES 197`, `SAUCES 217`, `EGGS 231`, `CHEESE 249`, `SALADS 257`,
`SAVOURIES 273`, `SANDWICHES 281`, `PASTRY … 287`, `HOT BREADS 293`, `PLUM
PUDDING … 299`) that the extractor could **not** parse: every chapter line is
ALL-CAPS single-space form (`SOUPS 45`), and `SPACED_CONTENTS_RE` rejects ALL-CAPS
by design (the guard that stops running-header false-positives from bleeding the
Chinese pack's contents into the body). So `parse_chapters` recovered only 1 of 22
chapters and the whole book was **name-classified**. Relaxing that guard globally
would regress `chinesecookbook00chan`, so the extractor was not modified; instead
the chapter map was applied by hand in the judgment pass (below), verified against
the book's own body text.

**No classifier-table changes this pass.** The misclassifications here are
elided-parent artifacts (P2P-007), not reusable keyword gaps — the classifier
correctly reads "Carrots" as a vegetable; it just cannot know that "Carrots" in
the SOUPS chapter is *carrot soup*. Parent-noun reconstruction is out of scope.

### Judgment-pass category fixes — hand-applied the book's own chapter map (89 rows)

The name classifier systematically misfiled the elided-parent chapters (soups,
salads, and sauces are indexed by their vegetable with the head noun dropped —
"Cream of Artichoke", "Artichoke [Salad]", "Cheese [Sauce]"). Each fix was
verified against the recipe headers in the cached body text (`…_djvu_full.txt`),
which confirmed the chapter page ranges:

- **SOUPS chapter (pp. 45–78) → Soups & Stews** — all 47 entries in this range are
  soups (body confirms: "OYSTER PLANT (SALSIFY) SOUP", "SPAGHETTI SOUP", "NOODLE
  OR ALPHABET SOUP", "CREAM OF CURRY", etc.). 38 were misfiled to Sides/Mains.
- **VEGETABLES chapter (pp. 79–166) → Sides** for 12 entries that misfired to
  Sauces/Desserts/Breakfast: "…in Butter"/"…Hollandaise"/"Tips with White Sauce"
  (the sauce word is an accompaniment, the dish is the vegetable); the fried-fruit
  sides "Griddled Apples", "Apple/Banana Fritters", "Boiled Bananas" (body places
  them between asparagus and beans — vegetable-course sides, not desserts);
  "Egg Plant with Sauce Tartare" and "Filled with Egg" (eggplant / stuffed-tomato,
  not egg breakfasts); "Fried Souffle" (potato); "Salsify (Oyster Plant)" (the
  "oyster" is oyster-*plant* = salsify, a vegetable, not shellfish).
- **NUT DISHES chapter (pp. 177–184)**: the savoury loaves/roasts are the book's
  **vegetarian mains** → "Michaelmas Loaf", "Christmas Loaf", "Nut and Barley Loaf
  (Roast)", "(Steamed)", "Foundation Loaf" → **Mains** (per the brief: a nut roast
  is a Main). "Chestnut/Peanut Puree" in this chapter → Sides (nut dishes, not the
  soups of the same name in ch. 1).
- **CROQUETTES (pp. 197–208)**: "Hominy" (Hominy Croquettes) → Sides (was Breakfast).
- **SAUCES chapter (pp. 217–230) → Sauces & Condiments** for 6 elided-"Sauce"
  entries: "Curry", "Cheese", "Cucumber", "Onion", "Spinach", "Tomato" (body:
  "CURRY SAUCE", "CHEESE SAUCE", "SPINACH SAUCE", …). "Drawn Butter" left as Basics.
- **EGGS chapter (pp. 231–248) → Breakfast & Brunch** for 4: "Cheese" (Cheese
  Omelet), "Fried Stuffed" (eggs), "Swiss/Canuck Egg Toast".
- **CHEESE (pp. 249–256)**: "Meringues" (savoury **Cheese** Meringues) → Sides
  (was Desserts).
- **SALADS chapter (pp. 259–272) → Salads** for 14 elided-"Salad" entries
  ("Artichoke", "Green/Wax Bean", "Cabbage", "Cucumber", "Lettuce", "Mushroom",
  "Potato (German/American)", "Grape Fruit", "Watercress with Oranges", …).
  Dressings at pp. 257–258 stay Sauces & Condiments.
- **SAVOURIES (pp. 273–280)**: the three "Cocktails" (Fresh/Canned Mushroom,
  Pimento) are **savoury appetizers**, printed as `"COCKTAILS"` in quotes — not
  beverages → Sides (was Drinks, which zeroed the Drinks category — correct, the
  book has no beverage recipes).
- **PASTRY/PATTY CASES (pp. 287–292)**: "Timbale Cases", "Batter for Fritters",
  "Potato Crust" are component bases → Basics.

Required savory-in-Desserts / sweet-in-Mains grep after fixes: **clean.** Desserts
holds only genuine sweets (Sweet Potato Pie, Gingerbread, Plum Pudding, Mince Pie);
Mains hold only vegetarian mains (nut loaves, ragouts, hash, fricassee, chop suey,
curry).

Also **hand-dropped 4 OCR-split fragments** — "Vegetable No" / "Soup, Vegetable
No" (p1/2/3/5) are "Vegetable Soup No. 1–5" where the recipe number was mis-read
as the page (bogus, unverified links); dropped rather than ship broken names.

### Counts and histogram

- **650 raw index → 248 clean (38.2%) shipped, 309 held (47.5%), 93 withheld
  (89 fragments + 4 hand-dropped "Vegetable Soup No." OCR splits).**
- Links: **247 / 248 verified (99.6%)**; 1 unverified ("Seasoning" p39 — a real
  recipe whose printed page did not resolve; link still opens the book, badged).
  `verify-links --sample 8` → 8/8. Printed→positional offset is a consistent +9
  (front-matter leaves), corroborating page accuracy.
- `curatedSubset: true`, `rawIndexCount: 650` (withheld 62% > 5%).

| category | count | % |
|---|---:|---:|
| Sides | 100 | 40% |
| Soups & Stews | 52 | 21% |
| Sauces & Condiments | 22 | 9% |
| Salads | 19 | 8% |
| Breakfast & Brunch | 15 | 6% |
| Mains | 13 | 5% |
| Breads | 9 | 4% |
| Preserves & Pickles | 8 | 3% |
| Basics | 6 | 2% |
| Desserts | 4 | 2% |

**10 of 11 categories present (no Drinks — the book has none).** Reads like a
real vegetarian household cookbook: **Sides (41%) legitimately leads** — this is a
meatless book whose recipes are, by the app's meal-role model, mostly vegetable
side dishes; the big Soups (21%) and real Salads (8%) sections follow. Sides
exceeds the ~35% soft cap because the book genuinely is vegetable-forward
(stated out loud per rule 8); redistributing real vegetable dishes to hit the cap
would misclassify them. Desserts (2%) is honestly tiny — this is a savoury
whole-foods book with one small pudding/pie chapter.

### Held (309) / dropped (89) — the honest residual

This book's index is **extremely hierarchical** — even more elided than Fannie
Farmer's. Sub-recipes are listed under a vegetable/dish headword with the head
noun dropped, so a large fraction of names truncate to lone qualifiers the name
classifier cannot place. Held (309, ~48%): cooking-method qualifiers with the
parent elided ("Fried", "Escalloped", "Mashed", "Broiled", "Creamed"),
nationality/varietal qualifiers ("Belgian", "Creole", "Hungarian", "Lyonnaise",
"Delmonico"), bare sauce varieties ("Bordelaise", "Caper", "Mint", "Hollandaise",
"Tartare"), bare generic labels ("Souffle", "Pudding", "Chowder", "Stew",
"Bread", "Cakes", "Omelet"), and front/back matter ("Introduction", "Thanksgiving
Dinner", "Pie-Crust"). Dropped (89): pure fragments — leading prepositions/
conjunctions ("with Tomato Sauce", "au Gratin" = OCR of the elided-parent tail,
"and Corn", "in Casserole", "to boil") and menu/section lines ("A Dozen Dinners").
The links for held entries are correct; they wait for a future pass, not shipped
as broken names (P2P-007). Held is high here **because the source index is
unusually flattened**, not because classification underperformed.

### Unsure — for owner audit

- **Held share is high (48%)** by the nature of this hyper-hierarchical index (cf.
  Fannie Farmer ~45%). The 252 shipped are the confidently self-contained, cleanly
  categorized subset; the rest are honestly withheld.
- A handful of **vegetarian "main-ish" dishes** in the VEGETABLES chapter shipped
  as **Mains** on a dish word — "Hash", "Fricassee", "Ragout(s)", "Chop Suey",
  "Curry, Indian" (pp. 115–172). Defensible as hearty meatless mains; could be read
  as Sides. Left as Mains.
- **"Sweet Potato Pie" (p146)** shipped as Desserts (pie + sweet potato). In this
  era a sweet-potato pie is a dessert; flag if the owner prefers Sides.
