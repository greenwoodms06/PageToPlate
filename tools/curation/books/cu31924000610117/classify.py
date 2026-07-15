#!/usr/bin/env python3
"""Judgment pass for cu31924000610117 (Escoffier, A Guide to Modern Cookery, 1907).

draft.json -> final.csv. Encodes the human judgment decisions logged in
notes.md ("Judgment pass log"): chapter->category map, wrapped-index-line
orphan reconstructions (verified against the raw OCR index in
tools/curation/.cache/), OCR name repairs, drops, and sparse tags.

Deterministic and re-runnable: python3 classify.py  (from anywhere).
"""
import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
DRAFT = HERE / "draft.json"
FINAL = HERE / "final.csv"

# --------------------------------------------------------------------------
# 1. Drops — entries that are not recipes.  (name, page) -> reason
# --------------------------------------------------------------------------
DROPS = {
    ("Beans, No", "2155"): "index cross-reference artifact ('Beans, No. 2155' "
                           "points at recipe number 2155, not a page)",
    ("Sauces", "15"): "part header (intro prose, duplicates category)",
    ("Soups", "197"): "chapter header",
    ("Eggs", "164"): "chapter header",
    ("Fish", "260"): "chapter header",
    ("Salads", "615"): "section header (duplicates category)",
    ("Roasts and salads", "605"): "chapter header",
    ("Savories", "678"): "chapter header",
    ("Ices", "788"): "chapter header",
    ("Jams", "820"): "section header (duplicates category)",
}

# --------------------------------------------------------------------------
# 2. Orphan renames — second halves of wrapped index lines that the extractor
#    emitted as stand-alone entries.  Each reconstruction was read from the
#    raw OCR index (cached djvu text).  (name, page) -> full name.
# --------------------------------------------------------------------------
ORPHANS = {
    ("Florentine", "626"): "Artichoke bottoms, stuffed, à la Florentine",
    ("Gene", "860"): "Bowl or Coupe Madame Sans-Gêne",
    ("France", "484"): "Capon or pullet, Isabelle de France",
    ("Savoie", "486"): "Capon or pullet, Marguerite de Savoie",
    ("Bourgeoise", "174"): "Eggs, hard-boiled, à la Bourgeoise",
    ("Moderne", "157"): "Eggs, plovers' and lapwings', à la Moderne",
    ("Moscovite", "157"): "Eggs, plovers' and lapwings', à la Moscovite",
    ("Royale", "191"): "Eggs, plovers' and lapwings', à la Royale",
    ("Troubadours", "191"): "Eggs, plovers' and lapwings', des Troubadours",
    ("Piquante sauce", "458"): "Cutlets, pork, with Robert or Piquante sauce",
    ("Spanish style", "444"): "Kidneys, mutton, on skewers, Spanish style",
    ("Lobster", "320"): "Lobster, à la New-Burg, with cooked Lobster",
    ("Femme", "450"): "Neck of Pauillac, en Cocotte Bonne Femme",
    ("Dubarry", "643"): "Purée of cauliflower, otherwise Dubarry",
    ("Soissonnaise", "649"): "Purée of white beans, otherwise Soissonnaise",
    ("Musard", "649"): "Puree of flageolets, otherwise Musard",
    ("Germain", "657"): "Puree of fresh peas, otherwise St. Germain",
    ("Baden", "568"): "Roebuck, saddle and legs of, Baden-Baden",
    ("Creole", "569"): "Roebuck, saddle and legs of, à la Creole",
    ("Beaujeu", "569"): "Roebuck, saddle and legs of, à la Beaujeu",
    ("Royale", "87"): "Royale, Deslignac, or Cream Royale",
    ("Veloute", "21"): "Sauce, German, or thickened Veloute",
    ("Lyon", "160"): "Sausages, Arles, Bologna, or large Lyon",
    ("Sherry", "155"): "Melon, with Porto, Marsala, or Sherry",
    ("Levantine", "301"): "Sole, fillets of (Pilaw de), à la Levantine",
    ("Villaret", "304"): "Sole, turban of fillets of, au Saumon Villaret",
    ("Flemish", "225"): "Puree of Brussels sprouts, otherwise Flemish",
    ("Dubarry", "225"): "Puree of cauliflowers, otherwise Dubarry",
    ("Musart", "227"): "Puree of flageolets, otherwise Musart",
    ("Soissonnaise", "227"): "Purée of white beans, otherwise Soissonnaise",
    ("Cormeilles", "227"): "Purée of French beans, otherwise Cormeilles",
    ("Conde", "228"): "Purée of red beans, otherwise Condé",
    ("Remarks upon", "229"): "Purees, remarks upon",
    ("Germain", "230"): "Puree of fresh peas, otherwise St. Germain",
    ("Danoise", "238"): "Veloute, with cucumbers, à la Danoise",
    ("Argenteuil", "245"): "Cream of asparagus, otherwise Argenteuil",
    ("Ceres", "245"): "Cream of green wheat, otherwise Ceres",
    ("Villeroy", "407"): "Sweetbreads, Attereaux of, à la Villeroy",
    # ('Espagnole', '18') deliberately kept as 'Espagnole' — the truncated
    # index line reads 'Sauces, principal, brown sauces or Espagnole'; the
    # short form is the recognizable recipe name.
}

