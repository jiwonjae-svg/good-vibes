#!/usr/bin/env python3
"""Audit and fix category weights for all quotes using Grok API.

Issues fixed:
- Wrong categories (e.g. timeManagement for non-time-management quotes)
- Missing relevant categories
- Too few categories (should have 3-8 meaningful ones)
- Filler weight-1 categories that don't truly fit
- Incorrect weight values

Usage: python scripts/audit_category_weights.py <quotesClient|quotesServer> [--dry-run]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://api.x.ai/v1/chat/completions"
API_KEY = os.getenv("EXPO_PUBLIC_GROK_API_KEY")
MODEL = os.getenv("EXPO_PUBLIC_GROK_MODEL", "grok-4-1-fast-non-reasoning")
BATCH_SIZE = 5
DELAY_S = 0.8
SAVE_EVERY = 20

VALID_CATEGORIES = [
    # Life & Growth
    "life", "success", "failure", "effort", "patience", "challenge", "growth", "change",
    "dream", "goal", "passion", "courage", "determination", "persistence",
    "selfImprovement", "habit", "timeManagement", "focus", "productivity", "motivation",
    "positivity", "gratitude", "happiness", "satisfaction", "mindfulness", "innerSelf",
    "selfRespect", "confidence", "overcomingFear", "mistake", "regret", "choice",
    "destiny", "opportunity", "beginning", "ending", "journey", "reflection",
    "realization", "wisdom", "experience", "aging", "death", "meaningOfLife",
    "existence", "freedom",
    # Emotion & Relationship
    "love", "romance", "breakup", "friendship", "family", "parents", "children",
    "marriage", "loneliness", "comfort", "encouragement", "trust", "betrayal",
    "forgiveness", "jealousy", "anger", "sadness", "joy", "peace", "stress", "anxiety",
    "fear", "hope", "despair", "healing", "empathy", "communication", "relationship",
    "consideration", "respect", "devotion", "sacrifice", "trueLove", "selfLove",
    # Work & Business
    "work", "career", "startup", "leadership", "teamwork", "competition", "achievement",
    "money", "wealth", "investment", "workLifeBalance", "burnout", "rest", "dreamJob",
    "innovation", "crisis", "networking",
    # Nature & Philosophy
    "nature", "spring", "summer", "autumn", "winter", "sea", "mountain", "sky", "stars",
    "morning", "sunset", "travel", "adventure", "simplicity", "minimalism", "soul",
    "universe", "time", "eternity", "present", "youth", "health", "meditation",
    # Special
    "books", "study", "newYear", "truth", "art", "music", "writing", "creativity",
]

SYSTEM_PROMPT = f"""You are an expert at categorizing motivational and philosophical quotes. You will be given quotes with their current category assignments and weights, and you must evaluate and correct them.

VALID CATEGORIES (use ONLY these exact keys):
{", ".join(VALID_CATEGORIES)}

RULES:
1. Each quote should have 3-8 categories (no more, no fewer unless truly only 1-2 apply)
2. Weights are integers 1-10 where 10 = perfectly describes the quote's core theme
3. Primary theme(s) should be 8-10, secondary themes 5-7, tangentially related 3-4
4. Do NOT assign weight 1-2 as filler — only include categories that genuinely relate
5. "timeManagement" is about managing time/schedules/productivity, NOT about "time" in a philosophical sense. Use "time" category for philosophical concepts of time.
6. "youth" is about being young/youthful, NOT about learning or growth in general
7. Be precise: "friendship" vs "relationship" vs "love" have distinct meanings
8. Remove categories that don't genuinely fit the quote's meaning
9. Add missing categories that clearly fit

Return a JSON array of objects with "id" and "categories" (the corrected Record<string, number>).
Return ONLY the JSON array, no markdown fences, no explanation."""


def call_grok(messages: list[dict]) -> str:
    resp = requests.post(
        API_URL,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        json={"model": MODEL, "messages": messages, "temperature": 0.2},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def build_messages(batch: list[dict]) -> list[dict]:
    quotes_data = [
        {
            "id": q["id"],
            "quote": q["quote"],
            "author": q["author"],
            "currentCategories": q["categories"],
        }
        for q in batch
    ]
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(quotes_data)},
    ]


def parse_response(raw: str) -> list[dict]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Remove opening fence (```json or ```)
        cleaned = "\n".join(lines[1:])
        # Remove closing fence
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3].rstrip()
    return json.loads(cleaned)


def main() -> None:
    if not API_KEY:
        print("Missing EXPO_PUBLIC_GROK_API_KEY in .env", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Audit category weights using Grok API")
    parser.add_argument(
        "target",
        nargs="?",
        default="quotesClient",
        choices=["quotesClient", "quotesServer"],
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    file_path = Path(__file__).parent.parent / "data" / f"{args.target}.json"
    if not file_path.exists():
        print(f"File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    quotes = json.loads(file_path.read_text(encoding="utf-8"))
    print(f"Loaded {len(quotes)} quotes from {args.target}.json")
    print(f"Dry run: {args.dry_run}")

    batches = [quotes[i : i + BATCH_SIZE] for i in range(0, len(quotes), BATCH_SIZE)]
    total_fixed = 0
    total_unchanged = 0
    errors = 0

    for bi, batch in enumerate(batches):
        batch_num = bi + 1
        if batch_num % 10 == 0 or batch_num == 1 or batch_num == len(batches):
            print(f"Batch {batch_num}/{len(batches)} ({len(batch)} quotes)...")

        try:
            messages = build_messages(batch)
            raw = call_grok(messages)
            results = parse_response(raw)

            id_to_quote = {q["id"]: q for q in quotes}
            for result in results:
                quote = id_to_quote.get(result["id"])
                if not quote:
                    continue

                valid_cats = {
                    k: round(v)
                    for k, v in result["categories"].items()
                    if k in VALID_CATEGORIES
                    and isinstance(v, (int, float))
                    and 1 <= v <= 10
                }
                if not valid_cats:
                    continue

                old_str = json.dumps(quote["categories"], sort_keys=True)
                new_str = json.dumps(valid_cats, sort_keys=True)
                if old_str == new_str:
                    total_unchanged += 1
                else:
                    total_fixed += 1
                    if not args.dry_run:
                        quote["categories"] = valid_cats

        except Exception as e:
            print(f"  Error in batch {batch_num}: {e}", file=sys.stderr)
            errors += 1

        if not args.dry_run and batch_num % SAVE_EVERY == 0:
            file_path.write_text(
                json.dumps(quotes, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            print(f"[save at batch {batch_num}, {total_fixed} fixed so far]")

        if bi < len(batches) - 1:
            time.sleep(DELAY_S)

    if not args.dry_run:
        file_path.write_text(
            json.dumps(quotes, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    print(f"\nDone! {total_fixed} quotes updated, {total_unchanged} unchanged, {errors} errors.")
    print(f"File: {file_path}")


if __name__ == "__main__":
    main()
