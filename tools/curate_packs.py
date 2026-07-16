#!/usr/bin/env python3
"""curate_packs.py — archive.org content-pack pipeline (triage + extraction).

Phase 1 (triage) scans public-domain cookbook candidates on archive.org and
produces a ranked report (tools/curation/candidates.md + candidates.json).
Phase 2 (extraction) turns ONE chosen book into a draft pack for the human
judgment pass, then into a shippable pack. Full contributor process:
tools/CURATION.md.

Subcommands:
  triage       Page through the archive.org search, score the top-N books by
               downloads, write candidates.md (human table) + candidates.json
               (machine data for phase 2).
  extract      Deterministic structure pass over one book: find the recipe
               index + chapter contents in the OCR text, parse entries,
               categorize by chapter, resolve deep links. Writes
               tools/curation/books/<id>/{draft.json,review.md,notes.md}.
  classify     Name-based meal-role classifier for books whose categories can't
               come from a chapter map (hierarchical/alphabetical indexes).
               Enforces the CLEAN-SUBSET policy (witness P2P-007): final.csv
               ships ONLY entries with a resolved category at confidence >=
               CLEAN_THRESHOLD; low-confidence + signal-free names are HELD
               (needs_review.csv, unshipped) and pure fragments are DROPPED
               (dropped.csv). Also writes stats.json (raw/clean/held/dropped).
  apply        Read tools/curation/books/<id>/final.csv (the judgment pass's
               output) and emit public/packs/<id>.json + a catalog.json entry.
  verify-links HEAD-check a sample of a book's entry URLs (catches malformed
               ids/paths; NOT wrong pages — archive.org 200s any valid id).
  selftest     Run known-book + parser assertions and exit nonzero on failure.

Ground truth (verified by execution 2026-07-15):

* Search: advancedsearch.php with query
      subject:cookery AND mediatype:texts AND year:[1800 TO 1930]
      AND -access-restricted-item:true
  returns 2,169 items. NOTE — the spec (cookbook-app-spec.md, "Content
  Packs") says to seed from `collection:cbk`; that collection is STALE (only
  2 items live at time of writing), so this script uses the subject:cookery
  query instead. Correction verified against the live API.

* OCR text: https://archive.org/download/{id}/{id}_djvu.txt (follows a
  redirect to the item's server; read is capped at DJVU_CAP bytes).

* Page map: GET https://archive.org/metadata/{id} -> fields `server`, `dir`;
  then https://{server}/BookReader/BookReaderJSIA.php?id=..&itemPath=..&
  server=..&format=json&requestUri=/details/{id} ->
  data.brOptions.data = list of spreads, each a list of pages carrying
  `pageNum` (printed page: int, str, or None) and `leafNum`.

* Deep links: the reader URL /details/{id}/page/n{N} uses the POSITIONAL
  INDEX of the page in the flattened spread list, NOT the `leafNum` field.
  Verified on calendarofdinner00neiluoft: printed page 8 sits at positional
  index 13 while its leafNum is 14 (leafNum is one-based and offset by
  front-matter leaves). The selftest pins this.

* Full text for extraction: triage reads djvu.txt capped at DJVU_CAP
  (1.5 MB) — enough to FIND an index, not to parse a back-of-book one.
  Escoffier (cu31924000610117) proved the trap: his file is 2.26 MB and the
  alphabetical index lives in the last ~15%, past the cap. `extract`
  therefore fetches the UNCAPPED text under a separate cache key
  ({id}_djvu_full.txt) so the truncated triage cache is never reused.

Politeness: >=0.7 s between HTTP requests, a descriptive User-Agent, and
every fetch is cached under tools/curation/.cache/ so re-runs are free.

Stdlib only (Python 3.12): urllib, json, re, csv, time, argparse, pathlib.
"""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

USER_AGENT = "PageToPlate-curation/1.0 (github.com/greenwoodms06/PageToPlate)"
REQUEST_GAP = 0.7          # min seconds between network hits
TIMEOUT = 10               # per-request socket timeout, seconds
DJVU_CAP = 1_500_000       # max bytes of OCR text to read per book
ROWS_PER_PAGE = 50         # advancedsearch page size
SAMPLE_SIZE = 25           # (name, page) pairs sampled per detected index
SECTION_WINDOW = 6000      # max OCR lines scanned after a heading candidate
SECTION_GAP = 150          # stop after this many consecutive non-index lines
TOP_TABLE = 40             # rows in candidates.md

SEARCH_QUERY = (
    "subject:cookery AND mediatype:texts AND year:[1800 TO 1930] "
    "AND -access-restricted-item:true"
)

# Score = weighted rank-percentile of each metric.
WEIGHTS = {"resolvability": 0.40, "index_size": 0.30, "ocr": 0.20, "downloads": 0.10}

TOOLS_DIR = Path(__file__).resolve().parent
CURATION_DIR = TOOLS_DIR / "curation"
CACHE_DIR = CURATION_DIR / ".cache"
BOOKS_DIR = CURATION_DIR / "books"          # per-book extraction workspaces
PACKS_DIR = TOOLS_DIR.parent / "public" / "packs"

# Known book used by the selftest.
SELFTEST_ID = "calendarofdinner00neiluoft"

# Category mapping: the decision record is src/data/categories.ts (11
# categories + synonym table + the appetizer auto-tag; owner decision
# 2026-07-14). build_pack.py carries the Python port of that table — reuse
# that single copy rather than fork a third one.
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))
from build_pack import map_raw_category  # noqa: E402

# Catalog `cuisines` come from book-level tags filtered to the region
# vocabulary (tools/README.md "AI region pass" list, plus american/british
# for the US/GB books that dominate the public-domain corpus).
CUISINE_VOCAB = {
    "italian", "french", "european", "asian", "chinese", "indian", "mexican",
    "latin", "middle eastern", "african", "caribbean", "international",
    "american", "british", "german",
}

# --------------------------------------------------------------------------
# HTTP with cache + rate limit
# --------------------------------------------------------------------------

_last_hit = 0.0


class FetchError(Exception):
    """A single book's fetch failed; the run skips the book, never crashes."""


def _cache_path(key: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", key)[:140]
    digest = hashlib.sha1(key.encode()).hexdigest()[:10]
    return CACHE_DIR / f"{safe}.{digest}"


def _rate_limit() -> None:
    wait = REQUEST_GAP - (time.monotonic() - _last_hit)
    if wait > 0:
        time.sleep(wait)


def fetch(url: str, key: str, cap: int | None = None) -> bytes:
    """GET `url` (redirects followed), capped at `cap` bytes, cached by `key`."""
    path = _cache_path(key)
    if path.exists():
        return path.read_bytes()

    global _last_hit
    _rate_limit()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = resp.read(cap) if cap else resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError) as e:
        raise FetchError(f"{type(e).__name__}: {e}") from e
    finally:
        _last_hit = time.monotonic()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def fetch_json(url: str, key: str):
    try:
        return json.loads(fetch(url, key).decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        raise FetchError(f"bad JSON: {e}") from e


# --------------------------------------------------------------------------
# archive.org endpoints
# --------------------------------------------------------------------------

def search_page(page: int, rows: int = ROWS_PER_PAGE) -> list[dict]:
    params = [
        ("q", SEARCH_QUERY),
        ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "creator"),
        ("fl[]", "year"), ("fl[]", "downloads"),
        ("rows", str(rows)), ("page", str(page)),
        ("sort[]", "downloads desc"), ("output", "json"),
    ]
    url = "https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(params)
    data = fetch_json(url, f"search_p{page}_r{rows}")
    return data["response"]["docs"]


def get_djvu_text(identifier: str) -> str:
    url = f"https://archive.org/download/{identifier}/{identifier}_djvu.txt"
    raw = fetch(url, f"{identifier}_djvu.txt", cap=DJVU_CAP)
    return raw.decode("utf-8", errors="replace")


def get_page_map(identifier: str) -> list[dict]:
    """Flattened page list (reader order). Position in this list == the N of
    the /page/n{N} deep-link form. Each entry: {pageNum, leafNum}."""
    meta = fetch_json(f"https://archive.org/metadata/{identifier}",
                      f"{identifier}_meta.json")
    server, item_dir = meta.get("server"), meta.get("dir")
    if not server or not item_dir:
        raise FetchError("metadata missing server/dir")
    br_url = (
        f"https://{server}/BookReader/BookReaderJSIA.php?"
        + urllib.parse.urlencode({
            "id": identifier, "itemPath": item_dir, "server": server,
            "format": "json", "requestUri": f"/details/{identifier}",
        })
    )
    br = fetch_json(br_url, f"{identifier}_brjsia.json")
    try:
        spreads = br["data"]["brOptions"]["data"]
    except (KeyError, TypeError) as e:
        raise FetchError("no brOptions.data (no page map)") from e
    return [page for spread in spreads for page in spread]


def build_printed_map(flat_pages: list[dict]) -> dict[str, int]:
    """printed-page string -> positional index (first occurrence wins)."""
    out: dict[str, int] = {}
    for idx, page in enumerate(flat_pages):
        num = page.get("pageNum")
        if num is None:
            continue
        key = str(num).strip()
        if key and key not in out:
            out[key] = idx
    return out


def deep_link(identifier: str, positional_index: int) -> str:
    return f"https://archive.org/details/{identifier}/page/n{positional_index}"


# --------------------------------------------------------------------------
# Index detection in OCR text
# --------------------------------------------------------------------------

# A heading candidate: short, digit-free line whose words are basically
# "[qualifier] CONTENTS/INDEX [qualifier]" — catches "CONTENTS", "INDEX",
# "TABLE OF CONTENTS", "RECIPE  INDEX", "Index to Recipes",
# "Recipe Index — Continued", "GENERAL INDEX".
HEADING_RE = re.compile(
    r"^(?:[a-z']+\s+){0,3}(contents|index)(?:\s+(?:of|to)\s+[a-z']+|\s+[a-z']+)?"
    r"(?:\s+continued)?$",
    re.IGNORECASE,
)

# name ... number  (leader dots / spaces between; OCR-noise tolerant).
LINE_RE = re.compile(r"^(.{4,80}?)[ .]{2,}\s*(\d{1,4})\s*$")

_NOISE = str.maketrans({"·": ".", "•": ".", "…": ".", "\t": " ", "—": "-", "–": "-"})


