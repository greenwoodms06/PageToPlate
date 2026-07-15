# Contributing a cookbook content pack

How to turn a public-domain cookbook on [archive.org](https://archive.org)
into a **linked content pack** — a recipe index where every entry deep-links
to the exact page in the Internet Archive's online reader, installable from
the app's Library. Packs live in this repo (`public/packs/`) and arrive as
pull requests.

## Prerequisites

- Python 3 (3.10+; the scripts are stdlib-only — no pip installs)
- A clone of this repo
- Patience for the judgment pass: OCR of 100-year-old books is messy, and
  every pack needs a human pass before merging

## Licensing — read this first

Only **clearly public-domain** works are curated: for the US that means
published before 1930 (the triage query already filters to 1800–1930 and
excludes access-restricted items). Lending-library/borrow-only items are
excluded even when readable online. If an item's rights are unclear, skip it.
Index-only packs of in-copyright books (names + page numbers, no links, no
content) are a separate path — see `tools/build_pack.py`.

## The pipeline

```
triage  →  extract  →  judgment pass (human)  →  apply  →  verify-links  →  PR
```

All commands are subcommands of `tools/curate_packs.py`. Every network fetch
is rate-limited (≥0.7 s between requests) and cached under
`tools/curation/.cache/` (gitignored), so re-runs are free.

### 1. `triage` — find candidate books

```
python3 tools/curate_packs.py triage --max 150
```

Scans the archive.org search for downloadable pre-1931 cookbooks, scores each
by deep-link resolvability, index size, OCR quality, and popularity, and
writes `tools/curation/candidates.{md,json}`. Already run — check the
committed `candidates.md` before re-running; pick a book (its `identifier`)
from the top of the table.

> **Correction to the spec:** `cookbook-app-spec.md` says to seed from
> archive.org's `collection:cbk` (Cookbook and Home Economics Collection).
> That collection is **stale — only 2 items live** at the time of writing
> (verified against the API, 2026-07-15). Triage uses
> `subject:cookery AND mediatype:texts AND year:[1800 TO 1930]` instead,
> which returns ~2,200 items.

### 2. `extract` — deterministic structure pass

```
python3 tools/curate_packs.py extract <identifier>
```

Fetches the book's **full** OCR text (uncapped — triage's 1.5 MB cap cuts
off back-of-book indexes; Escoffier's sits in the last 15% of a 2.26 MB
file), finds **all** CONTENTS/INDEX-like sections across the whole file, and:

- picks the **recipe-level** section (the one with the most `name … page`
  lines — usually the back-of-book alphabetical index, not the front
  chapter contents) and parses its entries. The parser tolerates dotted
  leaders (`name …… 123`), comma form (`name, 123`), multi-page lists
  (first page wins), recipe-number prefixes (`1755 Aiguillettes…`),
  two-column line wrapping, and skips `See …` cross-references;
- picks the **chapter-level** CONTENTS and turns it into page ranges, then
  categorizes each recipe by the chapter its page falls in, mapped through
  the app's category synonym table (ported from `src/data/categories.ts`,
  including the appetizer auto-tag). Chapters that don't map — most
  period-specific ones — leave the category **null** for you;
- resolves every printed page number against the book's reader page map to
  a positional deep link (`…/details/<id>/page/n<leafIndex>`, status
  `verified`). Unresolvable pages get the plain details URL and status
  `unverified` — the app shows those with a "page unverified" badge, and
  finding the page in the reader (search-inside) is manual for now.

Output, in `tools/curation/books/<identifier>/`:

| file         | what it is |
|--------------|------------|
| `draft.json` | machine draft: book metadata + every entry `{name, page, chapter, category, tags, url, pageStatus}` |
| `review.md`  | human summary: counts, category histogram, chapter map, first 30 entries, and **every entry needing judgment** (null category or OCR-garbled name) |
| `notes.md`   | your scratchpad: a `Tags:` line for book-level tags + a judgment-pass log |

The command prints a self-check (entry count, %verified, null-category
count). If the entry count looks like a chapter count (tens, not hundreds or
thousands), the book probably has no recipe-level index — pick another book.

### 3. Judgment pass — the human (or AI-assisted) step

This is where dish knowledge enters; nothing here is automatable by regex.
Work from `draft.json` + `review.md` and produce
`tools/curation/books/<identifier>/final.csv` with columns:

```
name,page,category,tags,url,pageStatus
```

What the judgment pass does:

1. **Fill null categories.** The extractor only categorizes what a chapter
   range + synonym table can prove. "Consommé à l'Impératrice" is a soup and
   "Suprêmes de Volaille" is a main — you know that; the script doesn't.
   Use the app's 11 categories (or their synonyms — `apply` maps them):
   Mains, Sides, Soups & Stews, Salads, Breakfast & Brunch, Breads,
   Desserts, Drinks, Sauces & Condiments, Preserves & Pickles, Basics.