# --------------------------------------------------------------------------
# 3. One-off OCR name repairs (exact full-name replacements).
# --------------------------------------------------------------------------
FIXES = {
    "liallotine of duckUng": "Ballotine of duckling",
    "Bowl or Coupe Malmais.jn": "Bowl or Coupe Malmaison",
    "Butters, various, used in pastry v.ork":
        "Butters, various, used in pastry work",
    "Coloured sugar gi-ains": "Coloured sugar grains",
    "Fillet of beef, Chiteaubriand-Tournedos":
        "Fillet of beef, Chateaubriand-Tournedos",
    "Ham soufflfe": "Ham soufflé",
    "Soufflfe, iced, the moulding of": "Soufflé, iced, the moulding of",
    "Ortolans, roast, with questches": "Ortolans, roast, with quetsches",
    '" Pate k choux," ordinary': '"Pâte à choux," ordinary',
    "Pastes, Ramequin and Gougire": "Pastes, Ramequin and Gougère",
    "Pheasant, roast, Pirigourdine": "Pheasant, roast, Périgourdine",
    "Faiie of Jerusalem artichokes, otherwise Palestine":
        "Puree of Jerusalem artichokes, otherwise Palestine",
    "Royale of fresh peas, or St. Gfermain":
        "Royale of fresh peas, or St. Germain",
    "Salad, compound, Americanstyle": "Salad, compound, American style",
    "Pur?e of tomatoes and tapioca, otherwise Waldeze":
        "Purée of tomatoes and tapioca, otherwise Waldeze",
    "Cream of yams, otherw'se Bresilienne":
        "Cream of yams, otherwise Bresilienne",
    "Toast or Canapfe, various": "Toast or Canapés, various",
    "Trout, salmon, cambac6rfe": "Trout, salmon, Cambacérès",
    "Timbale, Cambacer^s": "Timbale, Cambacérès",
    "Sauss^es, Frankfort and Strasburg": "Sausages, Frankfort and Strasburg",
    "Dor}', John": "Dory, John",
    "S;iuted chicken, Gabrielle": "Sauted chicken, Gabrielle",
    "Omelet with vegetable-n\\arrow flowers":
        "Omelet with vegetable-marrow flowers",
    "Sole, with Chan;ibertin": "Sole, with Chambertin",
    "Eggs, fried, Proven(;ale": "Eggs, fried, Provençale",
    "Butter, manied {v. g!.)": "Butter, manié",
    "Artichoke bottoms, saut6d {v. vl.)": "Artichoke bottoms, sautéd",
    "Bananas, souffled {v. gl.)": "Bananas, souffled",
    "Sweetbread, quoits of k I'Ecarlate (». £-1.)":
        "Sweetbread, quoits of à l'Ecarlate",
    "Supr8meof squabs, with truffles": "Suprême of squabs, with truffles",
    "Pig's trotters, Ste. M^nihould": "Pig's trotters, Ste. Menehould",
    "Macaroni or Sp^^hetti, k la Nantua": "Macaroni or Spaghetti, à la Nantua",
    "Quails, cold, Reine Am^Iie": "Quails, cold, Reine Amélie",
    "Kidneys, mutton, on skewers, Vertpr^":
        "Kidneys, mutton, on skewers, Vert-pré",
    "Larks, pat£ of": "Larks, pâté of",
    "Salmon, darnes of, R%ence": "Salmon, darnes of, Régence",
    "Omelet, Proven5ale": "Omelet, Provençale",
    "Tournedos, Ni5oise": "Tournedos, Niçoise",
    "Souffle with pomegranate, a I'Orien tale":
        "Souffle with pomegranate, à l'Orientale",
    "Zampino de Mod^ne": "Zampino de Modène",
    "Herrings, fresh, marinadad, with white wine":
        "Herrings, fresh, marinaded, with white wine",
    "Leg of mutton, marinadad, venison-fashion":
        "Leg of mutton, marinaded, venison-fashion",
    # é (and f) misread as a stray capital inside the word
    "SautM chicken Archiduc": "Sautéd chicken Archiduc",
    "SautW chicken, Fermiere": "Sautéd chicken, Fermiere",
    "SautW chicken, Forestiere": "Sautéd chicken, Forestiere",
    "Fritters, soufBed with cheese": "Fritters, souffled with cheese",
    "Fritters, soufflM, en surprise": "Fritters, souffléd, en surprise",
    "MacMoine of fruit (cooled)": "Macédoine of fruit (cooled)",
    "Oysters, SoufflW": "Oysters, Soufflés",   # book heading: HUITRES SOUFFLEES
    "Sole, MontgolHer": "Sole, Montgolfier",
    "SuMoise of fruit": "Suédoise of fruit",
    "SuprSme of chicken, Chimay": "Suprême of chicken, Chimay",
    "Sweetbread, DemidofF": "Sweetbread, Demidoff",
    "Tomatoes, sautM, Proven9ale": "Tomatoes, sautéd, Provençale",
    "Tongue, calPs": "Tongue, calf's",
    "Foies-Gras, coUopsof, Ravignan": "Foies-Gras, collops of, Ravignan",
    "Oranges, SoufH^d Righi": "Oranges, Souffléd Righi",
    "Oranges en Surprise SoufB^es": "Oranges en Surprise Soufflées",
    "Cabbages, red. Marinaded, for horsd'oeuvres":
        "Cabbages, red, marinaded, for hors-d'oeuvres",
}

