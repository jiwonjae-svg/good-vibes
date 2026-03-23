#!/usr/bin/env python3
"""
Quotes pipeline using Gemini API — Victor Lin (Data Lead) & Elena Rossi (Data Engineer)

Steps:
  1. Fetch ALL quotes from Quotable API (all pages, deduplicated).
  2. Deduplicate against existing quotesClient.json + quotesServer.json.
  3. For each new quote, call Gemini to:
       - Generate 5-language translations (en/ko/ja/zh/es)
       - Assign category weights
  4. Append new quotes to quotesServer.json with new sequential IDs.

Usage:
  pip install google-generativeai requests tqdm
  python scripts/quotes/fetch_and_translate_gemini.py

Requires in .env:
  EXPO_PUBLIC_GEMINI_API_KEY=...
  EXPO_PUBLIC_GEMINI_MODEL=gemini-3-flash-preview   (or gemini-1.5-flash-latest)
"""

import json
import os
import re
import sys
import time
import urllib3
from pathlib import Path

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    from google import genai
    from google.genai import types as gentypes
    from tqdm import tqdm
except ImportError:
    print("Installing required packages...")
    import os
    os.system(f"{sys.executable} -m pip install google-genai tqdm requests -q")
    from google import genai
    from google.genai import types as gentypes
    from tqdm import tqdm

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent.parent
CLIENT_JSON  = BASE_DIR / "data" / "quotesClient.json"
SERVER_JSON  = BASE_DIR / "data" / "quotesServer.json"

QUOTABLE_BASE = "https://api.quotable.io"
LIMIT_PER_PAGE = 150  # Quotable max

# Load Gemini key from env or .env
GEMINI_KEY   = os.environ.get("EXPO_PUBLIC_GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("EXPO_PUBLIC_GEMINI_MODEL", "gemini-1.5-flash-latest")

if not GEMINI_KEY:
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("EXPO_PUBLIC_GEMINI_API_KEY="):
                GEMINI_KEY = line.split("=", 1)[1].strip()
            if line.startswith("EXPO_PUBLIC_GEMINI_MODEL="):
                GEMINI_MODEL = line.split("=", 1)[1].strip()

if not GEMINI_KEY:
    print("ERROR: EXPO_PUBLIC_GEMINI_API_KEY not found in environment or .env")
    sys.exit(1)

genai_client = genai.Client(api_key=GEMINI_KEY)

# All valid categories (must match data/categories.ts keys)
ALL_CATEGORIES = [
    "life", "success", "happiness", "wisdom", "love", "friendship",
    "courage", "perseverance", "motivation", "growth", "failure",
    "mindfulness", "simplicity", "change", "kindness", "creativity",
    "leadership", "time", "work", "health", "family", "faith",
    "freedom", "art", "education", "truth", "nature", "humor",
    "gratitude", "peace", "discipline", "ambition", "integrity",
    "purpose", "resilience", "effort", "achievement", "journey",
    "determination", "encouragement",
]

# ---------------------------------------------------------------------------
# Step 1: Fetch all quotes from Quotable API
# ---------------------------------------------------------------------------

def fetch_quotable_all() -> list[dict]:
    """Returns list of {quote, author, source:'quotable'}"""
    seen: set[tuple] = set()
    results: list[dict] = []
    page = 1
    verify = True

    while True:
        try:
            r = requests.get(
                f"{QUOTABLE_BASE}/quotes",
                params={"limit": LIMIT_PER_PAGE, "page": page},
                timeout=30,
                verify=verify,
            )
            r.raise_for_status()
        except requests.exceptions.SSLError:
            if verify:
                print("SSL error, retrying without verify...", file=sys.stderr)
                verify = False
                continue
            break
        except requests.RequestException as e:
            print(f"Request error on page {page}: {e}", file=sys.stderr)
            break

        data = r.json()
        items = data.get("results", [])
        total = data.get("totalCount", 0)

        for item in items:
            content = (item.get("content") or "").strip()
            author  = (item.get("author")  or "Unknown").strip()
            if not content:
                continue
            key = (content.lower()[:100], author.lower())
            if key in seen:
                continue
            seen.add(key)
            results.append({"quote": content, "author": author, "source": "quotable"})

        print(f"Page {page}: {len(items)} items | collected {len(results)}/{total}")
        if not items or len(results) >= total:
            break
        page += 1
        time.sleep(0.3)

    return results


# ---------------------------------------------------------------------------
# Step 2: Deduplicate against existing JSON files
# ---------------------------------------------------------------------------

def build_existing_keys(quotes: list[dict]) -> set[tuple]:
    keys: set[tuple] = set()
    for q in quotes:
        text   = (q.get("quote") or "").strip().lower()[:100]
        author = (q.get("author") or "").strip().lower()
        keys.add((text, author))
        # Also index English translation if present
        en = ((q.get("translations") or {}).get("en") or "").strip().lower()[:100]
        if en:
            keys.add((en, author))
    return keys


def deduplicate(new_quotes: list[dict], existing_keys: set[tuple]) -> list[dict]:
    fresh: list[dict] = []
    for q in new_quotes:
        key = (q["quote"].lower()[:100], q["author"].lower())
        if key not in existing_keys:
            fresh.append(q)
    print(f"  After deduplication: {len(fresh)} new quotes (from {len(new_quotes)} fetched)")
    return fresh


# ---------------------------------------------------------------------------
# Step 3: Gemini — translate + categorise
# ---------------------------------------------------------------------------

TRANSLATE_PROMPT = """You are a professional multilingual literary translator and quote curator.

Given this English quote by {author}:
\"{quote}\"

Produce a JSON object with these exact keys:
{{
  "translations": {{
    "en": "<the original English quote, unchanged>",
    "ko": "<formal polite Korean translation; 합쇼체, -ㅂ니다/-습니다 endings; complete, no omissions>",
    "ja": "<formal polite Japanese translation; です/ます style; complete>",
    "zh": "<Traditional Chinese translation; 繁體字; complete>",
    "es": "<natural literary Spanish translation; complete>"
  }},
  "categories": {{
    "<category_name>": <weight 1-10>,
    ...
  }}
}}

Rules for categories:
- Choose 3-6 most relevant categories from this list ONLY:
  {categories}
- Assign weight 10 to the single best-fit category, then 9, 8, 7... for others.
- Do NOT invent new categories.

Output ONLY valid JSON. No markdown fences, no explanation."""


def translate_and_categorise(quote: str, author: str, retries: int = 3) -> dict | None:
    prompt = TRANSLATE_PROMPT.format(
        author=author,
        quote=quote,
        categories=", ".join(ALL_CATEGORIES),
    )
    for attempt in range(retries):
        try:
            response = genai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=gentypes.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4096,
                    response_mime_type="application/json",
                ),
            )
            raw = response.text.strip()
            # Strip optional markdown fences in case model ignores mime type
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            parsed = json.loads(raw)
            return parsed
        except json.JSONDecodeError as e:
            print(f"  [WARN] JSON parse error (attempt {attempt + 1}): {e}")
        except Exception as e:
            print(f"  [WARN] Gemini error (attempt {attempt + 1}): {e}")
        if attempt < retries - 1:
            time.sleep(2 ** attempt)
    return None


