# worldsfairrecipe00land — curation notes

Tags: american

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Landis, Jacob F., *The World's Fair Recipe Book* (J. F. Landis, Philadelphia,
1893). An 1890s American **"receipt book"** — food recipes intermixed with
household remedies, veterinary cures, and formulas. Metadata: **year 1893**
(`date: 1893`), US (Philadelphia) — clearly public domain. Curated via the
**name classifier under the clean-subset policy** (witness P2P-007).

### Extraction — clean single-column index (pages reliable)

`extract` found the back-of-book `GENERAL INDEX` — **525 entries, 100% verified**.
Crucially the index is **single-column inline** ("Allentown cake 7", "Asparagus
soup . 97" — the page sits on the same line as the name), so page assignment is
unambiguous (no column-pairing risk like `calendarofdinner00neiluoft`). Spot-check:
the "Allentown Cake" recipe body is at ~printed p7, matching its index page. The
book has no chapter contents (`parse_chapters` = 0), so it was NAME-classified.

### Reusable classifier addition this pass (selftest stays GREEN)

- **`"wine"` → `_DRINK`.** Homemade fruit wines are a whole dish-type this book
  carries ("Blackberry Wine", "Currant Wine", "Grape Wine", "Peach/Quince/Rhubarb/
  Raspberry/Sour-cherry Wine", "Crab Apple Wine", "Tomato Wine" — 10 entries) that
  misfiled to Desserts/Mains/Sides on their fruit word because `wine` was absent
  from the drinks vocabulary. Added it → all 10 now Drinks. It is placed AFTER the
  sauce/jelly/cake rules, so "Wine Sauce"/"Wine Jelly"/"Wine Cake" still resolve
  correctly ahead of it. Reusable for any old receipt book. Selftest: PASS.

### Judgment-pass edits

**Dropped 18 rows** (moved out of `final.csv`, not shipped):
- 17 **non-food entries** the classifier shipped on a stray food word — medical /
  veterinary cures and household/garden/laundry/fishing tips: "Cubeb berries for
  catarrh", "Corn salve", "Corns and bunions, cure for" (×2), "Corns, cure for",
  "Chicken cholera"/"…cure for", "Chicken gapes, cure for", "Kidney disease, cure
  for", "Fish/Fishes/Game, how to catch", "Fruit trees, how to remove insects
  from", "Remove fruit spots from cotton goods", "Freckles/Frozen hands/Felon cure
  for" (merged), "Hints to cake bakers", "Butter, how to cure". (A keyword safety
  net re-scan of the shipped set for cure/salve/disease/etc. came back clean.)
- 1 **OCR duplicate** ("Broiled oysters >" — dup of "Broiled oysters", p40).

**Cleaned 10 OCR names** (trailing debris / typos): "Corn cakes j"→"Corn cakes",
"Apple custard pies °"→"Apple custard pies", "Apple pie °"→"Apple pie", "Corn
starch pudding '"→"Corn starch pudding", "Indian steam loaf, o"→"Indian steam
loaf", "Hermits . ■"→"Hermits", "Fig- cake"→"Fig cake", "Marble cholocate
cake"→"Marble chocolate cake", "Stufifed bell peppers"→"Stuffed bell peppers",
"Pot pie- chicken, veal or lamb"→"Pot pie, chicken, veal or lamb".

**Category hand-fixes (11):** "Cider vinegar"→Sauces & Condiments (vinegar, not a
drink), "Veal turnover"→Mains (savory), "Corn starch pudding"→Desserts (cornstarch
dessert, not a corn-veg side), "Beefsteak and onions"→Mains, "Tomato soy"→Sauces &
Condiments (tomato condiment), "String beans, how to pickle"/"Spiced tomatoes"/
"Spiced peaches"/"Spiced apples"/"Preserve eggs for six months…"/"Brine that
preserves butter a year"→Preserves & Pickles.

Required savory-in-Desserts / sweet-in-Mains grep after fixes: **clean.** The only
savory-word Dessert is "Pork cake" (p19), which is correct — a 19th-c. spiced pork
*fruitcake*, a genuine dessert.

### Counts and histogram

- **525 raw index → 258 shipped, 246 held, 21 withheld/dropped** (18 hand-dropped
  this pass; `stats.json` updated).
- Links: **258 / 258 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 525` (withheld 51% > 5%).

| category | count | % |
|---|---:|---:|
| Desserts | 151 | 59% |
| Mains | 16 | 6% |
| Sides | 16 | 6% |
| Soups & Stews | 15 | 6% |
| Preserves & Pickles | 15 | 6% |
| Breads | 14 | 5% |
| Drinks | 12 | 5% |
| Sauces & Condiments | 11 | 4% |
| Breakfast & Brunch | 8 | 3% |

**Desserts (59%) legitimately dominates** — stated out loud (rule 8), NOT a
classifier artifact. The book devotes ~pages 1–31 to a massive cakes+candies+ices
range (~60 cakes alone: Allentown, Almond, Angel, Beverly, Caramel, Chocolate,
Composition, Dover, Minnehaha, Sunshine, Washington…) plus a pies chapter (84–88)
and a puddings chapter (88–96). Redistributing real cakes/candies/pies to hit the
~35% cap would misclassify them, so they stay. 9 of 11 categories present (no
Salads / Basics — the book has neither).

### Held (246) / dropped — the honest residual

Held is high (~47%) because ~half the raw index is **non-food**: household
remedies ("Ague cure", "Bee stings", "Cement for china", "Ink"), veterinary
cures, farm/garden/laundry formulas, and toilet preparations — the name
classifier correctly finds no meal-role signal and holds them, plus the usual
generic labels and lone qualifiers. This is the honest character of a Victorian
receipt book, not a classification failure. The shipped 258 are the confident
food recipes.

### Unsure — for owner audit

- A few **"corn cakes"** entries (pp. 1–2, "Corn cakes"; p37 "Green corn cakes")
  ship as **Desserts** on the cake word; some may be savory johnnycakes/corn
  fritters (Breakfast/Sides). Left as printed — they sit in the early cake pages.
- The held residual still contains a handful of food recipes whose one-word names
  carry no signal (bare "Pudding", "Cake", etc.); withheld per policy, not lost.
