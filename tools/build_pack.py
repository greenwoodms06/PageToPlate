#!/usr/bin/env python3
"""Build a content pack JSON (and its catalog.json entry) from an index CSV.

    python3 tools/build_pack.py background/atk_index.csv \
        --id atk-complete --name "<book title>" --author "..." --year 2025 \
        --country US --cuisine american --era modern --type index-only \
        -o public/packs/atk-complete.json

Applies the SAME normalization as the app importer so a pack install and a
CSV import of the same file produce identical recipes:
  * forgiving CSV parse: quoted names, stray spaces, fuzzy header mapping
    (mirrors src/logic/csv.ts)
  * old-12 -> new-11 category remap incl. the 'appetizer' auto-tag on
    appetizer-vocabulary sections (mirrors src/data/categories.ts — that file
    is the decision record; keep the tables below in sync with it)
  * keyword split/lowercase/dedupe + drop tags whose text appears in the
    recipe name (mirrors src/logic/importer.ts)

Prints a category histogram for an eyeball check and exits non-zero if any
category fails to map — packs must ship with clean categories ("they're
already the 11", plan Task 25).
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import pathlib
import sys

# ── mirrors src/data/categories.ts (single source of truth is the TS file) ──

DEFAULT_CATEGORIES = [
    "Mains", "Sides", "Soups & Stews", "Salads", "Breakfast & Brunch",
    "Breads", "Desserts", "Drinks", "Sauces & Condiments",
    "Preserves & Pickles", "Basics",
]

SYN = {
    "entrées": "Mains", "entrees": "Mains", "main dishes": "Mains",
    "main courses": "Mains", "primi": "Mains", "secondi": "Mains",
    "side dishes": "Sides", "vegetables": "Sides",
    "appetizers & small plates": "Sides", "appetizers": "Sides",
    "starters": "Sides", "small plates": "Sides",
    "hors d'oeuvres": "Sides", "hors d’oeuvres": "Sides", "meze": "Sides",
    "tapas": "Sides", "antipasti": "Sides", "dim sum": "Sides",
    "snacks": "Sides", "canapés": "Sides", "canapes": "Sides",
    "soups": "Soups & Stews", "stews": "Soups & Stews",
    "soups and stews": "Soups & Stews", "chowders": "Soups & Stews",
    "breakfast": "Breakfast & Brunch", "brunch": "Breakfast & Brunch",
    "rolls": "Breads", "biscuits": "Breads",
    "desserts & sweets": "Desserts", "sweets": "Desserts",
    "puddings": "Desserts", "cakes": "Desserts", "pies": "Desserts",
    "cookies": "Desserts", "confections": "Desserts", "dolci": "Desserts",
    "beverages": "Drinks", "cocktails": "Drinks",
    "sauces": "Sauces & Condiments", "condiments": "Sauces & Condiments",
    "dressings": "Sauces & Condiments", "salsas": "Sauces & Condiments",
    "preserves": "Preserves & Pickles", "pickles": "Preserves & Pickles",
    "canning": "Preserves & Pickles", "jams": "Preserves & Pickles",
    "jellies": "Preserves & Pickles",
    "basics & staples": "Basics", "staples": "Basics", "stocks": "Basics",
    "fundamentals": "Basics",
}

APPETIZER_SECTIONS = {
    "appetizers & small plates", "appetizers", "starters", "small plates",
    "hors d'oeuvres", "hors d’oeuvres", "meze", "tapas", "antipasti",
    "dim sum", "snacks", "canapés", "canapes",
}


def norm(s: str) -> str:
    return " ".join(s.split()).lower()


def map_raw_category(raw: str) -> tuple[str | None, list[str]]:
    n = norm(raw)
    add_tags = ["appetizer"] if n in APPETIZER_SECTIONS else []
    for c in DEFAULT_CATEGORIES:
        if c.lower() == n:
            return c, add_tags
    return SYN.get(n), add_tags


# ── mirrors src/logic/csv.ts column mapping ─────────────────────────────────

HEADER_WORDS = ("page", "recipe", "name", "category", "keywords", "tags")


def looks_like_header(cells: list[str]) -> bool:
    lower = [c.lower() for c in cells]
    if any(w in c for c in lower for w in HEADER_WORDS):
        return True
    page = cells[1] if len(cells) > 1 else ""
    return page != "" and not page.replace("-", "").replace("–", "").strip().isdigit()


def map_columns(header: list[str]) -> dict[str, int]:
    m = {"name": -1, "page": -1, "category": -1, "tags": -1}
    for i, cell in enumerate(header):
        h = cell.lower()
        if m["page"] == -1 and ("page" in h or "pg" in h):
            m["page"] = i
        elif m["name"] == -1 and any(w in h for w in ("recipe", "name", "title", "dish")):
            m["name"] = i
        elif m["category"] == -1 and ("category" in h or "section" in h):
            m["category"] = i
        elif m["tags"] == -1 and ("keyword" in h or "tag" in h):
            m["tags"] = i
    taken = {v for v in m.values() if v != -1}
    positional = {"name": 0, "page": 1, "category": 2, "tags": 3}
    for key in ("name", "page", "category", "tags"):
        if m[key] == -1:
            i = positional[key]
            while i in taken:
                i += 1
            m[key] = i
            taken.add(i)
    return m


def parse_rows(path: pathlib.Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        records = [[c.strip() for c in row] for row in csv.reader(f)]
    records = [r for r in records if any(c != "" for c in r)]
    if not records:
        return []
    had_header = looks_like_header(records[0])
    cols = map_columns(records[0]) if had_header else {"name": 0, "page": 1, "category": 2, "tags": 3}
    rows = []
    for cells in records[1:] if had_header else records:
        at = lambda i: cells[i] if i < len(cells) else ""  # noqa: E731
        name = at(cols["name"]).strip()
        if not name:
            continue
        rows.append({
            "name": name,
            "page": at(cols["page"]).strip(),
            "category": at(cols["category"]).strip(),
            "tags": [t.strip() for t in at(cols["tags"]).replace(";", ",").split(",") if t.strip()],
        })
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=pathlib.Path, help="index CSV (name/page/category[/keywords])")
    ap.add_argument("--id", required=True)
    ap.add_argument("--name", required=True, help="book title (owner-confirmed edition title)")
    ap.add_argument("--author", default=None)
    ap.add_argument("--year", type=int, default=None)
    ap.add_argument("--country", default=None)
    ap.add_argument("--cuisine", action="append", default=[], help="repeatable")
    ap.add_argument("--era", default=None)
    ap.add_argument("--type", choices=["index-only", "linked"], default="index-only")
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument("-o", "--output", type=pathlib.Path, required=True,
                    help="pack file path, e.g. public/packs/atk-complete.json")
    args = ap.parse_args()

    rows = parse_rows(args.csv)
    recipes, unmapped = [], collections.Counter()
    histogram = collections.Counter()
    for row in rows:
        category, add_tags = (None, [])
        if row["category"]:
            category, add_tags = map_raw_category(row["category"])
            if category is None:
                unmapped[row["category"]] += 1
        name_lower = row["name"].lower()
        # dedupe + lowercase + drop tags whose text appears in the recipe name
        tags, seen = [], set()
        for t in [*row["tags"], *add_tags]:
            t = t.strip().lower()
            if t and t not in seen and t not in name_lower:
                seen.add(t)
                tags.append(t)
        recipes.append({
            "name": row["name"], "page": row["page"],
            "category": category or row["category"], "tags": tags,
        })
        histogram[category or f"UNMAPPED:{row['category']}"] += 1

    print(f"{len(recipes)} recipes from {args.csv}")
    for cat, count in histogram.most_common():
        print(f"  {count:5d}  {cat}")
    if unmapped:
        print("\nERROR: unmapped categories (packs must ship clean):", dict(unmapped), file=sys.stderr)
        return 1

    pack = {
        "id": args.id,
        "version": args.version,
        "book": {"name": args.name, "tags": []},
        "recipes": recipes,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pack, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\nwrote {args.output}")

    # ── catalog.json entry (created/replaced by pack id) ───────────────────
    catalog_path = args.output.parent / "catalog.json"
    catalog = {"catalogVersion": 1, "packs": []}
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    entry = {
        "id": args.id,
        "title": args.name,
        "author": args.author,
        "year": args.year,
        "country": args.country,
        "cuisines": args.cuisine,
        "era": args.era,
        "type": args.type,
        "recipeCount": len(recipes),
        "categories": [c for c, _ in histogram.most_common()],
        # path relative to the app's BASE_URL (public/ passthrough)
        "file": f"packs/{args.output.name}",
        "version": args.version,
    }
    entry = {k: v for k, v in entry.items() if v is not None}
    catalog["packs"] = [p for p in catalog["packs"] if p["id"] != args.id] + [entry]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"updated {catalog_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
