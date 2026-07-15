# cookingscholbost00farmrich — curation notes

Tags: american, classic

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Judgment pass 2026-07-15. Fannie Merritt Farmer, *The Boston Cooking-School
Cook Book* (1918). Categorized by the **name-based classifier**
(`curate_packs.py classify`), NOT by chapter map — see why below. Deterministic
and re-runnable: `python3 tools/curate_packs.py classify cookingscholbost00farmrich`
regenerates final.csv / needs_review.csv / dropped.csv from draft.json.

### Why a name classifier (not chapter ranges)

This book is a **hierarchical, alphabetical back-of-book index**: sub-recipes
are printed under a parent noun with the parent ELIDED, so the raw extracted
name is just the qualifier —

```
Acid, Acetic        12
  Butyric           8     (really "Acid, Butyric")
  Citric            13    (really "Acid, Citric")
Cake
  Devil's Food, I   511   (really "Cake, Devil's Food")
  Broiled           199   (a lone method qualifier under "Beef")
```

The extractor keeps the **correct page link** (99.9% verified) but cannot
recover the parent noun, and this edition's TABLE OF CONTENTS parses to a single
line, so chapter-range categorization has nothing to work from — every draft
entry came out `category: null`. Categories therefore had to come from the
recipe NAME. Per the task: **categorize by name, drop pure fragments, do NOT
reconstruct parent nouns** (the truncated names ship as-is with their correct
links — acceptable for a page-linking randomizer).

### Classifier (reusable — `classify_name` / `is_fragment` in curate_packs.py)

- Categories are MEAL ROLE (src/data/categories.ts), never cuisine/technique.
- Inverted index names resolve on the **head noun before the first comma**:
  "Cake, Rice" → Cake → Desserts; "Soup, Tomato" → Soup → Soups & Stews.
- Ambiguous dish words carry HONEST confidence and resolve by qualifier:
  "Apple Pie" → Desserts 0.85 but "Chicken Pie" → Mains 0.85, bare "Pie" →
  Desserts 0.40 (review); "Chocolate" alone → Drinks 0.40 (review).
- OCR repair: this scan renders accented vowels as digits ("Canap6s", "Caf6",
  "Saut6d", "Glac6e", "Consomm6", "Frapp6") — a digit adjacent to a letter is
  turned back into `e`, which recovered a large block of Desserts/Drinks/Sides.

### Fragment drops (250, reason "fragment", all logged in dropped.csv)

`is_fragment` drops index rows with a leading conjunction/preposition ("and
Rice Croquettes", "of Beef, larded", "with Cheese", "au Gratin", "k la
Newburg" = OCR of "à la"), bare roman numerals, and <4-letter noise. These are
truncated TAILS with no head noun — keeping them would ship broken names.
Spot-checked: none are complete recipes.

### Category source: chapter-map first, else name

`classify` still tries the chapter→category synonym map first for any entry
whose draft `chapter` maps cleanly (so a book WITH a usable chapter map isn't
forced through the name path); this book has no such map, so all 3,363 kept
entries were name-classified.

### Reusable keyword-table additions made this pass (~14 groups, all in
`_RULES` / the ingredient sets — reusable across future name-only books)

Beyond the task's starter lists, added by reading needs_review.csv residuals:
seafood (eel, mussel, whitebait, pickerel, turbot, crawfish, whitefish…);
French savory pastry → Sides+appetizer (rissoles, croustades, cromesquis,
ramequins, vol-au-vents, bouchées); cheese/gnocchi/anchovy/noodles/greens/pilaf
→ Sides; julep → Drinks; napoleons + caramel/bars/fingers/tapioca +
cocoanut/coconut/vanilla/maple/snow cake-and-cookie hints → Desserts; compound
**butter** resolver (fruit butter → Preserves, peanut → Sides, cocoa/drawn →
Basics, else Sauces); **balls / patties / dumpling** resolvers; **ice**
resolver (guards "Ice Chest, Care of"); "ice cream" pre-check (beats bisque/
bread: "Walnut Bisque Ice Cream" → Desserts); jelly "roll" → Desserts. A dozen
iconic mis-hits were fixed at the table so the fix is reusable, not one-off.

### Final histogram (3,363 kept, 250 dropped)

| category | count |
|---|---:|
| Uncategorized | 966 |
| Desserts | 782 |
| Mains | 494 |
| Sides | 404 |
| Sauces & Condiments | 186 |
| Soups & Stews | 108 |
| Breads | 91 |
| Drinks | 90 |
| Salads | 71 |
| Preserves & Pickles | 62 |
| Breakfast & Brunch | 58 |
| Basics | 51 |

- Auto-classified at confidence ≥0.45: **2,203 / 3,363 (65.5%)**.
- Links: **3,362 / 3,363 verified (100.0%)** (the one unverified draft entry
  was dropped as a fragment).

### needs_review.csv (1,160 entries = 34.5% of kept) — the honest residual

- 194 low-confidence but categorized (a defensible best-effort guess).
- 966 Uncategorized (no name signal), of which:
  - **897 = baseless truncated qualifiers** — lone place/color/style/method
    words ("Russian", "Harvard", "White", "Boiled") whose parent noun was
    elided in the index. Name-based classification genuinely cannot categorize
    these, and reconstructing the parent is out of scope. **This is the
    hierarchical-index truncation limitation** (see findings/).
  - 69 non-recipe reference lines the index included ("Wood Floors, to Polish",
    "Composition of", "Food Requirements of Adults" — the book's food-science
    front matter + household-hint back matter). Kept with correct links,
    Uncategorized; a follow-up recipe/non-recipe filter could prune them.

**Target miss, stated out loud (contract rule 8):** the <10% needs-review goal
is not reachable on this extreme hierarchical index by name alone — ~27% of
entries are lone truncated qualifiers. Getting under 10% would require either
reconstructing parent nouns (explicitly out of scope) or fabricating categories
for signal-free names (violates "never invent"). The reusable classifier is
maxed on the genuinely name-bearing entries (histogram reads like a real
American cookbook: Desserts-heavy, all 11 categories present, no >25% category);
the residual is documented rather than papered over.
