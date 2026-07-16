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
recipe NAME. Policy: **categorize by name, DROP pure fragments, HOLD the
unrecoverable truncated/lone-qualifier entries, do NOT reconstruct parent
nouns** — ship only confidently-classified self-contained recipes (clean-subset
policy, witness P2P-007; see the dedicated section below).

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

### CLEAN-SUBSET policy (2026-07-15, witness P2P-007) — this pack is a curated subset

`classify` now enforces the clean-subset policy. `final.csv` (what ships) holds
ONLY entries that are **confidently classified self-contained recipes**;
everything unrecoverable is withheld, never fabricated. Three outcomes:

- **clean → final.csv (SHIPPED):** a resolved category at confidence
  ≥ `CLEAN_THRESHOLD` (0.45), and NOT a lone truncated qualifier.
- **held → needs_review.csv (NOT shipped):** low-confidence guesses + signal-
  free names (lone place/color/method words like "Russian", "White") + lone
  best-effort qualifiers + bare dish-type labels. These are the honest residual
  for a future human/LLM pass; they are not in the pack.
- **dropped → dropped.csv:** pure fragments (leading conjunction/preposition —
  "and Rice Croquettes", "of Beef larded", "au Gratin", "k la Newburg" = OCR of
  "à la"; bare roman numerals; <4-letter noise).

Two extra gates beyond the raw threshold keep truncated lone-qualifiers OUT of
the shipped subset (they'd otherwise clear 0.45 and read as broken names):

- **lone-word gate** (`LONE_QUALIFIER_MAX_CONF` 0.5): a single-word name placed
  only by a best-effort tail rule ("Lemon", "Banana", "Scalloped", bare
  "Souffle") is held — a real one-word dish scores higher via a dish-noun rule
  ("Junket" 0.85, "Hash" 0.55) and still ships.
- **generic-head-noun gate** (`GENERIC_HEAD_NOUNS`): a bare dish-TYPE label
  ("Sauce", "Jelly", "Pudding", "Soup") is held at any confidence — in this
  index the qualifier was elided and "Sauce" survived on 29 different pages, so
  shipping them would mean dozens of identical broken names. Ingredient-as-dish
  names (bare "Asparagus", "Onions", "Bacon") and specific dishes (Gingerbread,
  Doughnuts, Junket) are deliberately NOT gated — they read as real recipes.

### Reusable keyword-table additions (all in `_RULES` / ingredient sets / gates)

From reading the needs_review residual across passes:
seafood (eel, mussel, whitebait, pickerel, turbot, crawfish, whitefish…);
common **meat cuts** (tenderloin, sirloin, loin, ribs, brisket, rump → Mains);
French savory pastry → Sides+appetizer (rissoles, croustades, cromesquis,
ramequins, vol-au-vents, bouchées); cheese/gnocchi/anchovy/noodles/greens/pilaf
→ Sides; julep → Drinks; napoleons + caramel/bars/fingers/tapioca +
cocoanut/coconut/vanilla/maple/snow cake-and-cookie hints → Desserts; compound
**butter** resolver; **balls / patties / dumpling** resolvers; **ice** resolver
(guards "Ice Chest, Care of"); "ice cream" pre-check; jelly "roll" → Desserts;
**"X with Y Sauce" head-split** — the dish is the head before " with " so
"Porterhouse Steak with Mushroom Sauce" → Mains, not Sauces. Reusable, not
one-off.

### Clean histogram (1,737 shipped)

| category | count |
|---|---:|
| Desserts | 511 |
| Mains | 397 |
| Sides | 332 |
| Sauces & Condiments | 123 |
| Soups & Stews | 73 |
| Breads | 62 |
| Breakfast & Brunch | 51 |
| Basics | 48 |
| Drinks | 47 |
| Preserves & Pickles | 47 |
| Salads | 46 |

Reads like a real American cookbook: Desserts-leaning, all 11 categories
present, top category ~29% (none dominates). No Uncategorized — blanks/no-signal
names are held, not shipped.

### Counts and the deviation from the ~2,200 estimate (stated out loud, rule 8)

- **3,616 raw → 1,737 clean (48.0%) shipped, 1,628 held (45.0%), 251 dropped
  (6.9%).** Links: **1,737 / 1,737 verified (100%)**; `verify-links --sample 8`
  → 8/8. (Raw rose 3,613 → 3,616 when the `SPACED_CONTENTS_RE` extractor fix
  added a few dotless entries; the TOC also now parses 22 roman-numeral-prefixed
  chapters that don't map, so FF stays name-classified.)
- Witness P2P-007 estimated "~2,200 clean". The bare confidence≥0.45 rule alone
  yields ~2,200, but that subset still ships lone truncated qualifiers ("Lemon",
  "Banana") and bare dish-type labels ("Sauce" ×29, "Jelly" ×10) that FAIL the
  "self-contained real recipe" spot-check the policy calls for. The two gates
  above hold those, so the honestly-self-contained subset is **1,737**, not
  ~2,200. This is a stricter (more honest) application of the SAME policy — no
  names fabricated, no categories invented — logged here as a deliberate,
  out-loud deviation from the estimate.
- The ~44.9% held is the irreducible cost of an extreme hierarchical index
  under OCR (P2P-007): most held entries are lone qualifiers or garbled/non-
  recipe lines that name-based classification genuinely cannot place, and
  reconstructing parent nouns is out of scope. Held ≠ lost — it is the queue
  for a later human/LLM pass, not shipped broken.
