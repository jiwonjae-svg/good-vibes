#!/usr/bin/env python3
"""
Crawl Wikiquote pages: Motivational quotes, Positive thinking, Gratitude, etc.
- Uses mwclient (no BeautifulSoup/Scrapy)
- CC-BY-SA compliant: source field includes attribution URL
- Output: {quote, author, source}
"""
import json
import os
import re
import sys
import time

import mwclient

SITE_URL = "en.wikiquote.org"
USER_AGENT = "DailyGlow/1.0 (quote collection; mail@example.com)"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "wikiquote_raw.json")

# Pages and categories to crawl (CC-BY-SA)
PAGES = [
    "Motivation",
    "Positive thinking",
    "Gratitude",
    "Happiness",
    "Hope",
    "Optimism",
]
CATEGORIES = [
    "Motivational authors",
]


def parse_quotes_from_text(text: str, page_title: str) -> list[dict]:
    """Extract quotes and authors from wikitext."""
    results = []
    source = f"https://en.wikiquote.org/wiki/{page_title.replace(' ', '_')}"
    lines = text.split("\n")

    for line in lines:
        line = line.strip()
        if not line.startswith("*") and not line.startswith(":"):
            continue
        line = re.sub(r"^[\*:]+", "", line).strip()
        if not line or len(line) < 15:
            continue
        # "quote" — Author or "quote" - Author
        m = re.search(r'"([^"]+)"\s*[—\-]\s*(.+)$', line)
        if m:
            quote = m.group(1).strip()
            author = m.group(2).strip()
        else:
            m2 = re.search(r"^(.+?)\s*[—\-]\s*(.+)$", line)
            if m2:
                quote = m2.group(1).strip().strip('"')
                author = m2.group(2).strip()
            else:
                if '"' in line or len(line) > 300:
                    continue
                quote = line
                author = "Unknown"
        # Strip wiki markup
        quote = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", quote)
        quote = re.sub(r"\[\[([^\]]+)\]\]", r"\1", quote)
        quote = re.sub(r"'''?", "", quote)
        author = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", author)
        author = re.sub(r"\[\[([^\]]+)\]\]", r"\1", author)
        author = re.sub(r"'''?", "", author)
        if len(quote) < 20 or len(quote) > 500:
            continue
        results.append({"quote": quote, "author": author, "source": source})
    return results


def fetch_page_quotes(site: mwclient.Site, title: str) -> list[dict]:
    """Extract quotes from a single page."""
    try:
        page = site.pages[title]
        if not page.exists:
            return []
        text = page.text()
        return parse_quotes_from_text(text or "", title)
    except Exception as e:
        print(f"  Error fetching {title}: {e}", file=sys.stderr)
        return []


def fetch_category_pages(site: mwclient.Site, cat_name: str, limit: int = 30) -> list[dict]:
    """Extract quotes from pages in a category."""
    results = []
    try:
        cat = site.pages[f"Category:{cat_name}"]
        for i, page in enumerate(cat):
            if i >= limit:
                break
            if page.namespace != 0:
                continue
            quotes = fetch_page_quotes(site, page.name)
            results.extend(quotes)
            print(f"  {page.name}: {len(quotes)} quotes")
            time.sleep(0.3)
    except Exception as e:
        print(f"  Error category {cat_name}: {e}", file=sys.stderr)
    return results


def main():
    seen = set()
    all_quotes = []

    site = mwclient.Site(SITE_URL, clients_useragent=USER_AGENT)

    for title in PAGES:
        print(f"Fetching page: {title}")
        quotes = fetch_page_quotes(site, title)
        for q in quotes:
            key = (q["quote"].lower()[:80], q["author"].lower())
            if key not in seen:
                seen.add(key)
                all_quotes.append(q)
        print(f"  -> {len(quotes)} quotes")
        time.sleep(0.5)

    for cat in CATEGORIES:
        print(f"Fetching category: {cat}")
        quotes = fetch_category_pages(site, cat)
        for q in quotes:
            key = (q["quote"].lower()[:80], q["author"].lower())
            if key not in seen:
                seen.add(key)
                all_quotes.append(q)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(all_quotes, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(all_quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