# è / ê / non-é caret words handled before the generic ^ -> é rule
CARET_SPECIALS = [
    ("i^re", "ière"),           # Bouquetière, Plombière, Forestière, ...
    ("Ir^ne", "Irène"),
    ("Uz^s", "Uzès"),
    ("P^re", "Père"),
    (re.compile(r"\^re\b"), "ère"),   # Boulangère
]
DIGIT_SPECIALS = [
    ("Vend6me", "Vendôme"),
    ("supr6me", "suprême"),
    ("S^vignd", "Sévigné"),
    ("S^vigne", "Sévigné"),
]


def fix_name(name: str) -> str:
    n = name
    # leading recipe-number residue: '2G02 Apples…', '566aConsomme…', '1 185 …'
    n = re.sub(r"^\d[\dG,\^/ ]*[a-f]?(?=[A-Z\"])\s*", "", n)
    # à l' variants: ' k I'', ' a I'', ' i I'', ' 4 I''  (I misread for l)
    n = re.sub(r" [kai4] I'", " à l'", n)
    n = re.sub(r"l'l(?=[a-z])", "l'I", n)   # l'lnfante -> l'Infante
    n = re.sub(r" k l'", " à l'", n)
    # à la variants: k/i/4/\/^/h./h misreads of 'à'
    n = re.sub(r" (?:k|i|4|\\|\^|h\.|h) la ", " à la ", n)
    for pat, rep in DIGIT_SPECIALS:
        n = n.replace(pat, rep)
    for pat, rep in CARET_SPECIALS:
        n = pat.sub(rep, n) if hasattr(pat, "sub") else n.replace(pat, rep)
    n = n.replace("^", "é")                    # remaining carets are é
    n = re.sub(r"([a-z])U(?=[a-z])", r"\1ll", n)   # HoUandaise -> Hollandaise
    n = re.sub(r"([A-Za-z])6(?=[a-z]|\b)", r"\1é", n)  # saut6d, Lakm6, ...
    n = re.sub(r"([a-z])9(?=[a-z])", r"\1ç", n)        # Proven9ale, Ni9oise
    n = n.replace("Vert-pre", "Vert-pré")      # match its é siblings
    n = re.sub(r"\s+[;:]\s+e\.g\.", ", e.g.", n)   # 'surprise ; e.g.' -> ', e.g.'
    # OCR reads the index's mid-name commas as periods ('Capon or pullet.
    # Lady Curzon'); real abbreviations (St., Ste., e.g.) are guarded
    n = re.sub(r"(?<!\bSt)(?<!\bSte)(?<!e\.g)\. (?=\S)", ", ", n)
    n = re.sub(r"\bDue\b", "Duc", n)           # Petit-Due, Grand Due -> Duc
    n = n.replace("horsd'", "hors-d'")
    return re.sub(r"\s+", " ", n).strip()


