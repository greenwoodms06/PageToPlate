# tools/ — pre-import pipeline

Deterministic scripts that turn AI-transcribed cookbook index pages into a clean
CSV the app can import. They run outside the app (Python 3 + pandas); the app
itself stays a simple CSV consumer. See the spec section **"CSV Import"** in
`background/design_handoff_pagetoplate/cookbook-app-spec.md` — especially
*"Lessons from the first real import (1,645-recipe compendium)"* — for the
rationale behind each step.

## Pipeline order

```
organize → enrich (script) → AI region pass → apply reviewed recategorizations
```

### 1. `recipe_organize.py` — gather and merge transcriptions

Interactive. Collects per-section transcription files (one CSV-ish text file per
photographed index/TOC section, columns `Page Number, Recipe Name`), either by
folder glob or a manual file list. For each file it shows a preview and prompts
for that section's **Category** and optional comma-separated **Keywords**, then
merges everything, sorts numerically by page, and writes
`master_recipe_index.csv`.

Parsing is deliberately forgiving: each line is split on the *first* comma only,
so recipe names containing commas survive without strict quoting.

### 2. `recipe_enrich.py` — safe auto-fixes + reviewed recategorization

```
# Pass 1 (propose):
python recipe_enrich.py master_recipe_index.csv
#   -> master_cleaned.csv      safe auto-fixes applied to ALL rows
#   -> review_proposals.csv    flagged rows only; edit the Accept column (YES/NO)
#                              or overwrite Proposed Category with your own
```

Auto-fixes (always applied, no review): category names normalized to the
standard list ("Main" → "Mains", etc.); keywords lowercased, deduped, and any
token already present in the recipe name dropped (the app's filters
substring-match names, so those tags are redundant — section-level tags the
name doesn't carry, e.g. `international`, are kept).

Proposals (need your YES/NO): recategorization by the **head-noun heuristic** —
the words before "with"/"for" and outside parentheses — which catches the
companion-recipe phenomenon ("Stir-Fried Beef *with Oyster Sauce*" stays a Main;
a standalone "Scallion Dipping Sauce" is proposed for Sauces & Condiments).

### 3. AI region pass

Region/cuisine tagging (small fixed vocabulary: italian, french, european,
asian, indian, mexican, latin, middle eastern, african, caribbean, plus
"international" as the umbrella) is done as an **LLM pass over the CSV**, not by
keyword matching — only an LLM knows Carbonara is Italian or Karaage is
Japanese.

> The AI region-pass prompt file was not included in the design handoff — this
> is an unfilled slot; do not invent one.

### 4. Apply reviewed recategorizations

```
# Pass 2 (apply, after editing review_proposals.csv):
python recipe_enrich.py master_recipe_index.csv --apply review_proposals.csv
#   -> master_final.csv        import THIS file into the app
```

## Note on category names

These scripts predate the app and normalize to the spec's original 12-category
list (including "Appetizers & Small Plates", "Desserts & Sweets", "Basics &
Staples"). The app's importer applies the current 11-category mapping (owner
decision, 2026-07-14) at import time — appetizer-vocabulary sections map to
Sides with an auto `appetizer` tag — so CSVs produced here import cleanly
without editing the scripts.

## Content packs — `build_pack.py` (plan Task 25)

Turns a clean index CSV (the pipeline's output, or any name/page/category CSV)
into a content pack the app serves from `public/packs/`:

```
python3 tools/build_pack.py background/atk_index.csv \
  --id atk-complete \
  --name "The Complete America's Test Kitchen TV Show Cookbook 2001–2025" \
  --author "America's Test Kitchen" --year 2025 --country US \
  --cuisine american --era modern --type index-only \
  -o public/packs/atk-complete.json
```

It applies the SAME normalization as the app importer (trim, old-12→new-11
category remap incl. the `appetizer` auto-tag, keyword split + redundancy
filter — mirrored from `src/data/categories.ts` / `src/logic/importer.ts`),
prints a category histogram for an eyeball check, refuses to write a pack
with unmapped categories, and creates/replaces the pack's entry in
`public/packs/catalog.json`.

### Formats

```jsonc
// public/packs/catalog.json — what the Library lists
{ "catalogVersion": 1, "packs": [{
  "id": "atk-complete",
  "title": "The Complete America's Test Kitchen TV Show Cookbook 2001–2025",
  "author": "America's Test Kitchen", "year": 2025, "country": "US",
  "cuisines": ["american"], "era": "modern", "type": "index-only",
  "recipeCount": 1635, "categories": ["Mains", "Desserts", "..."],
  "file": "packs/atk-complete.json",   // relative to the app's BASE_URL
  "version": 1
}]}

// public/packs/<id>.json — what installPack() imports
{ "id": "atk-complete", "version": 1,
  "book": { "name": "…", "tags": [] },
  "recipes": [{ "name": "…", "page": "2", "category": "Soups & Stews", "tags": [] }] }
```

Pack categories are ALREADY the app's 11 defaults — `installPack()`
(src/data/packs.ts) runs them through `planImport` and expects zero
unrecognized. Linked packs add `"link": {"url": …, "pageStatus": …}` per
recipe.

## Linked packs from archive.org — `curate_packs.py`

Public-domain books from the Internet Archive become **linked packs** (every
recipe deep-links to its page in the online reader) via
`tools/curate_packs.py` (`triage` → `extract` → human judgment pass →
`apply` → `verify-links`). The full contributor process, schemas, and PR
checklist live in **[CURATION.md](CURATION.md)**.
