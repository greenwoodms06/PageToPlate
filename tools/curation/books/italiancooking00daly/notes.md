# italiancooking00daly — curation notes

Tags: italian

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Daly, Dorothy, *Italian Cooking* (Spring Books, London). Back-of-book
**alphabetical Index** (686 entries, 100% deep-link-verified) plus a front
**Contents** with 15 parsed chapters. This is a **chapter-map book** (extract's
primary categorization path), NOT a name-classify book — so it was curated via
the documented judgment pass (CURATION.md §3), filling categories from the
chapter the recipe's printed page falls in. `classify` was NOT used: it would
inherit the broken chapter categories described below.

### Extractor caveat — the parsed chapter map is OCR-corrupted (NOT re-extracted)

The front Contents prints its chapter page numbers with OCR damage, which made
the raw draft categorize badly (e.g. "Agnello arrosto" = roast lamb, p137,
landed in **Desserts** because p137 fell inside the mis-parsed "Sweets" range).
Rather than change the extractor (the corruption is *digit misreads*, which no
parser can undo), the true chapter boundaries were read from the **book-body
page markers** and validated against known dishes:

| chapter | Contents says | TRUE printed page | evidence |
|---|---|---|---|
| Meats | `1 29` (split → dropped by parser) | **129** | body `[128]` before "Meats" |
| Salads | `131` | **181** | body `[180]`; "Insalata…" p183 |
| Sweets | `134` | **184** | body `[183]/[184]`; "Zabaione" p185 |
| Sauces | `1 93` (split → dropped) | **198** | body `[197]` before "Sauces" |

("131"/"134" are OCR misreads of 181/184 — the printed **8** read as **3**.)
The other 11 chapter starts parsed correctly (Antipasti 20, Soups 29, Pasta 49,
Ravioli & Gnocchi 67, Rice 74, Polenta 90, Omelettes 94, Fish 101, Poultry &
Game 152, Vegetables 162). Validation spot-checks all passed: agnello p137→Meats,
manzo p130-131→Meats (confirming "131"→181), risotto p77-80→Rice, zuppa
p40-48→Soups, insalata p183→Salads, Zabaione p185→Sweets.

Because the deep links resolve off the (correct) printed-page → reader-position
map, **every link is right** regardless of the Contents corruption — only the
category assignment needed the corrected boundaries.

### Chapter → meal-role mapping (per src/data/categories.ts + task guidance)

Antipasti→Sides (+appetizer tag), Soups→Soups & Stews, **Pasta→Mains**,
**Ravioli & Gnocchi→Mains**, **Rice (risotto)→Mains** (Italian primi are the
main course; the app has no primi/pasta category — Mains carries the `pasta`
chip), Polenta→Sides, Omelettes/Egg & Cheese→Breakfast & Brunch, Fish→Mains,
Meats→Mains, Poultry & Game→Mains, Vegetables→Sides, Salads→Salads,
Sweets→Desserts, Sauces→Sauces & Condiments.

### Held (41) — non-recipe front matter listed in the index

Pages 10-19 of the index are a **glossary**, not recipes: "Weights and measures",
"Cooking temperatures", and the whole *Flavourings, Trimmings & Spices* ingredient
list ("Basil", "Garlic", "Parmesan", "Olive oil", "Salt", "Thyme"…). These are
held, not shipped.

### Audit cross-check (name classifier vs. chapter) + hand-fixes

Ran `classify_name` over every shipped entry and surfaced the 19 high-confidence
name-vs-chapter clashes. **The chapter was right in almost every case** — the
name classifier is fooled by "salsa/sauce/puree" inside a meat/fish dish name:
"Coniglio in salsa piccante" (rabbit) and "Tongue with sauce" are **Mains**, not
Sauces; "Chicken, broth" is **Soups**, not a chicken main; "X sauce" entries
inside the *Sauces* chapter are correctly Sauces. This is strong validation that
chapter-range beats name-classification for this book.

Two genuine hand-fixes from the cross-check (logged, rule 8): **"Stock"** and
**"Stock pot"** (p30, in the Soups chapter) → **Basics** — foundational stocks,
not soups (adds the only Basics entries). One OCR name repair: "Zahaglione" →
**"Zabaglione (Zabaione)"** (p185).

Required savory-in-Desserts / sweet-in-Mains grep: clean (the only hit,
"Fish cakes"→Mains, is a savory fish cake, correct).

### Counts and histogram

- **686 raw index → 645 clean (94.0%) shipped, 41 held (6.0%), 0 dropped.**
- Links: **645 / 645 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 686` (withheld 6.0% > 5% — the glossary).

| category | count | % |
|---|---:|---:|
| Mains | 305 | 47% |
| Sides | 110 | 17% |
| Sauces & Condiments | 79 | 12% |
| Soups & Stews | 52 | 8% |
| Desserts | 43 | 7% |
| Breakfast & Brunch | 40 | 6% |
| Salads | 14 | 2% |
| Basics | 2 | 0% |

8 of 11 categories present. No Breads / Drinks / Preserves & Pickles — the book
has no such chapters (its fried-bread items live in Antipasti → Sides). **Mains
47% is the honest character of an Italian cookbook**, not a skew: pasta, ravioli
& gnocchi, rice/risotto, fish, meats, and poultry & game are six separate
chapters that all fold into the single Mains meal-role (the app has no
primi/secondi split). Sauces at 12% is likewise real — Italian cooking is
sauce-heavy. Stated out loud per rule 8; not redistributed.

### Unsure — for owner audit

- **Metadata year = 1900 looks wrong.** The book is "Printed in Czechoslovakia"
  for Spring Books, London (a mid-20th-century imprint). `apply` took 1900 from
  archive.org metadata; I did not override it (no trustworthy external date to
  substitute). Flagging for a possible `--year` correction. Public-domain status
  should be re-confirmed if the true date is later than 1930.
- A handful of composed "X salad" dishes sit in the Fish/Vegetable chapters
  (e.g. "Fish salad" → Mains) rather than the Salads chapter; kept at the
  author's chapter placement rather than reclassified by the word "salad".