# --------------------------------------------------------------------------
# 4. Chapter -> category map (meal role; rationale in notes.md).
# --------------------------------------------------------------------------
CHAPTER_MAP = {
    "THE SMALL COMPOUND SAUCES": "Sauces & Condiments",
    "COLD SAUCES AND COMPOUND BUTTERS": "Sauces & Condiments",
    "SAVOURY JELLIES OR ASPICS": "Basics",
    "THE COURT-BOUILLONS AND THE MARINADES": "Basics",
    "\\J/: ELEMENTARY PREPARATIONS": "Basics",
    "THE VARIOUS GARNISHES FOR SOUPS": "Basics",
    "GARNISHING PREPARATIONS FOR RELEVis AND ENTR]£eS": "Basics",
    "U^DING CULINARY OPERATIONS": "Basics",
    "HORS-D'CEUVRES": "Sides",
    "EGGS": "Mains",
    "SOUPS": "Soups & Stews",
    "FISH": "Mains",
    "RELEVilS AND ENTRIES OF BUTCHER'S MEAT": "Mains",
    "RELEVES AND ENTRIES OF POULTRY AND GAME": "Mains",
    "VEGETABLES AND FARINACEOUS PRODUCTS": "Sides",
    "SAVORIES": "Sides",
    "ICES AND SHERBETS": "Desserts",
    "DRINKS AND REFRESHMENTS": "Drinks",
}

GAME_WORDS = ["pheasant", "partridge", "grouse", "quail", "woodcock", "snipe",
              "hare", "leveret", "rabbit", "roebuck", "venison", "teal",
              "widgeon", "pintail", "plover", "lapwing", "lark", "thrush",
              "blackbird", "ortolan", "ptarmigan", "sandpiper", "ganga",
              "hazel-hen", "duck, wild", "wild duck"]


