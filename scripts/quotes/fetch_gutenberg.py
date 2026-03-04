#!/usr/bin/env python3
"""
Search Project Gutenberg for quotes/aphorisms/proverbs, parse plain text.
- Uses Gutendex API (unofficial)
- Public Domain (commercial use OK)
- Output: {quote, author, source}
"""
import json
import os
import re
import sys
import time

import requests

GUTENDEX = "https://gutendex.com/books"  # or https://api.gutendex.com/books
GUTENBERG_TEXT_BASE = "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "gutenberg_raw.json")
MAX_BOOKS = 15
MAX_QUOTES_PER_BOOK = 50


def get_plain_text_url(book: dict) -> str | None:
    """Return plain text URL for a book."""
    fmt = book.get("formats", {})
    for k, v in fmt.items():
        if "text/plain" in k and "utf-8" in k:
            return v
    for k, v in fmt.items():
        if "text/plain" in k:
            return v
    return None


def fetch_books_by_topic(topic: str, limit: int = 20) -> list[dict]:
    """Search Gutendex for books by topic."""
    results = []
    url = GUTENDEX
    params = {"topic": topic, "mime_type": "text/plain", "languages": "en"}
    try:
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for b in data.get("results", [])[:limit]:
            text_url = get_plain_text_url(b)
            if text_url:
                results.append({
                    "id": b.get("id"),
                    "title": ", ".join(b.get("title", [])) or "Unknown",
                    "authors": [a.get("name", "Unknown") for a in b.get("authors", [])],
                    "text_url": text_url,
                })
    except requests.RequestException as e:
        print(f"Gutendex error: {e}", file=sys.stderr)
    return results


def download_text(url: str) -> str:
    """Download plain text content."""
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        return r.text
    except requests.RequestException as e:
        print(f"  Download error: {e}", file=sys.stderr)
        return ""


def parse_quotes_from_text(text: str, book_title: str, author_name: str) -> list[dict]:
    """Extract quote-like sentences from text (heuristic)."""
    source = f"https://www.gutenberg.org/ (Project Gutenberg, Public Domain)"
    results = []
    # Remove Gutenberg header/footer (*** START / *** END)
    start_marker = "*** START"
    end_marker = "*** END"
    if start_marker in text:
        text = text.split(end_marker)[0]
    if end_marker in text:
        text = text.split(end_marker)[0]
    if start_marker in text:
        text = text.split(start_marker, 1)[-1]

    paragraphs = re.split(r"\n\s*\n", text)
    for p in paragraphs:
        p = p.strip()
        if not p or len(p) < 25 or len(p) > 350:
            continue
        # Normalize to single line
        line = " ".join(p.split())
        # Skip numbers-only, URLs, overly long
        if re.match(r"^[\d\s\.\-]+$", line):
            continue
        if "http" in line or "www." in line:
            continue
        # Citation format: "..." - Author or ... — Author
        quote = line
        author = author_name or "Unknown"
        m = re.search(r'^"([^"]+)"\s*[—\-]\s*(.+)$', line)
        if m:
            quote = m.group(1)
            author = m.group(2).strip()
        else:
            m2 = re.search(r"^(.+?)\s*[—\-]\s*(.+)$", line)
            if m2:
                quote = m2.group(1).strip().strip('"')
                author = m2.group(2).strip()
        if len(quote) < 20:
            continue
        results.append({"quote": quote, "author": author, "source": source})
    return results


def main():
    all_quotes = []
    seen = set()
    topics = ["quotes", "aphorisms", "proverbs", "maxims"]

    for topic in topics:
        print(f"Searching topic: {topic}")
        books = fetch_books_by_topic(topic, limit=MAX_BOOKS // len(topics) + 5)
        for b in books:
            print(f"  Fetching: {b['title'][:50]}...")
            text = download_text(b["text_url"])
            author_name = b["authors"][0] if b["authors"] else "Unknown"
            quotes = parse_quotes_from_text(text, b["title"], author_name)[:MAX_QUOTES_PER_BOOK]
            for q in quotes:
                key = (q["quote"].lower()[:80], q["author"].lower())
                if key not in seen:
                    seen.add(key)
                    all_quotes.append(q)
            print(f"    -> {len(quotes)} quotes")
            time.sleep(1)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_quotes, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(all_quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
