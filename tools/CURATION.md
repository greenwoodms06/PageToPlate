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
                          │
                          └─ or: classify  (name-based, for hierarchical-index
                                            books whose categories can't come
                                            from a chapter map — see § 2b)
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

### 2b. `classify` — name-based meal-role categorization (CLEAN-SUBSET policy)

```
python3 tools/curate_packs.py classify <identifier> [--threshold 0.45]
```

Use this when the book is a **hierarchical / alphabetical index** and `extract`
left every category null because it found no usable chapter map (the printed
CONTENTS parses to a line or two). The classic case is Fannie Farmer's *Boston
Cooking-School Cook Book* (`cookingscholbost00farmrich`): sub-recipes are listed
under a parent noun with the parent **elided**, so the raw name is just the
qualifier — `Butyric` under `Acid`, `Broiled` under `Beef`, `Devil's Food`
under `Cake`. Page links stay correct (~99.9% verified); the name loses its head
noun. `classify` reads meal ROLE off the recipe NAME instead of the chapter.

#### The clean-subset policy (witness P2P-007)

`classify` does **not** ship everything it can label. It ships only the entries
it can classify as **confidently self-contained recipes**, and withholds the
rest — because a hierarchical index flattened under OCR leaves a real fraction
of names as lone truncated qualifiers ("Russian", "White", "Sauce") that read
as broken. **Reconstructing the elided parent noun was investigated and
REJECTED** (P2P-007): `djvu.txt` preserves no indentation — every line is
flush-left — and the alphabetical carry-down trick fabricates ~1/3 of names.
We never fabricate a name, and never invent a category to hit a target.

So each draft entry gets exactly one of three verdicts (`classify_entry`):

| verdict | goes to | what it is |
|---------|---------|------------|
| **clean** | `final.csv` — **SHIPPED** | a resolved category at confidence ≥ `--threshold` (default `CLEAN_THRESHOLD` = 0.45), and not a lone truncated qualifier |
| **held** | `needs_review.csv` — **NOT shipped** | low-confidence guesses, signal-free names, lone qualifiers, bare dish-type labels — the honest residual for a future human/LLM pass |
| **dropped** | `dropped.csv` | pure fragments (`is_fragment`): a leading conjunction/preposition (`and Rice Croquettes`, `of Beef larded`, `au Gratin`, `k la Newburg` = OCR of *à la*), a bare roman numeral, only function words, or < 4 letters |

`final.csv` is therefore the **clean subset** — every row already has a resolved
category, so `apply` ships a clean pack (no blank categories, no Uncategorized).

How a kept entry is categorized:

1. **Chapter-map first** — if the entry's draft `chapter` still maps cleanly
   through the category synonym table, that wins (confidence 1.0), so a book
   that DOES have a usable chapter map isn't forced through the name path.
2. **Name-classify** (`classify_name`) — otherwise, categorize by dish /
   head-noun keywords. Categories are **meal role** (`src/data/categories.ts`),
   never cuisine or technique. Inverted names resolve on the head noun **before
   the first comma or " with "** (`Cake, Rice` → Desserts; `Steak with Mushroom
   Sauce` → Mains, not Sauces). Ambiguous dish words carry an **honest
   confidence**: `Apple Pie` → Desserts 0.85 but `Chicken Pie` → Mains 0.85;
   bare `Pie` → 0.40; `Chocolate` alone → Drinks 0.40. (It also repairs OCR of
   accented vowels as digits — `Canap6s` → canapé.)

Two gates keep truncated lone-qualifiers OUT of the shipped subset even when
they clear the raw threshold (they'd otherwise read as broken names):

- **lone-word gate** (`LONE_QUALIFIER_MAX_CONF` = 0.5): a single-word name
  placed only by a best-effort tail rule ("Lemon", "Banana", "Scalloped") is
  held; a real one-word dish scores higher via a dish-noun rule ("Junket" 0.85,
  "Hash" 0.55) and ships.
- **generic-head-noun gate** (`GENERIC_HEAD_NOUNS`): a bare dish-TYPE label
  ("Sauce", "Jelly", "Pudding", "Soup") is held at any confidence — in a
  flattened index the qualifier was elided and "Sauce" survives on dozens of
  pages, so shipping them means dozens of identical broken names. Ingredient-as-
  dish names ("Asparagus", "Bacon") and specific dishes ("Gingerbread") are not
  gated.

Output in `tools/curation/books/<identifier>/`:

| file               | what it is |
|--------------------|------------|
| `final.csv`        | the **clean subset** — `name,page,category,tags,url,pageStatus`, every row a shipped recipe with a resolved category. Ready for `apply` |
| `needs_review.csv` | `name,page,guessed_category,confidence` for every **held** (unshipped) entry — the only list a human/LLM needs to scan |
| `dropped.csv`      | `name,page,reason` — the fragments |
| `stats.json`       | `{raw, clean, held, dropped, threshold}` — `apply` reads this to stamp `curatedSubset` / `rawIndexCount` honestly |

The command prints raw / clean (shipped) / held / dropped counts and the
**clean-only** category histogram.

**Workflow — how to improve a run:** open `needs_review.csv` and work the held
residual two ways —

- entries you can place by **dish knowledge** → add their keyword to the
  classifier table in `curate_packs.py` (the ingredient sets or `_RULES`) and
  re-run, so the fix is **reusable** on the next book, not a one-off edit;
- genuinely idiosyncratic entries → hand-correct the category directly in
  `final.csv` and log which in `notes.md`.

Aim for a clean histogram that reads like a real cookbook — all/most of the 11
categories present, none dominating past ~35% (a genuinely dessert- or
protein-forward book may legitimately exceed this; say so rather than
redistribute real recipes). There is no Uncategorized in the shipped subset: a
signal-free name is **held, not shipped**.

**What lands in `needs_review.csv` (held), by design.** Lone truncated
qualifiers ("Russian", "White", "Broiled"), bare dish-type labels ("Sauce"),
and a tail of non-recipe front/back matter the index included ("Wood Floors, to
Polish", "Composition of"). Name-based classification genuinely cannot place
these; parent-noun reconstruction is out of scope. Held ≠ lost — the links are
correct and the entries wait for a future pass; they are just not shipped as
broken names. Per-book yield varies a lot: a numbered/self-contained index
(Escoffier) holds ~0%; Fannie Farmer's extreme hierarchical index holds ~45%.

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

When `classify` wrote a `stats.json` and the withheld share (held + dropped)
exceeds **5% of the raw index**, `apply` additively stamps two honesty fields on
both the pack and the catalog entry — `curatedSubset: true` and `rawIndexCount:
<int>` — so the metadata says out loud that this pack is a curated subset and
how many index entries the book actually had. A self-contained book curated
straight to `final.csv` (no `stats.json`) omits both.

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
  "curatedSubset": true,        // present only when >5% of the raw index was withheld
  "rawIndexCount": 3613,        // (both additive; omitted for self-contained books)
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
  "curatedSubset": true, "rawIndexCount": 3613,  // additive; see apply above
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
