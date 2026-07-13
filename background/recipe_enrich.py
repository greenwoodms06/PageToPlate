# -*- coding: utf-8 -*-
"""
recipe_enrich.py — second-pass cleanup for master_recipe_index.csv
Run AFTER recipe_organize.py.

Pass 1 (propose):
    python recipe_enrich.py master_recipe_index.csv
    -> master_cleaned.csv      (safe auto-fixes applied to ALL rows)
    -> review_proposals.csv    (only flagged rows; edit Accept column: YES/NO,
                                or overwrite Proposed Category with your own)

Pass 2 (apply, after you've edited review_proposals.csv):
    python recipe_enrich.py master_recipe_index.csv --apply review_proposals.csv
    -> master_final.csv

Auto-fixes (always applied, no review needed):
  * Category names normalized to the app's standard list ("Main" -> "Mains", etc.)
  * Keywords: lowercased, deduped, and any token already present in the recipe
    name is dropped (the app's filters substring-match names, so those tags are
    redundant). Section-level tags the name doesn't carry (e.g. "international")
    are kept.

Proposals (require your YES/NO):
  * Recategorization based on the recipe's head noun — the words BEFORE any
    "with/for" and outside parentheses — so "Stir-Fried Beef with Oyster Sauce"
    stays a Main while a standalone "Scallion Dipping Sauce" is proposed for
    Sauces & Condiments.
"""
import sys
import re
import pandas as pd

# ---------- configuration ----------

STANDARD_CATEGORIES = [
    "Mains", "Sides", "Soups & Stews", "Salads", "Appetizers & Small Plates",
    "Breakfast & Brunch", "Breads", "Desserts & Sweets", "Drinks",
    "Sauces & Condiments", "Preserves & Pickles", "Basics & Staples",
]

CATEGORY_SYNONYMS = {
    "main": "Mains", "mains": "Mains", "main dishes": "Mains", "entrees": "Mains",
    "entrées": "Mains", "side": "Sides", "sides": "Sides", "side dishes": "Sides",
    "soups & stews": "Soups & Stews", "soups and stews": "Soups & Stews",
    "soups": "Soups & Stews", "salads": "Salads", "salad": "Salads",
    "appetizers": "Appetizers & Small Plates", "starters": "Appetizers & Small Plates",
    "breakfast & brunch": "Breakfast & Brunch", "breakfast": "Breakfast & Brunch",
    "breads": "Breads", "bread": "Breads",
    "desserts & sweets": "Desserts & Sweets", "desserts": "Desserts & Sweets",
    "puddings": "Desserts & Sweets", "drinks": "Drinks", "beverages": "Drinks",
    "sauces & condiments": "Sauces & Condiments", "sauces": "Sauces & Condiments",
    "preserves & pickles": "Preserves & Pickles", "preserving": "Preserves & Pickles",
    "basics & staples": "Basics & Staples", "basics": "Basics & Staples",
}

# head-noun pattern -> proposed category (order matters: first match wins)
RECLASS_RULES = [
    (r"(soup|stew|chili|chowder|bisque|pho|gumbo|ramen)$", "Soups & Stews"),
    (r"(salad|slaw)$", "Salads"),
    (r"(sauce|dressing|vinaigrette|salsa|chutney|relish|jam|jelly|mayonnaise|"
     r"aioli|pesto|glaze|marinade|rub|dip|hummus|gravy|ketchup|mustard|butter)$",
     "Sauces & Condiments"),
    (r"(pickles|pickled .*)$", "Preserves & Pickles"),
    (r"(bread|breads|naan|flatbread|focaccia|biscuits|tortillas|cornbread)$", "Breads"),
    (r"(croutons|stock|broth|shallots|spice blend|seasoning)$", "Basics & Staples"),
]

# ---------- helpers ----------

def head_noun_phrase(name: str) -> str:
    """The part of the name that says what the dish IS: strip parentheticals,
    cut at ' with ' / ' for ', lowercase."""
    n = re.sub(r"\(.*?\)", "", str(name))
    n = re.split(r"\bwith\b|\bfor\b", n, maxsplit=1, flags=re.I)[0]
    return n.strip().lower()

def normalize_category(cat: str) -> str:
    c = str(cat).strip()
    return CATEGORY_SYNONYMS.get(c.lower(), c)

def clean_keywords(keywords, name: str) -> str:
    if pd.isna(keywords) or not str(keywords).strip():
        return ""
    name_l = str(name).lower()
    seen, out = set(), []
    for tok in str(keywords).split(","):
        t = tok.strip().lower()
        if not t or t in seen:
            continue
        # redundant if the token (or its singular) already appears in the name
        if t in name_l or t.rstrip("s") in name_l:
            continue
        seen.add(t)
        out.append(t)
    return ", ".join(out)

def propose_category(name: str, current: str):
    head = head_noun_phrase(name)
    for pattern, target in RECLASS_RULES:
        if re.search(pattern, head) and target != current:
            return target, f"name reads as '{head}' -> {target}"
    return None, None

ROW_KEY = ["Page Number", "Recipe Name"]

# ---------- main ----------

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    df = pd.read_csv(src)

    # --- safe auto-fixes on every row ---
    df["Category"] = df["Category"].map(normalize_category)
    df["Keywords"] = [clean_keywords(k, n) for k, n in zip(df["Keywords"], df["Recipe Name"])]

    unknown = sorted(set(df["Category"]) - set(STANDARD_CATEGORIES))
    if unknown:
        print(f"⚠️  Categories not in the standard list (kept as-is): {unknown}")

    if "--apply" in sys.argv:
        # --- pass 2: merge reviewed decisions ---
        review_path = sys.argv[sys.argv.index("--apply") + 1]
        rev = pd.read_csv(review_path)
        rev = rev[rev["Accept"].astype(str).str.strip().str.upper() == "YES"]
        decisions = {
            (r["Page Number"], r["Recipe Name"]): r["Proposed Category"]
            for _, r in rev.iterrows()
        }
        applied = 0
        for i, row in df.iterrows():
            key = (row["Page Number"], row["Recipe Name"])
            if key in decisions:
                df.at[i, "Category"] = decisions[key]
                applied += 1
        df.to_csv("master_final.csv", index=False)
        print(f"✅ Applied {applied} accepted recategorizations -> master_final.csv")
        return

    # --- pass 1: write cleaned master + proposals for review ---
    proposals = []
    for _, row in df.iterrows():
        target, reason = propose_category(row["Recipe Name"], row["Category"])
        if target:
            proposals.append({
                "Page Number": row["Page Number"],
                "Recipe Name": row["Recipe Name"],
                "Current Category": row["Category"],
                "Proposed Category": target,
                "Reason": reason,
                "Accept": "YES",   # flip to NO to reject; or edit Proposed Category
            })

    df.to_csv("master_cleaned.csv", index=False)
    pd.DataFrame(proposals).to_csv("review_proposals.csv", index=False)
    print(f"✅ master_cleaned.csv written ({len(df)} rows, auto-fixes applied)")
    print(f"📝 review_proposals.csv written ({len(proposals)} rows to review)")
    print("   Edit the Accept column (YES/NO) or the Proposed Category, then run:")
    print(f"   python recipe_enrich.py {src} --apply review_proposals.csv")

if __name__ == "__main__":
    main()
