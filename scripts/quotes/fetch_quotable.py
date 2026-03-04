#!/usr/bin/env python3
"""
Quotable API에서 모든 명언을 가져와 JSON으로 저장.
- 중복 제거
- quote, author, source만 출력
- 출처: https://github.com/lukePeavey/quotable (MIT)
"""
import json
import os
import sys
import time
import urllib3

import requests

# SSL 인증서 만료 등 환경 이슈 시 재시도용
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://api.quotable.io"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "quotable_raw.json")


def _get_session(verify_ssl: bool = True) -> requests.Session:
    s = requests.Session()
    s.verify = verify_ssl
    return s


def fetch_all_quotes():
    seen = set()
    results = []
    page = 1
    limit = 150  # API max per request
    verify = True

    while True:
        url = f"{BASE_URL}/quotes"
        params = {"limit": limit, "page": page}
        try:
            r = requests.get(url, params=params, timeout=30, verify=verify)
            r.raise_for_status()
        except requests.exceptions.SSLError as e:
            if verify:
                print("SSL verification failed, retrying without verify...", file=sys.stderr)
                verify = False
                continue
            print(f"Request error: {e}", file=sys.stderr)
            break
        except requests.RequestException as e:
            print(f"Request error: {e}", file=sys.stderr)
            break

        data = r.json()
        items = data.get("results", [])
        total_count = data.get("totalCount", 0)

        for item in items:
            content = (item.get("content") or "").strip()
            author = (item.get("author") or "Unknown").strip()
            if not content:
                continue
            key = (content.lower()[:100], author.lower())
            if key in seen:
                continue
            seen.add(key)
            results.append({
                "quote": content,
                "author": author,
                "source": "quotable",
            })

        print(f"Page {page}: fetched {len(items)}, total collected {len(results)}/{total_count}")
        if not items or len(results) >= total_count:
            break
        page += 1
        time.sleep(0.5)

    return results


def main():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    quotes = fetch_all_quotes()
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(quotes, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(quotes)} quotes to {OUTPUT}")


if __name__ == "__main__":
    main()
