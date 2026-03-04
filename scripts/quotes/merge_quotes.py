#!/usr/bin/env python3
"""
Merge raw JSON files, deduplicate, output final JSON.
Format: [{quote, author, source}, ...]
"""
import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
OUTPUT = os.path.join(DATA_DIR, "quotes_merged.json")

FILES = ["quotable_raw.json", "wikiquote_raw.json", "gutenberg_raw.json"]


def main():
    seen = set()
    merged = []
    for fname in FILES:
        path = os.path.join(DATA_DIR, fname)
        if not os.path.exists(path):
            print(f"Skip (not found): {path}", file=sys.stderr)
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            q = (item.get("quote") or "").strip()
            a = (item.get("author") or "Unknown").strip()
            s = (item.get("source") or "").strip()
            if not q:
                continue
            key = (q.lower()[:120], a.lower())
            if key in seen:
                continue
            seen.add(key)
            merged.append({"quote": q, "author": a, "source": s})
        print(f"Loaded {len(data)} from {fname}")
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"Merged {len(merged)} unique quotes -> {OUTPUT}")


if __name__ == "__main__":
    main()
