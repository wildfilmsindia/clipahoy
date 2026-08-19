#!/usr/bin/env python3
"""
Turn a YouTube Studio video export (.xlsx) into the id list the backfill reads.

    python3 scripts/parse-studio-export.py "~/Downloads/Youtube Links.xlsx"
    npm run ingest -- --backfill

Why this exists: the uploads playlist caps at 20,000 items and search.list does
not expose a channel's back catalogue at all (AUDIT.md §A), so roughly a third
of the channel was undiscoverable through the API. Discovery was the only thing
blocked — given ids from the rights-holder's own export, videos.list returns
full snippets at 50 ids per quota unit.

Stdlib only (zipfile + ElementTree). An .xlsx is a zip of XML; adding an xlsx
package as a dependency for a task run once every few months is not worth it.

Writes two files, both gitignored as derived data:
  data/backfill/export-ids.jsonl   every id in the export
  data/backfill/missing-ids.jsonl  those not already in the crawl cache
"""

import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
LINK_RE = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "backfill")
CACHE = os.path.join(ROOT, "data", ".ingest-cache.jsonl")


def rows_from_sheet(path):
    """Stream the first worksheet as dicts of column-letter -> text."""
    with zipfile.ZipFile(path) as z:
        name = next(
            (n for n in z.namelist() if n.startswith("xl/worksheets/sheet")), None
        )
        if not name:
            sys.exit(f"No worksheet found inside {path}")
        with z.open(name) as f:
            for _, el in ET.iterparse(f, events=("end",)):
                if el.tag != NS + "row":
                    continue
                cells = {}
                for c in el.findall(NS + "c"):
                    ref = c.get("r") or ""
                    m = re.match(r"([A-Z]+)", ref)
                    # Inline strings first: Studio exports carry no sharedStrings.
                    t = c.find(NS + "is/" + NS + "t")
                    if t is None:
                        t = c.find(NS + "v")
                    cells[m.group(1) if m else ""] = (t.text or "") if t is not None else ""
                yield cells
                el.clear()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = os.path.expanduser(sys.argv[1])
    if not os.path.exists(src):
        sys.exit(f"No such file: {src}")

    rows = list(rows_from_sheet(src))
    if not rows:
        sys.exit("Export is empty")

    # Locate columns by header text rather than position — the export's column
    # order is not guaranteed between Studio versions.
    header = {k: (v or "").strip().lower() for k, v in rows[0].items()}
    col_id = next((k for k, v in header.items() if v in ("video id", "id")), None)
    col_title = next((k for k, v in header.items() if "title" in v), None)
    col_link = next((k for k, v in header.items() if "link" in v or "url" in v), None)
    if not col_id and not col_link:
        sys.exit(f"Could not find a Video ID or link column. Header: {rows[0]}")

    recs, bad, dupes = [], 0, 0
    seen = set()
    for r in rows[1:]:
        vid = (r.get(col_id) or "").strip() if col_id else ""
        if not ID_RE.match(vid):
            m = LINK_RE.search((r.get(col_link) or "")) if col_link else None
            vid = m.group(1) if m else ""
        if not ID_RE.match(vid):
            bad += 1
            continue
        if vid in seen:
            dupes += 1
            continue
        seen.add(vid)
        recs.append({"id": vid, "title": (r.get(col_title) or "").strip()})

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "export-ids.jsonl"), "w") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    known = set()
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    v = json.loads(line)["snippet"]["resourceId"]["videoId"]
                    known.add(v)
                except Exception:
                    pass

    missing = [r for r in recs if r["id"] not in known]
    with open(os.path.join(OUT_DIR, "missing-ids.jsonl"), "w") as f:
        for r in missing:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    gone = len(known - seen)
    print(f"export rows        {len(rows) - 1:,}")
    print(f"valid distinct ids {len(recs):,}   (unparseable {bad:,}, duplicate {dupes:,})")
    print(f"already cached     {len(recs) - len(missing):,}")
    print(f"NEW to fetch       {len(missing):,}   ~{-(-len(missing) // 50):,} quota units")
    print(f"cached, not listed {gone:,}   (deleted/private since the crawl)")
    print("\nwrote data/backfill/{export-ids,missing-ids}.jsonl")
    print("next: npm run ingest -- --backfill")


if __name__ == "__main__":
    main()