2. **Fix OCR-garbled names** (flagged in review.md): `pur^e` → `purée`,
   `k la Carmelite` → `à la Carmélite`, stray recipe-number residue, etc.
   Drop entries that aren't recipes (cross-references, column headers that
   slipped through).
3. **Add sparse tags** where they help filtering (e.g. `chicken`, `game`).
   Don't tag words already in the recipe name — the app filters by name
   substring, and `apply` drops such tags anyway.
4. **Book-level tags**: put them on the `Tags:` line in `notes.md` (or pass
   `--book-tags` to `apply`). Tags from the cuisine vocabulary (french,
   italian, american, british, …) become the catalog entry's `cuisines`.
5. **Log what you did** under "Judgment pass log" in `notes.md`.

Keep `url`/`pageStatus` from the draft unless you have reason to change them.

### 4. `apply` — build the pack

```
python3 tools/curate_packs.py apply <identifier> [--book-tags "french, classic"]
```

Reads `final.csv`, applies the app importer's normalization (category
synonym map + appetizer auto-tag, tag lowercase/dedupe/drop-if-in-name,
keep-first dedupe on name+page), and writes:

- `public/packs/<identifier>.json` — the pack file
- an entry in `public/packs/catalog.json` (title/author/year from archive
  metadata, country from the publisher imprint, `era: "historical"`,
  `type: "linked"`; override with `--title/--author/--country` if wrong)

It **refuses to write** if any category fails to map, prints a category
histogram for an eyeball check, and warns on blank categories (those install
as Uncategorized).

### 5. `verify-links` — link smoke test

```
python3 tools/curate_packs.py verify-links <identifier> --sample 8
```

HEAD-requests a spread of entry URLs and asserts HTTP 200. **Know what this
does and doesn't prove:** archive.org returns 200 for *any*
`/details/<id>[/page/nN]` path with a valid identifier, so this catches
malformed identifiers/paths — it cannot detect a link that lands on the
*wrong page*. Page accuracy is the human spot-check below.

### 6. PR checklist

- [ ] `python3 tools/curate_packs.py selftest` passes
- [ ] Pack JSON matches the schema below (`apply` output is already valid;
      don't hand-edit it afterwards)
- [ ] **Open 5 deep links spread across the alphabet and confirm each lands
      on (or within a page of) the named recipe** — this is the only check
      that catches page-mapping drift
- [ ] Category histogram in the `apply` output looks sane for the book (a
      dessert book shouldn't be 80% Mains)
- [ ] No unverified-link rate surprise (extraction typically verifies >90%;
      if most links are unverified, say why in the PR)
- [ ] `notes.md` judgment log filled in; commit
      `tools/curation/books/<id>/{draft.json,review.md,notes.md,final.csv}`
      alongside the pack so reviewers can diff draft → final
- [ ] The work is clearly public domain (see Licensing)

## Formats

```jsonc
// public/packs/<id>.json — what installPack() imports
{
  "id": "cu31924000610117",
  "version": 1,
  "book": { "name": "A Guide to Modern Cookery", "tags": ["french"] },
  "recipes": [{
    "name": "Angels on horseback",
    "page": "682",                     // printed page, as a string
    "category": "Sides",               // one of the app's 11 (optional)
    "tags": ["appetizer"],
    "link": {                          // linked packs only
      "url": "https://archive.org/details/cu31924000610117/page/n707",
      "pageStatus": "verified"         // "verified" | "unverified"
    }
  }]
}

// public/packs/catalog.json — what the Library lists
{ "catalogVersion": 1, "packs": [{
  "id": "cu31924000610117",
  "title": "A Guide to Modern Cookery",
  "author": "Escoffier, A. (Auguste)",
  "year": 1907, "country": "GB",
  "cuisines": ["french"], "era": "historical", "type": "linked",
  "recipeCount": 2991, "categories": ["Mains", "Soups & Stews"],
  "file": "packs/cu31924000610117.json",  // relative to the app's BASE_URL
  "version": 1
}]}
```

Deep-link ground truth (pinned by `selftest`): the reader URL
`/details/{id}/page/n{N}` takes the page's **positional index** in the
flattened BookReader spread list — *not* the `leafNum` field, and not the
printed page number.

## Future sources

- **MSU Feeding America** (Michigan State University's digital cookbook
  collection) publishes *structured recipe XML* — per-recipe markup, not
  OCR — on a different site. A cleaner source than index parsing for the
  books it covers; a possible future pipeline, not built yet.

## See also

- `tools/README.md` — the CSV pipeline these packs share normalization with
- `background/design_handoff_pagetoplate/cookbook-app-spec.md` § Content
  Packs — the product spec (note the `collection:cbk` correction above)
- `src/data/categories.ts` — the category decision record the synonym table
  is ported from