def categorize(name: str, page: str, chapter: str | None) -> str:
    low = name.lower()
    pg = int(page) if page.isdigit() else 0
    # dish-level overrides (served as the soup course, whatever the chapter)
    if low.startswith(("bouillabaisse", "waterzooi")):
        return "Soups & Stews"
    if chapter is None:
        # pp. 2-22, the 'fonds de cuisine' part missing from the parsed
        # contents: leading sauces vs. foundation stocks/glazes/roux
        return ("Sauces & Condiments"
                if low.startswith(("sauce", "espagnole", "veloute"))
                else "Basics")
    if chapter == "ROASTS AND SALADS":
        if "salad" in low:
            return "Salads"
        if low.startswith("pudding, yorkshire"):
            return "Sides"          # roast accompaniment, not a main
        if low.startswith("stuffing"):
            return "Basics"         # component preparation
        return "Mains"
    if chapter == "ENTREMETS. (SWEETS)":
        # pp. 687-712 are the pastry-foundations section (pastes, sugars,
        # creams, crusts); plated sweets start at p. 713
        return "Basics" if pg <= 712 else "Desserts"
    if chapter == "FRUIT-STEWS AND JAMS":
        # the three p. 860 Coupes are iced desserts printed in the addenda
        return "Desserts" if pg == 860 else "Preserves & Pickles"
    return CHAPTER_MAP[chapter]


def tags_for(name: str, chapter: str | None, category: str) -> list[str]:
    tags = []
    if chapter == "HORS-D'CEUVRES":
        tags.append("appetizer")
    if (chapter in ("RELEVES AND ENTRIES OF POULTRY AND GAME",
                    "ROASTS AND SALADS")
            and category == "Mains"
            and any(w in name.lower() for w in GAME_WORDS)):
        tags.append("game")
    return tags


def main() -> None:
    entries = json.loads(DRAFT.read_text(encoding="utf-8"))["entries"]
    kept, dropped, renamed = [], [], 0
    orphans_used, fixes_used = set(), set()
    for e in entries:
        key = (e["name"], str(e["page"]))
        if key in DROPS:
            dropped.append((key, DROPS[key]))
            continue
        if key in ORPHANS:
            name = ORPHANS[key]
            orphans_used.add(key)
        elif e["name"] in FIXES:
            name = FIXES[e["name"]]
            fixes_used.add(e["name"])
        else:
            name = e["name"]
        fixed = fix_name(name)
        if fixed != e["name"]:
            renamed += 1
        category = categorize(fixed, str(e["page"]), e.get("chapter"))
        tags = tags_for(fixed, e.get("chapter"), category)
        kept.append({"name": fixed, "page": str(e["page"]),
                     "category": category, "tags": ";".join(tags),
                     "url": e["url"], "pageStatus": e["pageStatus"]})

    missing_orphans = set(ORPHANS) - orphans_used
    missing_fixes = set(FIXES) - fixes_used
    assert not missing_orphans, f"orphan keys not found: {missing_orphans}"
    assert not missing_fixes, f"fix keys not found: {missing_fixes}"
    assert all(r["category"] for r in kept), "null category slipped through"
    leftover = [r["name"] for r in kept
                if re.search(r"[\^{}\\;£»?%]|\d(?![)\.])", r["name"])
                and "&c." not in r["name"]]

    with FINAL.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["name", "page", "category", "tags",
                                          "url", "pageStatus"])
        w.writeheader()
        w.writerows(kept)

    import collections
    hist = collections.Counter(r["category"] for r in kept)
    print(f"kept {len(kept)}, dropped {len(dropped)}, "
          f"names changed {renamed}")
    for c, n in hist.most_common():
        print(f"  {n:5d}  {c}")
    print("drops:")
    for (nm, pg), why in dropped:
        print(f"  - {nm!r} p{pg}: {why}")
    if leftover:
        print("STILL-GARBLED (review):")
        for n in leftover:
            print("  ?", repr(n))
    tagged = collections.Counter(t for r in kept for t in r["tags"].split(";")
                                 if t)
    print("tags:", dict(tagged))


if __name__ == "__main__":
    main()