def _normalize(line: str) -> str:
    line = line.translate(_NOISE)
    line = re.sub(r"(?: \.){2,}", lambda m: "." * (len(m.group(0)) // 2), line)
    return line.rstrip()


def heading_kind(line: str) -> str | None:
    """'contents' / 'index' when the line is a section heading, else None."""
    s = line.translate(_NOISE).strip(" .:-")
    if not (3 <= len(s) <= 45) or any(c.isdigit() for c in s):
        return None
    m = HEADING_RE.match(re.sub(r"[\s.:-]+", " ", s).strip())
    return m.group(1).lower() if m else None


def is_heading(line: str) -> bool:
    return heading_kind(line) is not None


def match_index_line(line: str) -> tuple[str, str] | None:
    """Return (name, printed_page) if the line looks like an index entry."""
    m = LINE_RE.match(_normalize(line))
    if not m:
        return None
    name = m.group(1).strip(" .,-")
    name = re.sub(r"\s{2,}", " ", name)
    # Reject pure-noise "names": need >=4 letters incl. a 3-letter run.
    if sum(c.isalpha() for c in name) < 4 or not re.search(r"[A-Za-z]{3}", name):
        return None
    return name, m.group(2)


def detect_index(text: str) -> dict:
    """Find the CONTENTS/INDEX section. Returns
    {found, heading, heading_line (1-based), pairs [(name, page)], n_lines}.

    An index spanning many scan pages repeats its heading as a running head
    ("Recipe Index — Continued"), and two-column OCR can interleave long
    stretches with no inline page numbers — so a single gap-bounded block
    undercounts badly. Instead: extract a block after EVERY heading
    candidate, drop tiny blocks (stray 'index'/'contents' prose lines), and
    union the survivors by line number."""
    lines = text.splitlines()
    # Memoize per-line matches once; block extraction then costs nothing.
    hits = [match_index_line(ln) for ln in lines]
    candidates = [i for i, ln in enumerate(lines) if is_heading(ln)][:500]

    blocks: list[tuple[int, dict[int, tuple[str, str]]]] = []
    for start in candidates:
        matched: dict[int, tuple[str, str]] = {}
        gap = 0
        for i in range(start + 1, min(start + 1 + SECTION_WINDOW, len(lines))):
            if hits[i]:
                matched[i] = hits[i]
                gap = 0
            elif lines[i].strip():    # blank lines don't count toward the gap
                gap += 1
                if gap > SECTION_GAP:
                    break
        if matched:
            blocks.append((start, matched))

    if not blocks:
        return {"found": False, "heading": None, "heading_line": None,
                "pairs": [], "n_lines": 0}

    best_n = max(len(m) for _, m in blocks)
    threshold = max(5, best_n // 10)
    kept = [(s, m) for s, m in blocks if len(m) >= threshold] or \
        [max(blocks, key=lambda b: len(b[1]))]
    union: dict[int, tuple[str, str]] = {}
    for _, matched in kept:
        union.update(matched)
    heading_start = min(s for s, _ in kept)
    return {"found": True,
            "heading": re.sub(r"\s{2,}", " ", lines[heading_start].strip()),
            "heading_line": heading_start + 1,
            "pairs": [union[k] for k in sorted(union)],
            "n_lines": len(union)}


def sample_pairs(pairs: list[tuple[str, str]], k: int = SAMPLE_SIZE):
    """Up to k pairs, evenly spread across the detected section."""
    if len(pairs) <= k:
        return list(pairs)
    step = (len(pairs) - 1) / (k - 1)
    return [pairs[round(i * step)] for i in range(k)]


def ocr_quality(sampled: list[tuple[str, str]]) -> float:
    """Ratio of [a-zA-Z ] chars in the sampled entry names (leader dots and
    page numbers excluded — they aren't OCR errors)."""
    blob = " ".join(name for name, _ in sampled)
    if not blob:
        return 0.0
    good = sum(1 for c in blob if c.isascii() and (c.isalpha() or c == " "))
    return good / len(blob)


# --------------------------------------------------------------------------
# Extraction (phase 2): structure pass over one book
# --------------------------------------------------------------------------

# Entry forms seen in the wild (all OCR-tolerant; when several page numbers
# are listed, the FIRST is taken):
#   "name ...... 123"        dotted leader (front CONTENTS, most indexes)
#   "name, 123" / "name, 123, 456"   comma form (Escoffier's back index)
#   "name, 123."             comma form, trailing period (Boston 1918 index
#                            prints one after EVERY entry; without \.? the
#                            whole 3,800-line index was invisible and extract
#                            fell back to the 31-line TOC — selftest pins it)
DOTTED_ENTRY_RE = re.compile(
    r"^(.{2,120}?)[ .]{2,}\s*-?\s*(\d{1,4})(?:\s*,\s*\d{1,4})*\s*\.?\s*$")
COMMA_ENTRY_RE = re.compile(
    r"^(.{2,120}?)\s*[,;]\s*(\d{1,4})(?:\s*,\s*\d{1,4})*\s*\.?\s*$")
# Escoffier-style numbered indexes prefix each entry with its recipe number
# ("1755  Aiguillettes ..., 558"); strip it when the line also ends in a page.
RECIPE_NO_RE = re.compile(r"^\d{1,4}[a-z]?\s+(?=[^\d\s])")
# Cross-references ("Almonds. See Elementary Preparations", "see No. 1755")
# are not recipes; the trailing number is a recipe number or chapter page.
# Dotless wide-gutter CONTENTS form: a Title-Case entry whose page number sits
# ONE space after the name, with no leader dots ("Marketing 6", "Chinese Sauce
# 10", "Duck 51"). Seen in chinesecookbook00chan, whose OCR puts 2 spaces
# between words but only 1 before the page number, so the strict [ .]{2,} leader
# misses ~80% of the table. Guarded to reduce prose false-positives: the name
# must START uppercase (a heading word, not a mid-sentence tail) and the page
# number must be the whole line's end. Tried only after the dotted/comma forms.
SPACED_CONTENTS_RE = re.compile(r"^([A-Z][^\d]{2,78}?)\s(\d{1,4})\s*\.?\s*$")
CROSS_REF_RE = re.compile(r"\bsee\b", re.IGNORECASE)
GLOSS_MARK_RE = re.compile(r"\(\s*[vo]\.?\s*gl\.?\s*\)", re.IGNORECASE)
COLUMN_NOISE_RE = re.compile(r"(?i)^(no\.?\s*of|recipe|page|continued)\s*[.:]?\s*$")

REGION_JOIN_GAP = 400    # max raw lines between same-kind sections to merge
CHAPTER_GAP = 40         # chapter list ends at the first gap this large
ENTRY_BUFFER_CAP = 200   # runaway guard for wrapped-entry joining (chars)
GARBLE_THRESHOLD = 0.75  # names below this alpha-ratio go to review.md


def get_djvu_text_full(identifier: str) -> str:
    """UNCAPPED OCR text, cached separately from triage's capped fetch (see
    module docstring: the 1.5 MB cap cut off Escoffier's back index)."""
    url = f"https://archive.org/download/{identifier}/{identifier}_djvu.txt"
    return fetch(url, f"{identifier}_djvu_full.txt").decode("utf-8", errors="replace")


def get_book_metadata(identifier: str) -> dict:
    """title/creator/year/publisher from the (cached) metadata endpoint.
    `year` falls back to the first 4-digit run in `date` — Escoffier's item
    has no `year` field but date='1907'."""
    meta = fetch_json(f"https://archive.org/metadata/{identifier}",
                      f"{identifier}_meta.json")
    md = meta.get("metadata", {})

    def first(v):
        return v[0] if isinstance(v, list) and v else v

    year = None
    for field in ("year", "date"):
        m = re.search(r"\d{4}", str(first(md.get(field)) or ""))
        if m:
            year = int(m.group(0))
            break
    return {"title": str(first(md.get("title")) or identifier).strip(),
            "creator": str(first(md.get("creator")) or "").strip(),
            "year": year,
            "publisher": str(first(md.get("publisher")) or "").strip()}


def match_entry(line: str) -> tuple[str, str] | None:
    """(name, first_page) for an index/contents entry line, else None.
    Broader than triage's match_index_line: also comma-form entries,
    multi-page lists, recipe-number prefixes, and cross-reference skips."""
    s = re.sub(r"\s+", " ", _normalize(line)).strip()
    s = RECIPE_NO_RE.sub("", s, count=1)
    m = DOTTED_ENTRY_RE.match(s) or COMMA_ENTRY_RE.match(s)
    if not m:
        # Dotless single-space form is riskier: guard it against ALL-CAPS names,
        # which are running page headers ("THE CHINESE COOK BOOK 85") repeated
        # through the body, not Title-Case contents entries. Without this the
        # header matches on every other page and the contents region bleeds
        # into the whole book.
        m = SPACED_CONTENTS_RE.match(s)
        if not m or not any(c.islower() for c in m.group(1)):
            return None
    name = GLOSS_MARK_RE.sub(" ", m.group(1))
    # Trailing/leading OCR debris on entry names ("Chili Sauce ~ ~", "Virginia
    # Waffles -»", "Betsy Ross Pound Cake .. - „") — strip the mark chars OCR
    # leaves behind (leader-dot/tilde/caret/underscore/guillemet noise) from
    # both ends; interior punctuation and apostrophes are kept.
    name = re.sub(r"\s{2,}", " ", name).strip(" .,;:-~^*_|`«»„“”\"")
    if sum(c.isalpha() for c in name) < 4 or not re.search(r"[A-Za-z]{3}", name):
        return None
    if CROSS_REF_RE.search(name):
        return None
    return name, m.group(2)


def find_regions(lines: list[str]) -> list[dict]:
    """Every CONTENTS/INDEX-like region in the WHOLE file (triage's
    detect_index stops at the biggest one; extraction needs the front
    CONTENTS *and* the back INDEX separately).

    A region is a run of same-kind heading sections: a long index repeats
    its heading as a running head on every scan page ("INDEX" appears ~30
    times in Escoffier), so adjacent same-kind sections within
    REGION_JOIN_GAP raw lines merge. Kind separation (contents vs index)
    keeps the front CONTENTS from ever merging into the body or the index.

    Returns [{kind, heading, heading_line0, end_line0, n, sections}],
    section = {start0, matched: {line0: (name, page)}}.
    """
    hits = [match_entry(ln) if ln.strip() else None for ln in lines]
    cands = [(i, k) for i, k in
             ((i, heading_kind(ln)) for i, ln in enumerate(lines)) if k][:2000]

    regions: list[dict] = []
    for ci, (start, kind) in enumerate(cands):
        hard_end = cands[ci + 1][0] if ci + 1 < len(cands) else len(lines)
        matched: dict[int, tuple[str, str]] = {}
        gap = 0
        for i in range(start + 1, hard_end):
            if hits[i]:
                matched[i] = hits[i]
                gap = 0
            elif lines[i].strip():
                gap += 1
                if gap > SECTION_GAP:
                    break
        if not matched:
            continue
        section = {"start0": start, "matched": matched}
        prev = regions[-1] if regions else None
        if prev and prev["kind"] == kind and start - prev["end_line0"] <= REGION_JOIN_GAP:
            prev["sections"].append(section)
            prev["end_line0"] = max(prev["end_line0"], max(matched))
            prev["n"] += len(matched)
        else:
            regions.append({"kind": kind,
                            "heading": re.sub(r"\s{2,}", " ", lines[start].strip()),
                            "heading_line0": start,
                            "end_line0": max(matched),
                            "n": len(matched),
                            "sections": [section]})
    return regions


def parse_recipe_region(lines: list[str], region: dict) -> list[tuple[str, str]]:
    """(name, page) entries from the recipe-level region's RAW lines.

    Escoffier's two-column index wraps long entries ("1755  Aiguillettes of
    Rouen duck" / "bigarrade,  558") — per-line matching alone loses the
    head and emits the orphan tail as a bogus name — so lines that don't
    complete an entry are buffered and joined (hyphen-aware) until the page
    number arrives. Disambiguation rules, in order:
      * running heads / column headers ("INDEX", "No. of", "Recipe") skipped;
      * a line starting with a recipe number abandons any pending buffer
        (the previous entry never got a parseable page — OCR loss);
      * a line that matches ALONE and starts uppercase is a complete entry
        even when a buffer is pending (the buffer was junk, not a head);
      * buffers over ENTRY_BUFFER_CAP chars are dropped (prose runaway).
    """
    out: list[tuple[str, str]] = []
    buf = ""
    for i in range(region["heading_line0"] + 1, region["end_line0"] + 1):
        raw = lines[i]
        if not raw.strip() or is_heading(raw):
            continue
        s = re.sub(r"\s+", " ", _normalize(raw)).strip()
        if COLUMN_NOISE_RE.match(s):
            continue
        if buf and RECIPE_NO_RE.match(s):
            buf = ""
        if buf:
            alone = match_entry(s)
            if alone and s[:1].isupper():
                out.append(alone)
                buf = ""
                continue
            buf = buf[:-1] + s if buf.endswith("-") else buf + " " + s
        else:
            buf = s
        got = match_entry(buf)
        if got:
            out.append(got)
            buf = ""
        elif len(buf) > ENTRY_BUFFER_CAP:
            buf = ""
    return out


def parse_chapters(region: dict) -> list[tuple[str, int]]:
    """(chapter_name, start_page) pairs from a chapter-level CONTENTS region,
    sorted by page (duplicate start pages keep the first name).

    Truncated at the first CHAPTER_GAP-line gap between matches: whatever
    follows the dense chapter run (Escoffier: a GLOSSARY of 'X, see No. 123'
    lines, then 50k lines of body) is not part of the chapter list even when
    a stray line happens to match the entry pattern.
    """
    flat = sorted((ln, nm, pg) for sec in region["sections"]
                  for ln, (nm, pg) in sec["matched"].items())
    chapters: list[tuple[str, int]] = []
    prev_ln = None
    for ln, name, page in flat:
        if prev_ln is not None and ln - prev_ln > CHAPTER_GAP:
            break
        chapters.append((name, int(page)))
        prev_ln = ln
    seen: set[int] = set()
    out = []
    for name, page in chapters:
        if page not in seen:
            seen.add(page)
            out.append((name, page))
    out.sort(key=lambda c: c[1])
    return out


def chapter_for(page: int, chapters: list[tuple[str, int]]) -> str | None:
    """Chapter whose [start_page, next_chapter_start) range contains `page`.
    Pages before the first parsed chapter get None (Escoffier's chapters I–II
    have OCR-garbled page numbers and drop out; their recipes stay
    uncategorized for the judgment pass)."""
    hit = None
    for name, start in chapters:
        if page >= start:
            hit = name
        else:
            break
    return hit


def name_alpha_ratio(name: str) -> float:
    """Share of chars that belong in a recipe name (unicode letters keep
    accented French names from flagging; digits/symbols are OCR debris)."""
    if not name:
        return 0.0
    return sum(1 for c in name if c.isalpha() or c in " '-,()&") / len(name)


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def rank_pct(values: list[float]) -> list[float]:
    """Percentile rank in [0, 1] per value; ties share their average rank."""
    n = len(values)
    if n <= 1:
        return [1.0] * n
    order = sorted(range(n), key=lambda i: values[i])
    pct = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        shared = ((i + j) / 2) / (n - 1)
        for k in range(i, j + 1):
            pct[order[k]] = shared
        i = j + 1
    return pct


def apply_scores(books: list[dict]) -> None:
    metric = {
        "resolvability": [b["pct_resolving"] for b in books],
        "index_size": [b["index"]["n_lines"] for b in books],
        "ocr": [b["ocr_ratio"] for b in books],
        "downloads": [b["downloads"] or 0 for b in books],
    }
    ranks = {name: rank_pct(vals) for name, vals in metric.items()}
    for i, book in enumerate(books):
        book["score"] = round(
            sum(WEIGHTS[name] * ranks[name][i] for name in WEIGHTS), 4)


# --------------------------------------------------------------------------
# Triage
# --------------------------------------------------------------------------

def _first(value):
    """advancedsearch fields are occasionally lists; take the first item."""
    return value[0] if isinstance(value, list) and value else value


def triage_one(doc: dict) -> dict:
    identifier = doc["identifier"]
    book = {
        "identifier": identifier,
        "title": str(_first(doc.get("title")) or "").strip(),
        "creator": str(_first(doc.get("creator")) or "").strip(),
        "year": _first(doc.get("year")),
        "downloads": _first(doc.get("downloads")) or 0,
    }

    text = get_djvu_text(identifier)
    flat = get_page_map(identifier)
    printed = build_printed_map(flat)

    idx = detect_index(text)
    sampled = sample_pairs(idx["pairs"])
    samples = []
    for name, page in sampled:
        pos = printed.get(page)
        samples.append({
            "name": name, "page": page,
            "resolved": pos is not None,
            "leaf_index": pos,
            "url": deep_link(identifier, pos) if pos is not None else None,
        })
    n_resolved = sum(1 for s in samples if s["resolved"])

    book.update({
        "index": {"found": idx["found"], "heading": idx["heading"],
                  "heading_line": idx["heading_line"], "n_lines": idx["n_lines"],
                  "samples": samples},
        "pct_resolving": round(n_resolved / len(samples), 3) if samples else 0.0,
        "ocr_ratio": round(ocr_quality(sampled), 3),
        "page_map": {"n_leaves": len(flat), "n_printed_mapped": len(printed)},
        "note": (f"{idx['heading'].upper()} found @ line {idx['heading_line']}"
                 if idx["found"] else "no index detected"),
    })
    return book


def cmd_triage(args: argparse.Namespace) -> int:
    out_md = Path(args.out)
    out_json = out_md.with_suffix(".json")
    out_md.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.monotonic()
    print(f"searching: {SEARCH_QUERY!r} (top {args.max} by downloads)",
          file=sys.stderr)

    docs: dict[str, dict] = {}
    page = 1
    while len(docs) < args.max:
        batch = search_page(page)
        if not batch:
            break
        for doc in batch:
            if len(docs) >= args.max:
                break
            docs.setdefault(doc["identifier"], doc)
        page += 1
    print(f"search returned {len(docs)} candidates", file=sys.stderr)

    books: list[dict] = []
    skipped: list[dict] = []
    for i, doc in enumerate(docs.values(), 1):
        identifier = doc["identifier"]
        try:
            books.append(triage_one(doc))
        except FetchError as e:
            skipped.append({"identifier": identifier, "reason": str(e)})
            print(f"  skip {identifier}: {e}", file=sys.stderr)
        except Exception as e:  # one bad book must never kill the run
            skipped.append({"identifier": identifier,
                            "reason": f"unexpected {type(e).__name__}: {e}"})
            print(f"  skip {identifier}: unexpected {type(e).__name__}: {e}",
                  file=sys.stderr)
        if i % 10 == 0:
            print(f"[{i}/{len(docs)}] scanned "
                  f"({len(books)} ok, {len(skipped)} skipped, "
                  f"{time.monotonic() - t0:.0f}s)", file=sys.stderr)

    apply_scores(books)
    books.sort(key=lambda b: b["score"], reverse=True)
    for rank, book in enumerate(books, 1):
        book["rank"] = rank

    elapsed = time.monotonic() - t0
    write_markdown(out_md, books, skipped, elapsed)
    out_json.write_text(json.dumps({
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "query": SEARCH_QUERY,
        "params": {"max": args.max, "sample_size": SAMPLE_SIZE,
                   "weights": WEIGHTS, "djvu_cap_bytes": DJVU_CAP},
        "stats": {"scanned": len(books), "skipped": len(skipped),
                  "elapsed_seconds": round(elapsed, 1)},
        "skipped": skipped,
        "books": books,
    }, indent=1), encoding="utf-8")

    print(f"done: {len(books)} scanned, {len(skipped)} skipped, "
          f"{elapsed:.0f}s -> {out_md} + {out_json}", file=sys.stderr)
    return 0


def _md_escape(s: str, width: int) -> str:
    s = s.replace("|", "\\|")
    return s[: width - 1] + "…" if len(s) > width else s


def write_markdown(path: Path, books: list[dict], skipped: list[dict],
                   elapsed: float) -> None:
    n80 = sum(1 for b in books if b["pct_resolving"] >= 0.8)
    n_noidx = sum(1 for b in books if not b["index"]["found"])
    lines = [
        "# archive.org cookbook pack candidates (triage, phase 1)",
        "",
        f"Generated {time.strftime('%Y-%m-%d %H:%M')} by "
        f"`tools/curate_packs.py triage` — {len(books)} books scanned, "
        f"{len(skipped)} skipped, {elapsed:.0f}s.",
        f"Query: `{SEARCH_QUERY}` (the spec's `collection:cbk` is stale — "
        "2 items live — corrected to this query).",
        "",
        f"Score = weighted rank percentile: resolvability 40%, index size 30%, "
        f"OCR quality 20%, downloads 10%. `%resolve` = share of up-to-"
        f"{SAMPLE_SIZE} sampled index entries whose printed page resolves in "
        "the reader page map (deep-linkable).",
        f"Distribution: {n80} of {len(books)} books ≥80% resolving; "
        f"{n_noidx} with no index detected.",
        "",
        f"## Top {min(TOP_TABLE, len(books))}",
        "",
        "| rank | identifier | title | year | creator | idx lines | %resolve "
        "| OCR | downloads | score | note |",
        "|---:|---|---|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for b in books[:TOP_TABLE]:
        lines.append(
            f"| {b['rank']} "
            f"| `{b['identifier']}` "
            f"| {_md_escape(b['title'], 48)} "
            f"| {b['year'] or '?'} "
            f"| {_md_escape(b['creator'], 24)} "
            f"| {b['index']['n_lines']} "
            f"| {b['pct_resolving']:.0%} "
            f"| {b['ocr_ratio']:.2f} "
            f"| {b['downloads']} "
            f"| {b['score']:.3f} "
            f"| {_md_escape(b['note'], 40)} |"
        )
    if skipped:
        lines += ["", "## Skipped", ""]
        lines += [f"- `{s['identifier']}` — {s['reason']}" for s in skipped]
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------
# extract: structure pass -> draft.json + review.md + notes.md
# --------------------------------------------------------------------------

def cmd_extract(args: argparse.Namespace) -> int:
    identifier = args.identifier
    out_dir = Path(args.out_dir) if args.out_dir else BOOKS_DIR / identifier
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = get_book_metadata(identifier)
    lines = get_djvu_text_full(identifier).splitlines()
    regions = find_regions(lines)
    if not regions:
        print(f"ERROR: no CONTENTS/INDEX region found in {identifier}",
              file=sys.stderr)
        return 1

    # Recipe-level section = the region with the most entry lines (a real
    # alphabetical index dwarfs a chapter list); chapter-level = the densest
    # OTHER contents-kind region. A book with only a front CONTENTS treats it
    # as the recipe list and gets no chapter ranges (all categories null).
    recipe_region = max(regions, key=lambda r: r["n"])
    chapter_region = max(
        (r for r in regions if r["kind"] == "contents" and r is not recipe_region),
        key=lambda r: r["n"], default=None)

    raw_entries = parse_recipe_region(lines, recipe_region)
    seen: set[tuple[str, str]] = set()
    pairs: list[tuple[str, str]] = []
    dups = 0
    for name, page in raw_entries:      # exact repeats only; importer parity
        key = (name.lower(), page)
        if key in seen:
            dups += 1
            continue
        seen.add(key)
        pairs.append((name, page))

    chapters = parse_chapters(chapter_region) if chapter_region else []

    printed = build_printed_map(get_page_map(identifier))
    entries = []
    for name, page in pairs:
        chap = chapter_for(int(page), chapters) if chapters else None
        category, add_tags = map_raw_category(chap) if chap else (None, [])
        pos = printed.get(page)         # page-map keys are str; page is str
        entries.append({
            "name": name, "page": page, "chapter": chap, "category": category,
            "tags": add_tags,           # appetizer auto-tag rides along
            "url": (deep_link(identifier, pos) if pos is not None
                    else f"https://archive.org/details/{identifier}"),
            "pageStatus": "verified" if pos is not None else "unverified",
        })

    draft = {
        "identifier": identifier, "title": meta["title"],
        "creator": meta["creator"], "year": meta["year"],
        "extraction": {
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "recipe_index": {"heading": recipe_region["heading"],
                             "line": recipe_region["heading_line0"] + 1,
                             "sections": len(recipe_region["sections"])},
            "chapter_index": ({"heading": chapter_region["heading"],
                               "line": chapter_region["heading_line0"] + 1,
                               "chapters": len(chapters)}
                              if chapter_region else None),
            "duplicates_dropped": dups,
        },
        "entries": entries,
    }
    (out_dir / "draft.json").write_text(
        json.dumps(draft, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_review_md(out_dir / "review.md", draft, chapters)

    notes = out_dir / "notes.md"
    if not notes.exists():              # never clobber a judgment-pass log
        notes.write_text(
            f"# {identifier} — curation notes\n\n"
            "Tags: \n\n"
            "<!-- Book-level tags for `apply`, comma-separated after 'Tags:'"
            " above — e.g. french, classic. Tags in the cuisine vocabulary\n"
            "     (french, italian, ... — see CUISINE_VOCAB in"
            " curate_packs.py) also become the catalog entry's cuisines. -->\n\n"
            "## Judgment pass log\n\n"
            "(what was changed and why — filled during the judgment pass)\n",
            encoding="utf-8")

    n = len(entries)
    verified = sum(e["pageStatus"] == "verified" for e in entries)
    nulls = sum(e["category"] is None for e in entries)
    print(f"{identifier}: {n} entries ({dups} exact dups dropped) | "
          f"{verified}/{n} verified ({verified / max(n, 1):.1%}) | "
          f"{nulls} null-category | "
          f"index {recipe_region['heading']!r} @ line "
          f"{recipe_region['heading_line0'] + 1} | {len(chapters)} chapters")
    print(f"wrote {out_dir}/{{draft.json,review.md,notes.md}}")
    return 0


def write_review_md(path: Path, draft: dict, chapters: list[tuple[str, int]]) -> None:
    entries = draft["entries"]
    n = len(entries)
    verified = sum(e["pageStatus"] == "verified" for e in entries)
    hist = collections.Counter(e["category"] or "(null)" for e in entries)
    ex = draft["extraction"]

    def row(i: int, e: dict, extra: str = "") -> str:
        return (f"| {i} | {_md_escape(e['name'], 60)} | {e['page']} "
                f"| {_md_escape(e['chapter'] or '—', 32)} "
                f"| {e['category'] or '(null)'} | {e['pageStatus']}"
                + (f" | {extra} |" if extra else " |"))

    lines = [
        f"# {draft['title']} — extraction review (`{draft['identifier']}`)",
        "",
        f"{draft['creator'] or 'unknown creator'} · {draft['year'] or '?'} · "
        f"https://archive.org/details/{draft['identifier']}",
        f"Generated {ex['generated']} by `curate_packs.py extract` — do not "
        "hand-edit (regenerate instead); the judgment pass edits final.csv.",
        "",
        f"- Recipe index: {ex['recipe_index']['heading']!r} @ djvu.txt line "
        f"{ex['recipe_index']['line']} "
        f"({ex['recipe_index']['sections']} running-head sections)",
        (f"- Chapter contents: {ex['chapter_index']['heading']!r} @ line "
         f"{ex['chapter_index']['line']} ({ex['chapter_index']['chapters']} "
         "chapters parsed)" if ex["chapter_index"] else
         "- Chapter contents: none found — all categories left null"),
        f"- Entries: **{n}** ({ex['duplicates_dropped']} exact duplicates dropped)",
        f"- Deep links verified: **{verified}** ({verified / max(n, 1):.1%}); "
        f"unverified: {n - verified}",
        f"- Null category: **{hist.get('(null)', 0)}** (judgment pass fills these)",
        "",
        "## Category histogram",
        "",
        "| category | count |",
        "|---|---:|",
        *(f"| {cat} | {cnt} |" for cat, cnt in hist.most_common()),
        "",
        "## Chapter map (as parsed)",
        "",
    ]
    if chapters:
        lines += ["| chapter (as printed) | starts p. | maps to |", "|---|---:|---|"]
        for name, page in chapters:
            cat, _ = map_raw_category(name)
            lines.append(f"| {_md_escape(name, 52)} | {page} | {cat or '(null)'} |")
    else:
        lines.append("(no chapter-level contents parsed)")
    lines += ["", "## First 30 entries", "",
              "| # | name | page | chapter | category | link |",
              "|---:|---|---|---|---|---|"]
    lines += [row(i, e) for i, e in enumerate(entries[:30], 1)]

    flagged = []
    for i, e in enumerate(entries, 1):
        score = name_alpha_ratio(e["name"])
        issues = []
        if score < GARBLE_THRESHOLD:
            issues.append(f"garbled ({score:.2f})")
        elif re.search(r"\d", e["name"]):
            # Escoffier: 47 names carried OCR recipe-number residue
            # ("2G02 Apples, Ir^ne") yet scored above the alpha threshold —
            # digits in a recipe name are always OCR debris, so flag them.
            issues.append("digits in name")
        if e["category"] is None:
            issues.append("no category")
        if issues:
            flagged.append(row(i, e, ", ".join(issues)))
    lines += ["", f"## Needs judgment ({len(flagged)} entries: OCR-garbled "
              "name or null category)", "",
              "| # | name | page | chapter | category | link | issue |",
              "|---:|---|---|---|---|---|---|"]
    lines += flagged
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------
# classify: name-based meal-role classifier + fragment drop
# --------------------------------------------------------------------------
#
# Why this exists: hierarchical-index books (Fannie Farmer's "Boston Cooking-
# School Cook Book", 1918) print an alphabetical index where sub-recipes are
# listed under a parent noun with the parent ELIDED — the raw entry is just the
# qualifier ("Butyric" under "Acid"; "Broiled" under "Beef"; "Devil's Food"
# under "Cake"). The extractor keeps the correct page link but cannot recover
# the parent noun, and the chapter-range categorizer has no chapter map to work
# from (this book's TOC parses to one line). So categories can't come from
# chapter ranges — they must come from the recipe NAME itself.
#
# `classify_name` reads meal ROLE off dish/head-noun keywords (categories are
# meal role per src/data/categories.ts — never cuisine or technique). It is
# reusable across any name-only book, not a one-off for this pack.
#
# `is_fragment` drops the ~7% of index rows that are PURE fragments (leading
# preposition/conjunction, bare roman numeral, sub-word noise) — those carry no
# classifiable head noun and read as broken.
#
# CLEAN-SUBSET POLICY (witness P2P-007) — the reason final.csv is NOT all-kept.
# Hierarchical-index cookbooks flatten under OCR: a sub-entry's parent headword
# is elided, so a real fraction of names truncate to lone qualifiers ("Russian",
# "White", "Broiled") the name classifier cannot place. Parent-noun
# reconstruction was investigated and REJECTED (djvu.txt preserves no
# indentation — every line is flush-left — and alphabetical carry-down
# fabricates ~1/3 of names). We NEVER fabricate a name or invent a category to
# hit a target. So `classify` SHIPS only the CLEAN subset — entries with a
# resolved category at confidence >= CLEAN_THRESHOLD — and HOLDS everything else
# (low-confidence guesses + signal-free names) in needs_review.csv, unshipped.
# Fragments are DROPPED. Yield varies by book (numbered/self-contained indexes
# like Escoffier lose ~0%; Fannie Farmer's hierarchical index ~2,000 of 3,613).
CLEAN_THRESHOLD = 0.45
# A name of a SINGLE content word that classifies only via a best-effort tail
# rule (confidence <= this) is a lone truncated qualifier, not a self-contained
# recipe: "Lemon", "Banana", "Scalloped", bare "Souffle" — the parent dish noun
# was elided in the index (witness P2P-007). It clears the raw threshold but is
# still HELD, because real one-word dishes score higher via a dish-noun rule
# ("Junket" 0.85, "Hash" 0.55). This keeps broken lone-qualifier names out of
# the shipped subset without fabricating a parent noun.
LONE_QUALIFIER_MAX_CONF = 0.5

# OCR on these scans routinely renders an accented vowel as a digit
# ("Canap6s", "Caf6", "Saut6d", "Glac6e", "Consomm6", "Frapp6") — the accent
# is the frequent casualty. Turn any digit adjacent to a letter back into 'e'
# (é/è are by far the most common) so those dish words classify.
_OCR_DIGIT_L = re.compile(r"(?<=[a-z])[0-9]")
_OCR_DIGIT_R = re.compile(r"[0-9](?=[a-z])")
_ALA_OCR = re.compile(r"\b[kh]\s+la\b")   # "à la" mis-OCR'd as "k la" / "h la"


def _clf_clean(name: str) -> str:
    """Lowercased, OCR-repaired, punctuation-normalized form for keyword scan."""
    s = name.lower()
    s = _ALA_OCR.sub("a la", s)
    s = _OCR_DIGIT_L.sub("e", s)
    s = _OCR_DIGIT_R.sub("e", s)
    s = re.sub(r"[^a-z'&, -]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _clf_words(s: str) -> set[str]:
    """Word set for scanning, with light depluralization so a table that lists
    the singular ('steak', 'cake') also catches the plural ('steaks')."""
    out: set[str] = set()
    for raw in re.findall(r"[a-z][a-z'&-]*", s):
        # Strip leading/trailing OCR debris (a leader-dot/quote apostrophe on the
        # last word — "White Bean Soup'" — otherwise tokenizes to "soup'" and
        # misses the soup rule). Internal apostrophes ("pig's") are kept.
        w = raw.strip("'&-")
        if not w:
            continue
        out.add(w)
        if w.endswith("ies") and len(w) > 4:
            out.add(w[:-3] + "y")
        elif w.endswith("es") and len(w) > 4:
            out.add(w[:-2])
        if w.endswith("s") and len(w) > 3:
            out.add(w[:-1])
    return out


# Ingredient vocabularies used only to RESOLVE ambiguous dish words (a "pie"
# with a meat word is a main; with a fruit word, a dessert). Not categories.
_SWEET = {
    "apple", "apricot", "peach", "pear", "plum", "cherry", "berry", "blackberry",
    "blueberry", "raspberry", "strawberry", "currant", "grape", "lemon", "orange",
    "lime", "pineapple", "banana", "raisin", "mince", "mincemeat", "pumpkin",
    "prune", "rhubarb", "date", "fig", "cranberry", "gooseberry", "huckleberry",
    "quince", "custard", "chocolate", "coconut", "cocoanut", "almond", "walnut",
    "nut", "jam", "marmalade", "caramel", "molasses", "honey", "maple", "vanilla",
    "sugar", "sweet", "washington", "marlborough", "cocoa", "peppermint", "sponge",
    "angel", "pound", "tapioca", "whipped", "cream", "mocha", "spice", "brandy",
    "maraschino", "wine",
}
_FRUIT = {
    "fruit", "apple", "apricot", "peach", "pear", "plum", "cherry", "berry",
    "blackberry", "blueberry", "raspberry", "strawberry", "currant", "grape",
    "orange", "lemon", "lime", "pineapple", "banana", "raisin", "prune", "rhubarb",
    "date", "fig", "cranberry", "gooseberry", "huckleberry", "quince", "cantaloupe",
    "melon", "peaches", "pears", "berries", "apples", "cherries", "plums",
    "grapefruit",
}
_MEAT = {
    "beef", "veal", "mutton", "lamb", "pork", "ham", "chicken", "turkey", "duck",
    "goose", "game", "venison", "rabbit", "hare", "oyster", "clam", "lobster",
    "crab", "crabmeat", "fish", "cod", "codfish", "salmon", "halibut", "bass",
    "trout", "haddock", "mackerel", "shad", "smelt", "sole", "flounder", "sardine",
    "tuna", "herring", "finnan", "scallop", "shrimp", "terrapin", "frog", "sausage",
    "liver", "sweetbread", "tripe", "kidney", "bacon", "tongue", "meat", "steak",
    "chop", "calf", "brains", "forcemeat", "giblet", "bluefish", "quail", "grouse",
    "partridge", "pigeon", "squab", "snipe", "plover", "reedbird", "eel", "mussel",
    "whitebait", "whitefish", "perch", "pickerel", "pike", "turbot", "crawfish",
    "crayfish", "prawn", "scampi", "sturgeon", "whiting", "weakfish",
    "tenderloin", "sirloin", "loin", "ribs", "brisket", "rump",
    # game / meat words common in German cookery (reusable):
    "pig", "boar", "peacock", "guinea", "carp",
}
_VEG = {
    "potato", "bean", "pea", "carrot", "beet", "cabbage", "spinach", "corn",
    "asparagus", "tomato", "onion", "turnip", "squash", "celery", "lettuce",
    "cauliflower", "cucumber", "parsnip", "eggplant", "mushroom", "macaroni",
    "spaghetti", "rice", "hominy", "lentil", "artichoke", "okra", "kale", "chard",
    "salsify", "succotash", "samp", "vegetable", "dandelion", "chestnut", "pepper",
    "sprouts", "brussels", "cress", "oyster-plant", "peppers", "lima",
}


def _has(words: set[str], s: set[str]) -> bool:
    return bool(words & s)


# ---- ambiguity resolvers: each takes the word set, returns (cat, conf, tags) ---

def _rz_pie(w):
    if _has(_MEAT, w) or "meat" in w:
        return ("Mains", 0.85, [])
    if _has(_SWEET, w):
        return ("Desserts", 0.85, [])
    return ("Desserts", 0.4, [])          # bare "pie" -> dessert, low conf


def _rz_loaf(w):
    if _has(_MEAT, w):
        return ("Mains", 0.75, [])
    if "nut" in w or _has(_VEG, w):
        return ("Sides", 0.6, [])
    return ("Breads", 0.55, [])


def _rz_cake(w):
    if _has({"griddle", "buckwheat", "flannel", "batter", "wheat"}, w):
        return ("Breakfast & Brunch", 0.75, [])
    # savory "cakes": fish/crab cakes, potato cake, and Chinese "bean cake"
    # (dou fu / tofu) — not a Western dessert.
    if _has({"fish", "clam", "crab", "codfish", "cod", "salmon", "potato",
             "oyster", "bean"}, w):
        return ("Sides", 0.6, [])
    return ("Desserts", 0.85, [])


def _rz_pudding(w):
    if "yorkshire" in w:
        return ("Sides", 0.75, [])
    if _has(_MEAT, w):
        return ("Mains", 0.55, [])
    if _has({"corn", "potato", "cauliflower", "spinach", "vegetable"}, w):
        return ("Sides", 0.55, [])
    return ("Desserts", 0.8, [])


def _rz_fritter(w):
    if _has(_SWEET, w):
        return ("Desserts", 0.7, [])
    return ("Sides", 0.6, [])


def _rz_souffle(w):
    if _has({"chocolate", "lemon", "orange", "vanilla", "coffee", "fruit",
             "caramel", "prune", "apricot"}, w):
        return ("Desserts", 0.75, [])
    if _has({"cheese", "spinach", "chicken", "fish", "potato", "corn",
             "cauliflower", "clam", "lobster", "tomato", "sweetbread",
             "meat", "veal", "ham", "game", "liver", "crab"}, w):
        return ("Sides", 0.6, [])
    return ("Desserts", 0.45, [])


def _rz_mousse(w):
    if _has({"chicken", "fish", "ham", "salmon", "lobster", "foie", "liver"}, w):
        return ("Sides", 0.6, [])
    return ("Desserts", 0.7, [])


def _rz_jelly(w):
    if "roll" in w:
        return ("Desserts", 0.75, [])      # "Jelly Roll" is a sponge cake
    if _has({"wine", "sauterne", "sherry", "champagne", "coffee", "snow",
             "russian", "moulded", "port", "rum"}, w):
        return ("Desserts", 0.6, [])
    return ("Preserves & Pickles", 0.7, [])


def _rz_ice(w):
    if _has({"chest", "box", "picks", "tongs", "cave", "house"}, w):
        return (None, 0.0, [])             # "Ice Chest, Care of" is not a dish
    if _has({"tea", "coffee"}, w):
        return ("Drinks", 0.6, [])         # "Iced Tea"/"Iced Coffee" are drinks
    if "water" in w:
        return ("Drinks", 0.5, [])
    return ("Desserts", 0.7, [])


def _rz_timbale(w):
    if _has(_MEAT, w):
        return ("Mains", 0.6, [])
    return ("Sides", 0.55, [])


def _rz_toast(w):
    if _has({"french", "milk", "cream", "cinnamon"}, w):
        return ("Breakfast & Brunch", 0.6, [])
    return ("Breads", 0.55, [])


def _rz_cocktail(w):
    if _has({"oyster", "clam", "crab", "fruit", "tomato", "shrimp", "lobster",
             "grapefruit", "fish"}, w):
        return ("Sides", 0.6, ["appetizer"])
    return ("Drinks", 0.7, [])


def _rz_cup(w):
    if _has({"claret", "cider", "wine", "champagne", "fruit", "grape", "loving",
             "currant"}, w):
        return ("Drinks", 0.55, [])
    return (None, 0.0, [])                 # bare "cup" is a vessel, not a dish


def _rz_custard(w):
    if _has({"corn", "cheese", "chicken", "vegetable"}, w):
        return ("Sides", 0.55, [])
    return ("Desserts", 0.75, [])


def _rz_dressing(w):
    if _has({"bread", "chestnut", "celery", "giblet", "stuffing", "cracker",
             "sage", "onion"}, w) and "salad" not in w:
        return ("Basics", 0.55, [])        # American "dressing" == stuffing
    return ("Sauces & Condiments", 0.75, [])


def _rz_filling(w):
    if "sandwich" in w:
        return ("Sides", 0.5, [])
    return ("Desserts", 0.6, [])


def _rz_paste(w):
    if _has({"almond", "chocolate"}, w):
        return ("Desserts", 0.6, [])
    if _has({"anchovy", "fish", "ham", "tomato", "cheese", "liver"}, w):
        return ("Sauces & Condiments", 0.55, [])
    return ("Basics", 0.55, [])


def _rz_butter(w):
    if _has({"apple", "pear", "plum", "peach", "grape", "quince"}, w):
        return ("Preserves & Pickles", 0.6, [])   # fruit butters are preserves
    if "peanut" in w:
        return ("Sides", 0.5, [])
    if _has({"cocoa", "clarified", "drawn"}, w) and "sauce" not in w:
        return ("Basics", 0.5, [])
    return ("Sauces & Condiments", 0.65, [])       # compound (anchovy, lemon…) butter


def _rz_balls(w):
    if _has(_MEAT, w):
        return ("Mains", 0.55, [])
    if _has(_SWEET, w) or "pop" in w or "popcorn" in w:
        return ("Desserts", 0.55, [])
    return ("Sides", 0.45, [])


def _rz_patties(w):
    if _has(_MEAT, w):
        return ("Mains", 0.55, [])
    return ("Sides", 0.45, [])


def _rz_dumpling(w):
    if _has(_FRUIT, w) or _has({"apple", "peach", "cherry", "berry"}, w):
        return ("Desserts", 0.6, [])
    return ("Sides", 0.5, [])


# Ordered keyword table. First rule whose keyword set intersects the words
# wins. Dish-type / head-noun words come BEFORE ingredient words so an inverted
# index name resolves on the head ("Soup, Tomato" -> soup, not tomato). A tuple
# ends with a category string (+optional tags) OR a resolver function.
_SOUP = {"soup", "chowder", "bisque", "bouillon", "consomme", "gumbo",
         "pottage", "broth", "puree",
         # Spanish/Latin soup words (reusable across Mexican/Latin packs):
         # "Caldo de Pescado" is a fish SOUP, not a fish main — the section
         # header is elided in a flattened index, so the head noun must carry it.
         "caldo", "sopa", "pozole", "posole", "gazpacho"}
_SAUCE = {"sauce", "gravy", "ketchup", "catsup", "mayonnaise", "mustard",
          "relish", "marinade", "hollandaise", "bechamel",
          "salsa"}   # salsa = sauce (Spanish/Italian); reusable
_DESSERT = {
    "cookie", "doughnut", "gingerbread", "shortcake", "cobbler", "trifle",
    "meringue", "tart", "tartlet", "turnover", "eclair", "charlotte", "blancmange",
    "junket", "parfait", "bavarian", "sherbet", "sorbet", "sundae", "fudge",
    "bonbon", "nougat", "taffy", "fondant", "marshmallow", "candy", "candies",
    "kisses", "brittle", "penuche", "macaroon", "wafer", "brownie", "bombe",
    "ladyfingers", "marguerites", "hermits", "jumbles", "snaps", "cupcake",
    "cream-puffs", "creams", "caramel", "caramels", "bars", "fingers", "tapioca",
}
_BREAD = {
    "bread", "rolls", "roll", "biscuit", "muffin", "popover", "bun", "scone",
    "brioche", "cracker", "zwieback", "gem", "rusks", "twist", "crouton",
    "cornbread", "shortbread", "breadstick",
}
_DRINK = {
    "punch", "lemonade", "tea", "coffee", "cocoa", "cordial", "fizz", "shrub",
    "nectar", "beverage", "frappe", "flip", "eggnog", "sangaree", "mead",
    "lemonade", "cafe", "claret", "cider", "orangeade",
}
_PRESERVE = {
    "pickle", "pickled", "jam", "preserve", "marmalade", "conserve", "chutney",
    "canned", "canning", "compote", "catchup",
}
_BASIC = {
    "stock", "forcemeat", "force-meat", "dough", "batter", "roux", "essence",
    "seasoning", "brine", "yeast", "crumbs", "stuffing",
}
_SALAD = {"salad", "slaw"}
# Truncated cake/cookie sub-names (the parent "Cake" is elided in the index).
# Weak dessert signal — enough to place, honest enough to still surface for
# review at a middling confidence.
_DESSERT_HINT = {"pound", "sponge", "spice", "mocha", "marble", "layer",
                 "drop", "queens", "queen", "fours", "petit", "cream-puff",
                 "cocoanut", "coconut", "vanilla", "maple", "snow", "meringued"}
# Lone cooking-method qualifiers ("Broiled", "Planked" under an elided meat
# parent). Almost always a meat/fish course in this corpus.
_MEAT_METHOD = {"broiled", "planked", "larded", "barbecued", "grilled",
                "roasted", "smothered", "fricasseed", "braised", "corned",
                "jugged", "potted", "fried", "sauted", "sauteed", "deviled",
                "devilled", "minced", "hashed", "roast"}
# Spanish/Latin dish-type head nouns (reusable across Mexican/Latin packs).
# A masa-and-filling or wrapped-tortilla dish is a main course by meal role.
_LATIN_MAIN = {"tamale", "tamal", "tamales", "enchilada", "enchiladas",
               "albondigas", "albondiga", "albondiguillas", "empanada",
               "empanadas", "burrito", "burritos", "carnitas", "barbacoa",
               "fajita", "fajitas"}
# Cheese-in-tortilla / bean small plates -> Sides (the app folds small plates
# into Sides). "Quesadillas", "Frijoles" (beans), "Nachos".
_LATIN_SIDE = {"quesadilla", "quesadillas", "frijoles", "frijol", "nachos",
               "tostada", "tostadas"}

_RULES: list[tuple] = [
    (_SOUP, "Soups & Stews", 0.9),
    ({"stew"}, "Soups & Stews", 0.8),
    ({"dressing"}, _rz_dressing),
    (_SALAD, "Salads", 0.9),
    (_SAUCE, "Sauces & Condiments", 0.85),
    ({"pie", "pies"}, _rz_pie),
    ({"griddle", "pancake", "waffle", "wafles"}, "Breakfast & Brunch", 0.8),
    ({"cake"}, _rz_cake),
    ({"pudding"}, _rz_pudding),
    ({"souffle", "souffl"}, _rz_souffle),
    ({"mousse"}, _rz_mousse),
    ({"custard"}, _rz_custard),
    ({"frosting", "icing"}, "Desserts", 0.85),
    ({"aspic"}, "Basics", 0.7),
    ({"jelly"}, _rz_jelly),
    (_DESSERT, "Desserts", 0.85),
    ({"ice", "ices", "glace", "glac", "iced"}, _rz_ice),
    ({"frozen"}, "Desserts", 0.6),
    ({"fritter"}, _rz_fritter),
    ({"timbale"}, _rz_timbale),
    ({"cocktail"}, _rz_cocktail),
    ({"cup"}, _rz_cup),
    ({"toast"}, _rz_toast),
    ({"loaf", "loaves"}, _rz_loaf),
    ({"filling"}, _rz_filling),
    ({"paste"}, _rz_paste),
    ({"butter"}, _rz_butter),
    (_BREAD, "Breads", 0.8),
    ({"omelet", "omelette", "cereal", "oatmeal", "oats", "porridge", "mush",
      "frittata", "hominy"}, "Breakfast & Brunch", 0.75),
    ({"eggs", "egg"}, "Breakfast & Brunch", 0.7),
    ({"hash"}, "Mains", 0.55),
    (_DRINK, "Drinks", 0.7),
    ({"chocolate"}, "Drinks", 0.4),        # bare: drink or dessert, honest low
    (_PRESERVE, "Preserves & Pickles", 0.85),
    (_BASIC, "Basics", 0.7),
    ({"croquette", "croquettes"}, "Sides", 0.8),
    ({"sandwich"}, "Sides", 0.6),
    ({"canape", "canap", "canapes"}, "Sides", 0.7, ["appetizer"]),
    ({"rarebit", "rabbit-welsh", "fondue", "cheese", "gnocchi", "anchovy",
      "anchovies"}, "Sides", 0.55),
    ({"pilaf", "pilau", "risotto", "noodles", "noodle", "greens", "polenta"},
     "Sides", 0.6),
    # German sides (reusable): sauerkraut and dumpling/Spätzle-family words.
    ({"sauerkraut", "kraut", "sourkrout", "spatzle", "spatzen", "knodel",
      "klosse", "kloss"}, "Sides", 0.6),
    ({"rissoles", "rissole", "croustade", "croustades", "cromesquis", "ramequins",
      "ramekins", "cannelon", "vol-au-vents", "bouchees", "spaetzle"},
     "Sides", 0.55, ["appetizer"]),
    ({"julep", "juleps"}, "Drinks", 0.7),
    ({"napoleons", "napoleon"}, "Desserts", 0.6),
    ({"dumpling", "dumplings"}, _rz_dumpling),
    ({"balls"}, _rz_balls),
    ({"patties"}, _rz_patties),
    ({"scalloped", "stuffed", "curried"}, "Sides", 0.5),
    (_LATIN_MAIN, "Mains", 0.7),
    (_LATIN_SIDE, "Sides", 0.6),
    (_MEAT, "Mains", 0.7),
    # "stewed" is NOT here: meat stews are already caught by _MEAT above, so a
    # remaining "Stewed X" is a vegetable/fruit ("Stewed Celery", "Stewed Corn")
    # -> let _VEG/_FRUIT below place it, not Mains.
    ({"steak", "chops", "cutlet", "ragout", "fricassee", "goulash",
      "fillets", "fillet", "curry"}, "Mains", 0.6),
    (_VEG, "Sides", 0.65),
    # -- best-effort tail: truncated qualifiers with no dish noun --------------
    (_MEAT_METHOD, "Mains", 0.4),          # lone "Broiled"/"Planked" -> review
    (_DESSERT_HINT, "Desserts", 0.5),      # lone cake sub-name
    ({"cream", "creamed"}, "Desserts", 0.4),   # Bavarian/Spanish creams dominate
    (_FRUIT, "Desserts", 0.45),            # bare fruit -> fruit-course dessert
]

_APPET_RE = re.compile(r"canap|hors.?d.?oeuvre|appetizer")


def _clf_scan(words: set[str]) -> tuple[str | None, float, list[str]]:
    for rule in _RULES:
        matcher, handler = rule[0], rule[1]
        if not (matcher & words):
            continue
        if callable(handler):
            cat, conf, tags = handler(words)
            if cat is None:
                continue                    # resolver declined; keep scanning
            return cat, conf, list(tags)
        tags = list(rule[3]) if len(rule) > 3 else []
        return handler, rule[2], tags
    return None, 0.0, []


def classify_name(name: str) -> tuple[str | None, float, list[str]]:
    """Best meal-role category for a recipe NAME, its confidence (0..1), and
    any auto-tags. Categories are the app's 11 (meal role, never cuisine).

    Inverted index names ("Cake, Rice", "Soup, Tomato") resolve on the head
    noun — the part before the first comma — which is scanned first, then the
    whole string. Ambiguous dish words return an honest confidence: "apple pie"
    -> (Desserts, 0.85) but bare "pie" -> (Desserts, 0.4); "chocolate" alone ->
    (Drinks, 0.4). No signal at all -> (None, 0.0, [])."""
    if not name:
        return (None, 0.0, [])
    s = _clf_clean(name)
    if not s:
        return (None, 0.0, [])
    tags: list[str] = ["appetizer"] if _APPET_RE.search(s) else []
    if "ice cream" in s or "ice-cream" in s:   # unambiguous, beats bisque/bread
        return ("Desserts", 0.85, tags)
    # The dish is the head noun before the first comma OR " with " — the part
    # after names an accompaniment, not the dish ("Porterhouse Steak with
    # Mushroom Sauce" is a Main, not a sauce). Scan the head first, then, if it
    # gives no signal, the whole string.
    head = re.split(r",|\bwith\b", s, maxsplit=1)[0].strip()
    cat, conf, kw_tags = _clf_scan(_clf_words(head))
    if cat is None:                          # head gave nothing; scan whole name
        cat, conf, kw_tags = _clf_scan(_clf_words(s))
    for t in kw_tags:
        if t not in tags:
            tags.append(t)
    return (cat, conf, tags)


# Leading tokens that mark a pure fragment (a truncated tail with no head
# noun): conjunctions, prepositions, articles, and the OCR of "à la"/"au".
_FRAG_LEAD = {
    "and", "or", "of", "with", "in", "for", "the", "a", "an", "how", "to", "at",
    "on", "by", "from", "over", "au", "aux", "en", "k", "h", "why", "when",
}
_ROMAN_RE = re.compile(r"^[ivxlcdm]+$")


def is_fragment(name: str) -> bool:
    """True for pure fragments that should be DROPPED (not classified): a
    leading conjunction/preposition ("and Rice Croquettes", "of Beef, Broiled"),
    a name that is ONLY function words, fewer than 4 letters, or a bare roman
    numeral. These are index sub-entry tails whose head noun was elided past
    recognition — keeping them would ship broken names."""
    if not name:
        return True
    s = _clf_clean(name)
    if sum(c.isalpha() for c in s) < 4:
        return True
    words = re.findall(r"[a-z'-]+", s)
    if not words:
        return True
    if words[0] in _FRAG_LEAD:
        return True
    if len(words) == 1 and _ROMAN_RE.match(words[0]):
        return True
    if all(w in _FRAG_LEAD for w in words):
        return True
    return False


# Bare single-word DISH-TYPE labels. A recipe named only "Sauce", "Jelly",
# "Pudding" is a truncated sub-entry whose specific qualifier was elided — the
# index groups dozens of "[X] Sauce" recipes and OCR flattening left just
# "Sauce" on 29 different pages (witness P2P-007). These score high (a dish-noun
# rule fires) yet are NOT self-contained recipes, so a lone one is HELD like any
# other truncated qualifier. Deliberately EXCLUDED: ingredient-as-dish names
# (bare "Asparagus", "Bacon", "Anchovies" read as real recipes in this era) and
# specific named dishes (Gingerbread, Doughnuts, Brownies, Junket) — only
# genuine category super-types belong here.
GENERIC_HEAD_NOUNS = {
    "soup", "chowder", "bisque", "bouillon", "consomme", "broth", "pottage",
    "sauce", "gravy", "dressing", "cake", "bread", "roll", "biscuit", "muffin",
    "bun", "loaf", "pudding", "custard", "jelly", "sherbet", "sorbet", "cream",
    "mousse", "souffle", "fritter", "tart", "filling", "paste", "omelet",
    "omelette", "punch", "cocktail", "cordial", "frappe", "stew", "salad",
    "toast", "timbale", "dumpling", "sandwich", "croquette",
}


def _lone_word(name: str) -> str | None:
    """The single content word of a one-word name (OCR-cleaned), else None —
    e.g. 'Lemon', 'Scalloped', 'Sauce'. Roman-numeral variant suffixes
    ('Cake II') are ignored so 'Cake II' still reads as the lone word 'cake'."""
    words = [w for w in re.findall(r"[a-z][a-z'&-]*", _clf_clean(name))
             if not _ROMAN_RE.match(w)]
    return words[0] if len(words) == 1 else None


def classify_entry(entry: dict, threshold: float = CLEAN_THRESHOLD) -> dict:
    """Clean-subset verdict for ONE draft entry (witness P2P-007). Pure — no
    I/O — so the selftest can pin the split without touching files.

    Returns {verdict, name, page, category, confidence, tags[, reason]}:
      * 'dropped' — a pure fragment (`is_fragment`): a truncated tail with no
        head noun; shipping it would mean a broken name. -> dropped.csv.
      * 'clean'   — a RESOLVED category at confidence >= threshold. This is the
        only verdict that ships (final.csv).
      * 'held'    — everything else: a low-confidence guess OR a signal-free
        name (lone truncated qualifier). HELD in needs_review.csv, NOT shipped;
        we never fabricate a category to force it into the pack.

    Category source is chapter-map-first (a book that DOES carry a usable
    chapter map keeps it, at confidence 1.0), else the name classifier.
    """
    name, page = entry["name"], entry["page"]
    if is_fragment(name):
        return {"verdict": "dropped", "name": name, "page": page,
                "category": None, "confidence": 0.0, "tags": [],
                "reason": "fragment"}
    chap = entry.get("chapter")
    cat, add_tags = (None, [])
    if chap:
        cat, add_tags = map_raw_category(chap)
    conf = 1.0 if cat else 0.0
    if cat is None:
        cat, conf, add_tags = classify_name(name)
    tags = list(dict.fromkeys([*entry.get("tags", []), *add_tags]))
    verdict = "held"
    if cat is not None and conf >= threshold:
        verdict = "clean"
        # ...unless the name is a single lone word that is either a best-effort
        # tail match (conf <= 0.5: "Lemon", "Scalloped") OR a bare dish-type
        # label ("Sauce", "Jelly", any confidence). Both are truncated
        # qualifiers, not self-contained recipes — hold rather than ship a
        # broken name (P2P-007).
        lone = _lone_word(name)
        if lone is not None and (conf <= LONE_QUALIFIER_MAX_CONF
                                 or bool(_clf_words(lone) & GENERIC_HEAD_NOUNS)):
            verdict = "held"
    return {"verdict": verdict, "name": name, "page": page,
            "category": cat, "confidence": conf, "tags": tags}


def cmd_classify(args: argparse.Namespace) -> int:
    identifier = args.identifier
    threshold = args.threshold
    book_dir = BOOKS_DIR / identifier
    draft_path = book_dir / "draft.json"
    if not draft_path.exists():
        print(f"ERROR: {draft_path} not found — run `extract {identifier}` first",
              file=sys.stderr)
        return 1
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
    entries = draft["entries"]

    clean: list[dict] = []                          # -> final.csv (SHIPPED)
    held: list[tuple[str, str, str, float]] = []    # -> needs_review (name,page,cat,conf)
    dropped: list[tuple[str, str, str]] = []        # -> dropped.csv (name,page,reason)
    hist: collections.Counter = collections.Counter()   # CLEAN-ONLY histogram
    for e in entries:
        v = classify_entry(e, threshold)
        if v["verdict"] == "dropped":
            dropped.append((v["name"], v["page"], v["reason"]))
        elif v["verdict"] == "clean":
            hist[v["category"]] += 1
            clean.append({
                "name": v["name"], "page": v["page"], "category": v["category"],
                "tags": ", ".join(v["tags"]), "url": e.get("url", ""),
                "pageStatus": e.get("pageStatus", "unverified"),
            })
        else:  # held — not shipped
            held.append((v["name"], v["page"],
                         v["category"] or "Uncategorized", v["confidence"]))

    # final.csv is now the CLEAN subset only (witness P2P-007): every row has a
    # resolved category, so `apply` ships a clean pack with no blank categories.
    _write_csv(book_dir / "final.csv",
               ["name", "page", "category", "tags", "url", "pageStatus"],
               [[k["name"], k["page"], k["category"], k["tags"], k["url"],
                 k["pageStatus"]] for k in clean])
    _write_csv(book_dir / "needs_review.csv",
               ["name", "page", "guessed_category", "confidence"],
               [[n, p, c, f"{cf:.2f}"] for n, p, c, cf in held])
    _write_csv(book_dir / "dropped.csv",
               ["name", "page", "reason"],
               [[n, p, r] for n, p, r in dropped])

    raw = len(entries)
    n_clean, n_held, n_drop = len(clean), len(held), len(dropped)
    # stats.json lets `apply` stamp curatedSubset + rawIndexCount honestly
    # (how many index entries were withheld) without re-deriving them.
    (book_dir / "stats.json").write_text(
        json.dumps({"raw": raw, "clean": n_clean, "held": n_held,
                    "dropped": n_drop, "threshold": threshold,
                    "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z")},
                   indent=1) + "\n", encoding="utf-8")

    def pct(n: int) -> str:
        return f"{n / max(raw, 1):.1%}"
    print(f"{identifier}: {raw} raw index entries "
          f"(threshold {threshold:.2f})")
    print(f"  clean   (SHIPPED -> final.csv):        {n_clean:5d}  ({pct(n_clean)})")
    print(f"  held    (needs review, NOT shipped):   {n_held:5d}  ({pct(n_held)})")
    print(f"  dropped (fragments):                   {n_drop:5d}  ({pct(n_drop)})")
    print("  clean category histogram:")
    for cat, cnt in hist.most_common():
        print(f"    {cnt:5d}  {cat}")
    print(f"  wrote {book_dir}/{{final.csv,needs_review.csv,dropped.csv,stats.json}}")
    return 0


def _write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


# --------------------------------------------------------------------------
# apply: final.csv -> public/packs/<id>.json + catalog.json entry
# --------------------------------------------------------------------------

# Country guess from the publisher imprint's city (archive.org metadata has
# no country field for these books). Override with --country when wrong.
_PUBLISHER_CITIES = [
    ("london", "GB"), ("edinburgh", "GB"), ("glasgow", "GB"), ("dublin", "IE"),
    ("new york", "US"), ("boston", "US"), ("chicago", "US"),
    ("philadelphia", "US"), ("san francisco", "US"), ("springfield", "US"),
    ("milwaukee", "US"),
    ("toronto", "CA"), ("paris", "FR"),
]

_TITLE_SMALL_WORDS = {"a", "an", "the", "of", "to", "and", "or", "in", "on",
                      "for", "with", "at", "from", "by"}


def smart_title(s: str) -> str:
    """archive.org titles are sentence-case ('A guide to modern cookery');
    packs want title case ('A Guide to Modern Cookery')."""
    words = s.split()
    return " ".join(
        w.lower() if i > 0 and w.lower() in _TITLE_SMALL_WORDS
        else w[:1].upper() + w[1:]
        for i, w in enumerate(words))


def clean_creator(s: str) -> str:
    """Drop trailing life dates and archive.org catalog annotations:
    'Escoffier, A. (Auguste), 1846-1935' -> 'Escoffier, A. (Auguste)';
    'Chan, Shiu Wong, 1893- [from old catalog]' -> 'Chan, Shiu Wong'."""
    s = re.sub(r"\s*\[[^\]]*\]\s*$", "", s)        # trailing "[from old catalog]"
    s = re.sub(r"[,;\s]*\d{4}\s*-\s*(\d{4})?\.?\s*$", "", s)   # life dates 1846-1935
    s = re.sub(r"[,;\s]*[bd]\.\s*\d{4}\.?\s*$", "", s)        # death/birth only: ", d. 1876"
    return s.strip()


def country_from_publisher(publisher: str) -> str | None:
    p = publisher.lower()
    return next((cc for city, cc in _PUBLISHER_CITIES if city in p), None)


def book_tags_from_notes(book_dir: Path) -> list[str]:
    notes = book_dir / "notes.md"
    if not notes.exists():
        return []
    for line in notes.read_text(encoding="utf-8").splitlines():
        m = re.match(r"(?i)^tags:\s*(.*)$", line.strip())
        if m:
            return [t.strip().lower() for t in m.group(1).split(",") if t.strip()]
    return []


def cmd_apply(args: argparse.Namespace) -> int:
    identifier = args.identifier
    book_dir = BOOKS_DIR / identifier
    final = book_dir / "final.csv"
    if not final.exists():
        print(f"ERROR: {final} not found — the judgment pass produces it from "
              "draft.json (see tools/CURATION.md)", file=sys.stderr)
        return 1

    meta = get_book_metadata(identifier)
    title = args.title or smart_title(meta["title"])
    author = args.author or clean_creator(meta["creator"]) or None
    country = args.country or country_from_publisher(meta["publisher"])
    book_tags = ([t.strip().lower() for t in args.book_tags.split(",") if t.strip()]
                 if args.book_tags else book_tags_from_notes(book_dir))
    cuisines = [t for t in book_tags if t in CUISINE_VOCAB]

    with final.open(newline="", encoding="utf-8-sig") as f:
        rows = [{(k or "").strip().lower(): (v or "").strip()
                 for k, v in row.items()} for row in csv.DictReader(f)]
    if not rows or not {"name", "page"} <= set(rows[0]):
        print("ERROR: final.csv needs at least name,page columns "
              "(full set: name,page,category,tags,url,pageStatus)", file=sys.stderr)
        return 1

    recipes: list[dict] = []
    hist: collections.Counter = collections.Counter()
    unmapped: collections.Counter = collections.Counter()
    seen: set[tuple[str, str]] = set()
    dups = blanks = verified = 0
    for row in rows:
        name, page = row.get("name", ""), row.get("page", "")
        if not name:
            continue
        key = (" ".join(name.split()).lower(), page)
        if key in seen:                 # keep-first, mirrors planImport
            dups += 1
            continue
        seen.add(key)
        category, add_tags = None, []
        raw_cat = row.get("category", "")
        if raw_cat:
            category, add_tags = map_raw_category(raw_cat)
            if category is None:
                unmapped[raw_cat] += 1
                continue
        else:
            blanks += 1                 # imports as Uncategorized — allowed
        # app tag rule (src/logic/importer.ts): lowercase, dedupe, and drop
        # any tag whose text already appears in the recipe name
        raw_tags = row.get("tags", "").replace(";", ",").split(",")
        tags, tseen = [], set()
        for t in (*raw_tags, *add_tags):
            t = t.strip().lower()
            if t and t not in tseen and t not in name.lower():
                tseen.add(t)
                tags.append(t)
        status = "verified" if row.get("pagestatus", "").lower() == "verified" \
            else "unverified"
        verified += status == "verified"
        rec: dict = {"name": name, "page": page}
        if category:
            rec["category"] = category
        rec["tags"] = tags
        rec["link"] = {"url": row.get("url")
                       or f"https://archive.org/details/{identifier}",
                       "pageStatus": status}
        recipes.append(rec)
        hist[category or "(none)"] += 1

    print(f"{len(recipes)} recipes from {final}"
          + (f" ({dups} duplicates dropped)" if dups else ""))
    for cat, cnt in hist.most_common():
        print(f"  {cnt:5d}  {cat}")
    print(f"  {verified}/{len(recipes)} verified deep links")
    if unmapped:
        print("\nERROR: unmapped categories (packs must ship clean — fix "
              f"final.csv): {dict(unmapped)}", file=sys.stderr)
        return 1
    if blanks:
        print(f"warning: {blanks} recipes without category "
              "(they install as Uncategorized)", file=sys.stderr)

    # Honesty flag (witness P2P-007): when classify withheld a material share
    # of the raw index (held + dropped > 5% of raw), stamp the pack + catalog
    # entry so the metadata says out loud that this is a curated subset and how
    # many index entries the book actually had. Read from classify's stats.json;
    # absent (e.g. a self-contained book curated straight to final.csv) -> omit.
    curated_extras: dict = {}
    stats_path = book_dir / "stats.json"
    if stats_path.exists():
        try:
            stats = json.loads(stats_path.read_text(encoding="utf-8"))
            raw = int(stats.get("raw", 0))
            withheld = int(stats.get("held", 0)) + int(stats.get("dropped", 0))
            if raw and withheld / raw > 0.05:
                curated_extras = {"curatedSubset": True, "rawIndexCount": raw}
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    pack = {"id": identifier, "version": 1,
            "book": {"name": title, "tags": book_tags},
            **curated_extras, "recipes": recipes}
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    pack_path = PACKS_DIR / f"{identifier}.json"
    pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8")
    print(f"wrote {pack_path}")

    catalog_path = PACKS_DIR / "catalog.json"
    catalog = (json.loads(catalog_path.read_text(encoding="utf-8"))
               if catalog_path.exists() else {"catalogVersion": 1, "packs": []})
    entry = {
        "id": identifier, "title": title, "author": author,
        "year": meta["year"], "country": country, "cuisines": cuisines,
        "era": "historical", "type": "linked", "recipeCount": len(recipes),
        "categories": [c for c, _ in hist.most_common() if c != "(none)"],
        **curated_extras,
        "file": f"packs/{identifier}.json", "version": 1,
    }
    entry = {k: v for k, v in entry.items() if v is not None}
    catalog["packs"] = [p for p in catalog["packs"]
                        if p["id"] != identifier] + [entry]
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n",
                            encoding="utf-8")
    print(f"updated {catalog_path}")
    return 0


# --------------------------------------------------------------------------
# verify-links: HEAD-check sampled entry URLs
# --------------------------------------------------------------------------

def head_status(url: str) -> int | str:
    """HTTP status of a HEAD request (rate-limited, never cached)."""
    global _last_hit
    _rate_limit()
    req = urllib.request.Request(url, method="HEAD",
                                 headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        return f"{type(e).__name__}"
    finally:
        _last_hit = time.monotonic()


def cmd_verify_links(args: argparse.Namespace) -> int:
    identifier = args.identifier
    pack_path = PACKS_DIR / f"{identifier}.json"
    draft_path = BOOKS_DIR / identifier / "draft.json"
    if pack_path.exists():
        data = json.loads(pack_path.read_text(encoding="utf-8"))
        items = [(r["name"], r["link"]["url"])
                 for r in data["recipes"] if r.get("link")]
        source = pack_path
    elif draft_path.exists():
        data = json.loads(draft_path.read_text(encoding="utf-8"))
        items = [(e["name"], e["url"]) for e in data["entries"]]
        source = draft_path
    else:
        print(f"ERROR: neither {pack_path} nor {draft_path} exists — run "
              "extract (or apply) first", file=sys.stderr)
        return 1
    if not items:
        print("ERROR: no linked entries to verify", file=sys.stderr)
        return 1

    sampled = sample_pairs(items, args.sample)
    print(f"HEAD-checking {len(sampled)} of {len(items)} URLs from {source}",
          file=sys.stderr)
    failures = 0
    for name, url in sampled:
        code = head_status(url)
        ok = code == 200
        failures += not ok
        print(f"  {'PASS' if ok else 'FAIL'}  {code}  {url}  ({name[:48]})")
    print(f"{len(sampled) - failures}/{len(sampled)} returned 200. Note: "
          "archive.org returns 200 for ANY /details/<id>[/page/nN] with a "
          "valid identifier — this catches malformed ids/paths, not wrong "
          "pages; page accuracy is the human spot-check (tools/CURATION.md).")
    return 1 if failures else 0


# --------------------------------------------------------------------------
# Selftest
# --------------------------------------------------------------------------

def cmd_selftest(_args: argparse.Namespace) -> int:
    failures: list[str] = []

    def check(label: str, ok: bool, detail: str = ""):
        print(f"  {'PASS' if ok else 'FAIL'}  {label}"
              + (f" ({detail})" if detail else ""), file=sys.stderr)
        if not ok:
            failures.append(label)

    print(f"selftest against {SELFTEST_ID}", file=sys.stderr)

    # Pure regex assertions (no network).
    check("index-line regex: leader dots",
          match_index_line("Apple  Strudel    ...  221") == ("Apple Strudel", "221"))
    check("index-line regex: spaced dots collapse",
          match_index_line("Boston Brown . . . . 98") == ("Boston Brown", "98"))
    check("index-line regex: rejects pure noise",
          match_index_line(". . , . . 42") is None)
    check("heading regex: RECIPE  INDEX", is_heading("RECIPE  INDEX "))
    check("heading regex: TABLE OF CONTENTS", is_heading("Table of Contents"))
    check("heading regex: rejects prose",
          not is_heading("the index finger of the cook"))
    check("heading kind distinguishes contents/index",
          (heading_kind("Table of Contents"), heading_kind("GENERAL INDEX"))
          == ("contents", "index"))

    # Extraction matchers (Escoffier-shaped cases, all seen in the wild).
    check("entry: comma form + recipe-number prefix",
          match_entry("300  Allumettes,  with  anchovies,  142")
          == ("Allumettes, with anchovies", "142"))
    check("entry: multi-page list takes first page",
          match_entry("Anchovies, fresh, 142, 261") == ("Anchovies, fresh", "142"))
    check("entry: comma form + trailing period (Boston 1918 index)",
          match_entry("Almond  Cakes,  511.") == ("Almond Cakes", "511"))
    check("entry: letter-suffixed recipe number stripped",
          match_entry("1583a  Ailerons  of  chicken,  507")
          == ("Ailerons of chicken", "507"))
    check("entry: '(v. gl.)' glossary marker stripped",
          match_entry("2299  Allumettes  (v.  gl.),  678") == ("Allumettes", "678"))
    check("entry: cross-references skipped",
          match_entry("Attereaux, see No. 1219") is None)
    check("entry: dotted contents line",
          match_entry("SOUPS  ..........      197") == ("SOUPS", "197"))
    check("chapter range: page maps into enclosing chapter",
          chapter_for(300, [("SOUPS", 197), ("FISH", 260), ("MEAT", 352)])
          == "FISH")
    check("chapter range: page before first chapter is None",
          chapter_for(10, [("SOUPS", 197)]) is None)
    synth = ("INDEX\n\n1755  Aiguillettes   of  Rouen  duck\n\n"
             "bigarrade,  558\n300 Allumettes, with anchovies, 142\n")
    regs = find_regions(synth.splitlines())
    parsed = parse_recipe_region(synth.splitlines(), regs[0]) if regs else []
    check("wrapped index entries join across lines",
          parsed == [("Aiguillettes of Rouen duck bigarrade", "558"),
                     ("Allumettes, with anchovies", "142")], str(parsed))

    # Name-based classifier (pins meal-role decisions for hierarchical-index
    # books; see classify_name / is_fragment).
    def clf(name):
        return classify_name(name)[0]

    check("classify: dessert head noun", clf("Chocolate Cake") == "Desserts")
    check("classify: soup head noun", clf("Tomato Soup") == "Soups & Stews")
    check("classify: inverted name resolves on head before comma",
          clf("Cake, Rice") == "Desserts", str(classify_name("Cake, Rice")))
    check("classify: inverted soup", clf("Soup, Tomato") == "Soups & Stews")
    check("classify: pie disambiguates by qualifier",
          (clf("Apple Pie"), clf("Chicken Pie")) == ("Desserts", "Mains"),
          f'{clf("Apple Pie")}, {clf("Chicken Pie")}')
    check("classify: bare 'pie' low confidence",
          classify_name("Pie")[0] == "Desserts" and classify_name("Pie")[1] < 0.45,
          str(classify_name("Pie")))
    check("classify: OCR digit-accent recovered (Canap6s -> canapé)",
          classify_name("Algonquin Canap6s") == ("Sides", 0.7, ["appetizer"]),
          str(classify_name("Algonquin Canap6s")))
    check("classify: no dish signal -> None",
          classify_name("Russian") == (None, 0.0, []),
          str(classify_name("Russian")))
    check("is_fragment: leading preposition dropped",
          is_fragment("of Beef, Broiled") and is_fragment("and Rice Croquettes"))
    check("is_fragment: bare roman numeral dropped", is_fragment("III"))
    check("is_fragment: too short dropped", is_fragment("k"))
    check("is_fragment: real dish name kept",
          not is_fragment("Tomato Soup") and not is_fragment("Cake, Rice"))

    # Clean-subset split (witness P2P-007): final.csv ships only cat!=None AND
    # conf>=CLEAN_THRESHOLD; low-confidence + signal-free names are HELD; pure
    # fragments are DROPPED. classify_entry is the single decision seam.
    def verdict(name):
        return classify_entry({"name": name, "page": "1"})["verdict"]
    check("clean-subset: high-confidence dish ships to final.csv",
          verdict("Chocolate Cake") == "clean", verdict("Chocolate Cake"))
    check("clean-subset: low-confidence guess held ('Chocolate' -> Drinks 0.4)",
          verdict("Chocolate") == "held", verdict("Chocolate"))
    check("clean-subset: signal-free truncated qualifier held ('Russian')",
          verdict("Russian") == "held", verdict("Russian"))
    check("clean-subset: pure fragment dropped ('and Rice Croquettes')",
          verdict("and Rice Croquettes") == "dropped",
          verdict("and Rice Croquettes"))
    check("clean-subset: --threshold raises the ship bar",
          classify_entry({"name": "Hash", "page": "1"})["verdict"] == "clean"
          and classify_entry({"name": "Hash", "page": "1"},
                             threshold=0.6)["verdict"] == "held",
          str(classify_entry({"name": "Hash", "page": "1"})["confidence"]))
    check("clean-subset: lone one-word qualifier held above threshold ('Banana')",
          verdict("Banana") == "held", verdict("Banana"))
    check("clean-subset: real one-word dish ships ('Junket' -> Desserts 0.85)",
          verdict("Junket") == "clean", verdict("Junket"))
    check("clean-subset: multi-word tail match still ships ('Baked Apples')",
          verdict("Baked Apples") == "clean", verdict("Baked Apples"))
    check("clean-subset: bare dish-type label held ('Sauce', high conf)",
          verdict("Sauce") == "held" and verdict("Jelly") == "held",
          f'{verdict("Sauce")}/{verdict("Jelly")}')
    check("classify: 'Steak with Mushroom Sauce' is a Main, not a Sauce",
          clf("Porterhouse Steak with Mushroom Sauce") == "Mains",
          str(classify_name("Porterhouse Steak with Mushroom Sauce")))

    try:
        text = get_djvu_text(SELFTEST_ID)
        check("djvu.txt starts with 'Copyright'",
              text.lstrip("﻿ \n\r").startswith("Copyright"),
              repr(text[:20]))

        idx = detect_index(text)
        check("index detected", idx["found"],
              f"heading {idx['heading']!r} @ line {idx['heading_line']}, "
              f"{idx['n_lines']} lines")

        flat = get_page_map(SELFTEST_ID)
        printed = build_printed_map(flat)
        pos = printed.get("8")
        check("printed page 8 -> positional index 13", pos == 13, f"got {pos}")
        leaf = flat[13].get("leafNum") if len(flat) > 13 else None
        check("leafNum at index 13 is 14 (i.e. /page/n uses position, not leafNum)",
              leaf == 14, f"leafNum={leaf}")
        check("deep-link URL format",
              deep_link(SELFTEST_ID, 13)
              == f"https://archive.org/details/{SELFTEST_ID}/page/n13")
    except FetchError as e:
        check("network fetches", False, str(e))

    if failures:
        print(f"selftest FAILED ({len(failures)}): {failures}", file=sys.stderr)
        return 1
    print("selftest passed", file=sys.stderr)
    return 0


# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    p_triage = sub.add_parser("triage", help="scan candidates, write report")
    p_triage.add_argument("--max", type=int, default=150,
                          help="books to scan (top N by downloads, default 150)")
    p_triage.add_argument("--out", default=str(CURATION_DIR / "candidates.md"),
                          help="markdown report path (JSON written alongside)")
    p_triage.set_defaults(func=cmd_triage)

    p_extract = sub.add_parser(
        "extract", help="structure pass: draft.json + review.md for one book")
    p_extract.add_argument("identifier", help="archive.org item id")
    p_extract.add_argument("--out-dir", default=None,
                           help="default tools/curation/books/<id>/")
    p_extract.set_defaults(func=cmd_extract)

    p_classify = sub.add_parser(
        "classify", help="name-based meal-role classify draft.json -> "
        "final.csv + needs_review.csv + dropped.csv")
    p_classify.add_argument("identifier", help="archive.org item id")
    p_classify.add_argument(
        "--threshold", type=float, default=CLEAN_THRESHOLD,
        help="min confidence to SHIP an entry into final.csv (clean subset); "
             f"below this it is HELD in needs_review.csv (default {CLEAN_THRESHOLD})")
    p_classify.set_defaults(func=cmd_classify)

    p_apply = sub.add_parser(
        "apply", help="final.csv -> public/packs/<id>.json + catalog entry")
    p_apply.add_argument("identifier", help="archive.org item id")
    p_apply.add_argument("--book-tags", default=None,
                         help="comma-separated; default: 'Tags:' line in notes.md")
    p_apply.add_argument("--title", default=None,
                         help="override the metadata-derived book title")
    p_apply.add_argument("--author", default=None,
                         help="override the metadata-derived author")
    p_apply.add_argument("--country", default=None,
                         help="override the publisher-derived country code")
    p_apply.set_defaults(func=cmd_apply)

    p_verify = sub.add_parser(
        "verify-links", help="HEAD-check sampled entry URLs (rate-limited)")
    p_verify.add_argument("identifier", help="archive.org item id")
    p_verify.add_argument("--sample", type=int, default=8,
                          help="URLs to check (default 8)")
    p_verify.set_defaults(func=cmd_verify_links)

    p_self = sub.add_parser("selftest", help="known-book + parser assertions")
    p_self.set_defaults(func=cmd_selftest)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
