#!/usr/bin/env python3
"""curate_packs.py — archive.org content-pack TRIAGE pipeline (phase 1).

Scans public-domain cookbook candidates on archive.org and produces a ranked
report (tools/curation/candidates.md + candidates.json) for the owner to pick
pack sources from. Phase 2 (pack extraction / draft packs) is a separate step
and is NOT done here.

Subcommands:
  triage    Page through the archive.org search, score the top-N books by
            downloads, write candidates.md (human table) + candidates.json
            (machine data for phase 2).
  selftest  Run known-book assertions (calendarofdinner00neiluoft) and exit
            nonzero on failure.

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

Politeness: >=0.7 s between HTTP requests, a descriptive User-Agent, and
every fetch is cached under tools/curation/.cache/ so re-runs are free.

Stdlib only (Python 3.12): urllib, json, re, csv, time, argparse, pathlib.
"""

from __future__ import annotations

import argparse
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

# Known book used by the selftest.
SELFTEST_ID = "calendarofdinner00neiluoft"

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


def fetch(url: str, key: str, cap: int | None = None) -> bytes:
    """GET `url` (redirects followed), capped at `cap` bytes, cached by `key`."""
    path = _cache_path(key)
    if path.exists():
        return path.read_bytes()

    global _last_hit
    wait = REQUEST_GAP - (time.monotonic() - _last_hit)
    if wait > 0:
        time.sleep(wait)
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


def is_heading(line: str) -> bool:
    s = line.translate(_NOISE).strip(" .:-")
    if not (3 <= len(s) <= 45) or any(c.isdigit() for c in s):
        return False
    return bool(HEADING_RE.match(re.sub(r"[\s.:-]+", " ", s).strip()))


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

    p_self = sub.add_parser("selftest", help="known-book assertions")
    p_self.set_defaults(func=cmd_selftest)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