# ---------------------------------------------------------------------------
# Step 4: Main
# ---------------------------------------------------------------------------

def load_json(path: Path) -> list[dict]:
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return []


def main() -> None:
    print("=" * 60)
    print("DailyGlow — Quotable fetch & Gemini translate pipeline")
    print("  Workers: Victor Lin (Data Lead), Elena Rossi (Data Engineer)")
    print("=" * 60)

    # Load existing quotes
    print("\n[1] Loading existing quotes...")
    client_quotes = load_json(CLIENT_JSON)
    server_quotes = load_json(SERVER_JSON)
    existing_all  = client_quotes + server_quotes
    existing_keys = build_existing_keys(existing_all)
    print(f"  Existing: {len(existing_all)} quotes (client: {len(client_quotes)}, server: {len(server_quotes)})")

    # Next ID offset
    max_id = -1
    for q in existing_all:
        m = re.match(r"q_(\d+)", q.get("id", ""))
        if m:
            max_id = max(max_id, int(m.group(1)))
    next_id = max_id + 1
    print(f"  Next quote ID will be: q_{next_id}")

    # Fetch from Quotable
    print("\n[2] Fetching all quotes from Quotable API...")
    raw_quotes = fetch_quotable_all()
    print(f"  Fetched: {len(raw_quotes)}")

    # Deduplicate
    print("\n[3] Deduplicating...")
    fresh_quotes = deduplicate(raw_quotes, existing_keys)

    if not fresh_quotes:
        print("\nNo new quotes to process. Exiting.")
        return

    # Translate + categorise via Gemini
    print(f"\n[4] Translating {len(fresh_quotes)} new quotes via Gemini ({GEMINI_MODEL})...")
    enriched: list[dict] = []
    failed: list[dict] = []

    for q in tqdm(fresh_quotes, unit="quote"):
        result = translate_and_categorise(q["quote"], q["author"])
        if result is None:
            failed.append(q)
            continue

        new_quote = {
            "id": f"q_{next_id}",
            "quote": q["quote"],
            "author": q["author"],
            "source": q["source"],
            "categories": result.get("categories", {}),
            "translations": result.get("translations", {}),
        }
        # Ensure English translation is always the original
        if "translations" not in new_quote or not isinstance(new_quote["translations"], dict):
            new_quote["translations"] = {}
        new_quote["translations"]["en"] = q["quote"]

        enriched.append(new_quote)
        next_id += 1
        time.sleep(0.1)  # brief rate-limit buffer

    print(f"\n  Successfully enriched: {len(enriched)}")
    print(f"  Failed (kept original, not added): {len(failed)}")

    # Append to quotesServer.json
    print("\n[5] Appending to quotesServer.json...")
    updated_server = server_quotes + enriched
    with open(SERVER_JSON, "w", encoding="utf-8") as f:
        json.dump(updated_server, f, ensure_ascii=False, indent=2)
    print(f"  quotesServer.json: {len(server_quotes)} → {len(updated_server)} quotes")

    if failed:
        failed_path = BASE_DIR / "data" / "quotable_failed.json"
        with open(failed_path, "w", encoding="utf-8") as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
        print(f"  Failed quotes saved to: {failed_path}")

    print("\nDone. Next step: python scripts/audit_and_fix_quotes.py (Gemini version)")
    print("       Then:     node scripts/upload-quotes-firebase.js")


if __name__ == "__main__":
    main()
