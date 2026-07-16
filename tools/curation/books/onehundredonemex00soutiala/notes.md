# onehundredonemex00soutiala — curation notes

Tags: mexican

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Southworth, May E., *One Hundred & One Mexican Dishes* (Paul Elder & Co.,
San Francisco, 1906). Back-of-book INDEX, section-organized (SOUP / FISH /
MEAT / FOWL / VEGETABLES / MEAT DUMPLINGS / DESSERTS / SAUCES FOR ENCHILADAS /
TORTILLAS / ENCHILADAS / TAMALES / OLLA PODRIDA / breakfast-misc). Extract found
the INDEX (95 entries, 100% deep-link-verified, 0 chapter map) and left every
category null → name-classify path.

This book is unusual: dish names are **Spanish with a parenthetical English
gloss** ("Cordero (Lamb)", "Caldo de Pescado (Fish)"). The gloss usually carries
the meal-role signal, but two things fight the Anglocentric classifier, so this
pack got a real **judgment pass** (CURATION.md §3) on top of `classify`, using
the **section headers as ground truth** (they survive in the OCR index):

1. The **SOUP section** glosses its dishes by their protein ("(Fish)", "(Lamb)"),
   so name-classify sends them to Mains. They are soups.
2. Many self-contained Spanish names have no English keyword at all
   ("Caracoles con Perejil (Snails)", "Patitas con Mani (Pigs' Feet)").

### Reusable classifier additions this pass

Added a small, **reusable** Spanish/Latin dish-type block (helps future
Mexican/Latin/Italian packs; selftest stays green — it exercises no Spanish
names):

- `_SOUP` += `caldo, sopa, pozole, posole, gazpacho` — "Caldo de Pescado (Fish)"
  is a fish **soup**; without this the fish gloss made it a Main.
- `_SAUCE` += `salsa` (Spanish/Italian for sauce) — ships "Salsa Nuez (Nut)"
  correctly and will help the Italian pack.
- New `_LATIN_MAIN` set → Mains 0.7 (`tamale/tamal/enchilada/albondigas/
  empanada/burrito/carnitas/barbacoa/fajita…`) — ships "Albondigas",
  "Albondiguillas", "Hot Tamal".
- New `_LATIN_SIDE` set → Sides 0.6 (`quesadilla/frijoles/nachos/tostada`) —
  ships "Quesadillas".

These moved raw→clean from 66 to 71 before the judgment pass.

### Hand-fixes in final.csv (section-grounded; logged per rule 8)

Category corrections on shipped entries (SOUP section → Soups & Stews):
Cordero (Lamb), Gitano (Beans and Codfish), Mexican Noodle, Rancheros
(Vegetable). Plus: "Emparedado (Hot Cakes)" Desserts→Breakfast & Brunch (hot
cakes = pancakes); "Tortas Serrano (Cheese in Batter)" Basics→Sides (battered
fried cheese, not a "basic").

OCR name repairs on shipped entries (the index two-column-wrapped a
Spanish head across lines, and the extractor kept only the parenthetical tail —
the head was recovered from the raw index text):

| shipped as (raw) | repaired to | fix |
|---|---|---|
| `Beef and Eggs)` p13 | Buey Ahumando y Huevos (Dried Beef and Eggs) | name + Breakfast→Mains |
| `Chile con Carne (Pork)... I` p3 | Chile con Carne (Pork) | name + page 3→13 + url n12→n22 (OCR read "1 3" as page 3) |
| `Tongue)` p16 | Lengua de Buey Concida (Beef's Tongue) | name |
| `Vegetables)` p18 | Pulchero Grueso (Boiled Meat and Vegetables) | name + Sides→Mains |
| `Peas)` p23 | Gallina con Garbanzos (Chicken and Peas) | name + Sides→Mains |
| `Cheese)` p33 | Frijoles con Queso (Beans with Cheese) | name |
| `DESSERTS PAGE Camote y Pina (…)` p47 | Camote y Pina (Candied Sweet Potatoes and Pineapple) | strip glued section header + Sides→Desserts |
| `Milk)` p76 | Cafe con Leche (Black Coffee with Milk) | name; rescued → Drinks |

Rescued self-contained held/dropped entries (real, complete recipe names the
Anglocentric table simply could not read — placed by section, no fabrication):
Almendra (Almond)→Soups, Caracoles con Perejil (Snails)→Mains, Patitas con Mani
(Pigs' Feet)→Mains, Green Chiles→Sides, Huevos de Carne→Mains, Torto Frutas
(Pie)→Desserts, Tortillas de Patatas→Breakfast & Brunch, Criollo Guisado
(Tortillas Fried)→Sides, A la Moda (Chicken and Macaroni)→Mains (this one had
been *dropped* as a leading-"a" fragment — a false drop, cf. the Chinese "Why
Shon" note).

Moved "Tomato" (p57) from shipped → **held**: it is a bare truncated
sauce-variety qualifier ("Tomato [Sauce]", elided parent) — consistent with the
other SAUCES-FOR-ENCHILADAS entries already held ("Chile", "Mexican Chile",
"Cold Colorado").

`stats.json` counts were recomputed to reflect the judgment pass (so `apply`'s
`curatedSubset` / `rawIndexCount` stay honest).

### Counts and histogram

- **95 raw → 80 clean (84.2%) shipped, 15 held (15.8%), 0 dropped.**
- Links: **80 / 80 verified (100%)**; `verify-links --sample 8` → 8/8.
- `curatedSubset: true`, `rawIndexCount: 95` (withheld 15.8% > 5%).

| category | count |
|---|---:|
| Mains | 29 |
| Sides | 24 |
| Desserts | 9 |
| Soups & Stews | 7 |
| Breakfast & Brunch | 6 |
| Breads | 2 |
| Sauces & Condiments | 1 |
| Drinks | 1 |
| Salads | 1 |

Reads like a real Mexican cookbook: Mains 36% (meat/fowl/tamale/enchilada/fish
sections), Sides 30% (a big VEGETABLES/peppers/beans/rice section). 9 of 11
categories present; no Preserves & Pickles and no Basics — the book has neither.
No category runs away past ~36%.

### Held (15) — the honest residual, not shipped

Truncated variety qualifiers whose parent dish-type was elided in the index:
SAUCES-for-enchiladas ("Chile", "Cold Colorado", "Mexican Chile", "Tomato"),
ENCHILADA varieties ("Americano", "Domestico", "Mexican", "Native"), TAMALE
varieties ("Farsanta", "Genuine", "Hacienda", "Laredo's Celeberrino", "Mesa
Redonda"). These read as broken names (the P2P-007 case). Plus two genuinely
ambiguous names left for a future pass: "Artificial Turtle" (mock-turtle — soup
or meat?) and "Bunelos" (Buñuelos — sweet fritter or the savory item the MEAT
DUMPLINGS section implies?).

### Unsure — for owner audit

- "Mollete (Cakes)" p80 → kept **Desserts** on the gloss "(Cakes)". In modern
  Mexico a *mollete* is a savory bread roll (beans + cheese); the 1906 gloss and
  its neighbours (Migas/Pan Relleno = Breads) could argue Breads. Left as the
  classifier placed it.
- "Jamon con Pimientos (Ham)" (raw index p15, MEAT section, a ham main) was
  **lost by the extractor** — its printed page "15" was OCR-split to "1 5" so no
  entry line parsed. One entry out of ~96; not re-inserted (would be hand-
  authoring a row absent from the extraction). Noted for completeness.
