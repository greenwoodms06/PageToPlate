# cu31924000610117 — curation notes

Tags: french, classic

<!-- Book-level tags for `apply`, comma-separated after 'Tags:' above — e.g. french, classic. Tags in the cuisine vocabulary
     (french, italian, ... — see CUISINE_VOCAB in curate_packs.py) also become the catalog entry's cuisines. -->

## Judgment pass log

Judgment pass 2026-07-15, encoded in `classify.py` (deterministic, re-runnable:
`python3 classify.py` regenerates final.csv from draft.json). Draft 2,991
entries -> final 2,981 kept, 10 dropped, 369 names repaired.

### Chapter -> category map (categories are MEAL ROLE per src/data/categories.ts)

| chapter (as OCR'd) | category | rationale |
|---|---|---|
| (no chapter, pp. 2–22) | Basics / Sauces & Condiments | the "fonds de cuisine" part precedes the first parsed chapter: stocks, consommé bases, glazes, essences, roux -> Basics; leading sauces (Espagnole, Velouté, Béchamel, Hollandaise, tomato, half-glaze) -> Sauces & Condiments (split on name) |
| THE SMALL COMPOUND SAUCES | Sauces & Condiments | compound sauces |
| COLD SAUCES AND COMPOUND BUTTERS | Sauces & Condiments | cold sauces, flavoured butters |
| SAVOURY JELLIES OR ASPICS | Basics | aspic jellies are foundation preparations, not dishes |
| THE COURT-BOUILLONS AND THE MARINADES | Basics | cooking liquids/marinades |
| ELEMENTARY PREPARATIONS | Basics | forcemeats, panadas, essences — components |
| THE VARIOUS GARNISHES FOR SOUPS | Basics | royales/profiteroles are garnish components, not soups |
| GARNISHING PREPARATIONS FOR RELEVES AND ENTREES | Basics | garnish preparations |
| LEADING CULINARY OPERATIONS | Basics | braisings, fryings, gratins — technique sections |
| HORS-D'OEUVRES | Sides | + `appetizer` tag (app convention: appetizers merged into Sides) |
| EGGS | Mains | Escoffier's egg dishes are savoury entrée courses in French service, NOT breakfast — Breakfast & Brunch would misread the book |
| SOUPS | Soups & Stews | (extractor already mapped) |
| FISH | Mains | fish courses; exceptions: Bouillabaisse, Waterzooi -> Soups & Stews (served as the soup course) |
| RELEVES AND ENTREES OF BUTCHER'S MEAT | Mains | meat courses (daubes/navarins stay Mains — plated main-course role) |
| RELEVES AND ENTREES OF POULTRY AND GAME | Mains | + `game` tag on clear game animals (see below) |
| ROASTS AND SALADS | split | names containing "salad" -> Salads; Yorkshire pudding -> Sides (roast accompaniment); stuffings -> Basics; rest -> Mains |
| VEGETABLES AND FARINACEOUS PRODUCTS | Sides | vegetable/pasta side courses |
| SAVOURIES | Sides | savoury toasts/tartlets (end-of-meal small plates; not tagged appetizer — they are not) |
| ENTREMETS (SWEETS) | split by page | pp. 687–712 are the pastry-foundations section (pastes/doughs, sugars, creams, crusts) -> Basics; plated sweets start p. 713 -> Desserts |
| ICES AND SHERBETS | Desserts | iced desserts |
| DRINKS AND REFRESHMENTS | Drinks | bavaroise, bishop, orangeade, kaltschale |
| FRUIT-STEWS AND JAMS | Preserves & Pickles | compotes, jams, jellies; exception: the three p. 860 "Bowl or Coupe" entries are iced desserts printed in the addenda -> Desserts |

### Standing decisions

- **Index-style inverted names kept as-is** ("Apples, Irène", "Capon, with
  celery") — it is how the book's index reads and how users will search it.
- **Diacritics restored only where the OCR shows a mangled character**
  (`^`, `6`, `9`, `M`/`W` mid-word, etc.) and the dish name makes the accent
  certain (purée, Consommé, Provençale, Sévigné…). Plain-letter spellings the
  index printed without visible damage ("Consomme Fermiere", "a la") are left
  plain rather than guessed.
- **Wrapped index lines**: the printed index wraps long entries; the extractor
  emitted 39 second-half fragments as stand-alone entries ("France" p484,
  "Gene" p860…). Each was reconstructed against the raw OCR index and renamed
  to the full entry ("Capon or pullet, Isabelle de France", "Bowl or Coupe
  Madame Sans-Gêne"). One kept short deliberately: "Espagnole" p18 (full line
  is "Sauces, principal, brown sauces or Espagnole" — the short form is the
  recognizable recipe name).
- **OCR comma-as-period** in mid-name position normalized to comma ("Capon or
  pullet. Lady Curzon" -> ", Lady Curzon"); St./Ste./e.g. guarded.
- "Pig's trotters, Ste. M^nihould" -> "Ste. Menehould" (standard spelling of
  Sainte-Menehould; the OCR'd accent placement was not trustworthy).

### Drops (10, all logged by classify.py)

1 artifact: "Beans, No" p2155 — index cross-reference ("Beans, No. 2155"
points at a recipe number, not a page; the draft's only unverified link).
9 bare chapter/section headers that duplicate their own category: Sauces
(p15), Soups (p197), Eggs (p164), Fish (p260), Roasts and salads (p605),
Salads (p615), Savories (p678), Ices (p788), Jams (p820). Method/overview
entries with real instructional content ("Omelets" p185, "Sherbets" p813,
"Jams, the cooking of", "Roux" p16) were kept.

### Tags (sparse per the app's redundancy rule)

- `appetizer` on the HORS-D'OEUVRES chapter (115 entries) — mirrors the app's
  appetizer-section auto-tag.
- `game` (172 entries) on poultry-and-game / roasts chapter entries whose name
  is a clear game animal (pheasant, partridge, grouse, quail, woodcock, snipe,
  hare, roebuck, teal, ortolan, …) — filter value the name substring "game"
  does not give.
- No cuisine tags per recipe; book-level tags above.

### Final histogram (2,981 entries, all categorized)

| category | count |
|---|---:|
| Mains | 1,375 |
| Desserts | 522 |
| Sides | 427 |
| Basics | 218 |
| Soups & Stews | 213 |
| Sauces & Condiments | 144 |
| Salads | 43 |
| Preserves & Pickles | 21 |
| Drinks | 18 |

Empty categories: Breakfast & Brunch, Breads — correct for this book (no
bread chapter; EGGS deliberately Mains, see above).

Links: 2,981/2,981 verified (the draft's single unverified entry was the
dropped "Beans, No" artifact — every kept entry is verified).
