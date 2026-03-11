#!/usr/bin/env python3
"""
Comprehensive quote audit and fix script.

Performs:
1. Removes politically/religiously sensitive quotes from living politicians/religious leaders
2. Detects and re-translates truncated/missing/wrong Korean, Japanese, Chinese translations
3. Normalises Korean to formal polite style (합쇼체, -ㅂ니다/-습니다 register)
4. Re-assigns sequential IDs (q_0, q_1, …)
5. Splits output back into quotesClient.json + quotesServer.json
6. Produces docs/QUOTE-AUDIT-REPORT.md with a full change log

Requirements: pip install openai tqdm
Usage: python scripts/audit_and_fix_quotes.py
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

try:
    from openai import OpenAI
    from tqdm import tqdm
except ImportError:
    print("Installing required packages...")
    os.system(f"{sys.executable} -m pip install openai tqdm -q")
    from openai import OpenAI
    from tqdm import tqdm

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent
CLIENT_JSON = BASE_DIR / "data" / "quotesClient.json"
SERVER_JSON = BASE_DIR / "data" / "quotesServer.json"
DOCS_DIR = BASE_DIR / "docs"
REPORT_PATH = DOCS_DIR / "QUOTE-AUDIT-REPORT.md"

# Grok API setup (xAI – OpenAI-compatible)
API_KEY = os.environ.get("EXPO_PUBLIC_GROK_API_KEY", "")
MODEL = os.environ.get("EXPO_PUBLIC_GROK_MODEL", "grok-3-mini-fast")
BASE_URL = "https://api.x.ai/v1"

# Load .env manually if key is empty
if not API_KEY:
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("EXPO_PUBLIC_GROK_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip()
            if line.startswith("EXPO_PUBLIC_GROK_MODEL="):
                MODEL = line.split("=", 1)[1].strip()

if not API_KEY:
    print("ERROR: EXPO_PUBLIC_GROK_API_KEY not found in environment or .env")
    sys.exit(1)

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# ---------------------------------------------------------------------------
# SENSITIVITY LIST
# Living politicians (as of 2026) + religious leaders with religious content
# ---------------------------------------------------------------------------
# Rules:
#   - (author_pattern, reason, delete_all | keyword_required)
#   - delete_all=True  → always remove regardless of quote content
#   - delete_all=False → only remove if quote contains political/religious keywords
SENSITIVITY_RULES: list[dict] = [
    # Living politicians – all quotes from them are politically charged
    {"pattern": r"^Donald Trump$",        "reason": "현직 정치인(미 대통령)",          "delete_all": False, "keywords": r"america|great|wall|democrat|republican|election|border|deal|win|politi|democra|war|nato|china|tariff"},
    {"pattern": r"^Joe Biden$",           "reason": "현직 정치인(전 미 대통령)",        "delete_all": False, "keywords": r"america|democra|republican|senate|congress|politi|nation|united states|president"},
    {"pattern": r"^Barack Obama$",        "reason": "전 미 대통령 정치 발언",           "delete_all": False, "keywords": r"politi|democra|republican|congress|senate|nation|america|president|party|law|government|bill|vote|election|change we seek|waiting for"},
    {"pattern": r"^Michelle Obama$",      "reason": "전 미 대통령 배우자 정치 발언",     "delete_all": False, "keywords": r"bill|congress|senate|politi|nation|president|democra|republican|vote|election|barack"},
    {"pattern": r"^Vladimir Putin$",      "reason": "현직 정치인(러시아 대통령)",       "delete_all": True,  "keywords": ""},
    {"pattern": r"^Xi Jinping$",          "reason": "현직 정치인(중국 주석)",           "delete_all": True,  "keywords": ""},
    {"pattern": r"^Kim Jong.un$",         "reason": "현직 정치인(북한 국무위원장)",      "delete_all": True,  "keywords": ""},
    {"pattern": r"^Emmanuel Macron$",     "reason": "현직 정치인(프랑스 대통령)",       "delete_all": False, "keywords": r"politi|europe|nation|government|republic|party|democra"},
    {"pattern": r"^Volodymyr Zelensky$",  "reason": "현직 정치인(우크라이나 대통령)",    "delete_all": True,  "keywords": ""},
    # Religious leaders – only quotes with explicit religious content
    {"pattern": r"^Pope Francis$",        "reason": "종교 지도자 종교적 발언",          "delete_all": False, "keywords": r"god|jesus|christ|church|faith|pray|sin|heaven|blessed|holy|gospel|lord|divine|soul|salvation|grace"},
    {"pattern": r"^Dalai Lama$",          "reason": "종교 지도자 종교적 발언",          "delete_all": False, "keywords": r"temple|buddhis|dharma|karma|nirvana|pray|religion|god|faith|holy|sacred|monk|meditation.*buddhis"},
    {"pattern": r"^The Buddha$",          "reason": "종교 설립자 종교적 발언",          "delete_all": False, "keywords": r"nirvana|dharma|buddhis|rebirth|enlightenment.*buddha|monk|pray|temple|sacred"},
    {"pattern": r"^Pope John Paul",       "reason": "종교 지도자 종교적 발언",          "delete_all": False, "keywords": r"god|jesus|christ|church|faith|pray|sin|heaven|blessed|holy|gospel|lord|divine|soul"},
    {"pattern": r"^Ayatollah",            "reason": "이슬람 종교 지도자",              "delete_all": True,  "keywords": ""},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
HAS_KOREAN = re.compile(r"[가-힣]")
HAS_JAPANESE = re.compile(r"[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbf]")
HAS_CHINESE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
INFORMAL_KO = re.compile(r"(?<![습])했다[.。\s]*$|(?<![습])됐다[.。\s]*$|(?<![습])였다[.。\s]*$|(?<![습])이다[.。\s]*$|(?<![습])한다[.。\s]*$")
FORMAL_KO = re.compile(r"입니다[.。\s]*$|습니다[.。\s]*$|합니다[.。\s]*$|세요[.。\s]*$")

def is_truncated(en: str, ko: str) -> bool:
    """Flag if Korean looks seriously truncated relative to English."""
    if not en or not ko:
        return False
    # Korean is morphologically compact – a typical ratio is 0.5-0.9
    # Flag anything below 0.35 when the English sentence is at least 80 chars
    if len(en) < 80:
        return False
    ratio = len(ko) / len(en)
    # Also flag if English has multiple sentences but Korean has far fewer
    en_sentences = len(re.findall(r"[.!?]+", en))
    ko_sentences = len(re.findall(r"[.!?。！？]+", ko))
    multi_sentence_missing = en_sentences >= 2 and ko_sentences < en_sentences and ratio < 0.45
    return ratio < 0.35 or multi_sentence_missing

def is_untranslated(en: str, translation: str, lang: str) -> bool:
    if not translation:
        return True
    if translation.strip() == en.strip():
        return True
    if lang == "ko" and not HAS_KOREAN.search(translation):
        return True
    if lang == "ja" and not HAS_JAPANESE.search(translation):
        return True
    if lang == "zh" and not HAS_CHINESE.search(translation):
        return True
    return False

def is_informal_korean(ko: str) -> bool:
    return bool(INFORMAL_KO.search(ko)) and not FORMAL_KO.search(ko)

def should_delete(quote: dict) -> tuple[bool, str]:
    """Return (should_delete, reason) based on sensitivity rules."""
    author = (quote.get("author") or "").strip()
    text = (quote.get("quote") or "").lower()
    for rule in SENSITIVITY_RULES:
        if re.search(rule["pattern"], author, re.IGNORECASE):
            if rule["delete_all"]:
                return True, rule["reason"]
            if rule["keywords"] and re.search(rule["keywords"], text, re.IGNORECASE):
                return True, rule["reason"]
    return False, ""

def needs_retranslation(quote: dict) -> dict[str, list[str]]:
    """Return mapping lang -> list of issue strings for all langs needing re-work."""
    en = (quote.get("translations") or {}).get("en") or quote.get("quote", "")
    t = quote.get("translations") or {}
    issues: dict[str, list[str]] = {}

    for lang in ("ko", "ja", "zh", "es"):
        tr = t.get(lang, "")
        lang_issues: list[str] = []

        if is_untranslated(en, tr, lang):
            lang_issues.append("untranslated")
        elif lang == "ko" and is_truncated(en, tr):
            lang_issues.append("truncated")
        elif lang == "ko" and is_informal_korean(tr):
            lang_issues.append("informal_style")

        if lang_issues:
            issues[lang] = lang_issues

    return issues

# ---------------------------------------------------------------------------
# Retranslation via Grok
# ---------------------------------------------------------------------------
LANG_NAMES = {"ko": "Korean", "ja": "Japanese", "zh": "Traditional Chinese", "es": "Spanish"}
STYLE_NOTES = {
    "ko": (
        "Use formal polite Korean (합쇼체, -ㅂ니다/-습니다 endings). "
        "Translate the COMPLETE original sentence(s) faithfully without omitting any part. "
        "Keep the literary, motivational tone. "
        "Output ONLY the Korean translation, no explanation."
    ),
    "ja": (
        "Use formal polite Japanese (です/ます style). "
        "Translate the COMPLETE original sentence(s) faithfully. "
        "Output ONLY the Japanese translation, no explanation."
    ),
    "zh": (
        "Use Traditional Chinese (繁體字). "
        "Translate the COMPLETE original sentence(s) faithfully. "
        "Output ONLY the Traditional Chinese translation, no explanation."
    ),
    "es": (
        "Use natural, literary Spanish. "
        "Translate the COMPLETE original sentence(s) faithfully without omitting any part. "
        "Keep the motivational, poetic tone. "
        "Output ONLY the Spanish translation, no explanation."
    ),
}

def retranslate(quote_text: str, author: str, lang: str, current: str, issues: list[str]) -> str:
    """Call Grok to produce a corrected translation."""
    issue_desc = ", ".join(issues)
    prompt = (
        f"You are a professional literary translator. "
        f"The following English quote by {author} has a problem in its {LANG_NAMES[lang]} translation: {issue_desc}.\n\n"
        f"Original (English): {quote_text}\n"
        f"Current {LANG_NAMES[lang]} translation (problematic): {current}\n\n"
        f"Please provide a corrected {LANG_NAMES[lang]} translation.\n"
        f"{STYLE_NOTES[lang]}"
    )
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            if attempt == 2:
                print(f"  [WARN] Grok failed after 3 attempts: {e}")
                return current
            time.sleep(2 ** attempt)
    return current

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    print("Loading quote files...")
    with open(CLIENT_JSON, encoding="utf-8") as f:
        client_quotes: list[dict] = json.load(f)
    with open(SERVER_JSON, encoding="utf-8") as f:
        server_quotes: list[dict] = json.load(f)

    all_quotes: list[dict] = client_quotes + server_quotes
    print(f"Total quotes: {len(all_quotes)} (client: {len(client_quotes)}, server: {len(server_quotes)})")

    # -----------------------------------------------------------------------
    # Phase 1: Identify quotes to delete
    # -----------------------------------------------------------------------
    print("\n=== Phase 1: Sensitivity check ===")
    deleted_log: list[dict] = []
    kept_quotes: list[dict] = []

    for q in all_quotes:
        delete, reason = should_delete(q)
        if delete:
            deleted_log.append({
                "id": q["id"],
                "author": q.get("author", ""),
                "quote": q.get("quote", "")[:120],
                "reason": reason,
            })
            print(f"  DELETE [{q['id']}] {q.get('author','')} – {reason}")
        else:
            kept_quotes.append(q)

    print(f"  Deleted: {len(deleted_log)}, Remaining: {len(kept_quotes)}")

    # -----------------------------------------------------------------------
    # Phase 2: Audit translations and collect re-translation jobs
    # -----------------------------------------------------------------------
    print("\n=== Phase 2: Translation audit ===")
    translation_log: list[dict] = []
    jobs: list[tuple[int, str, list[str]]] = []   # (index_in_kept, lang, issues)

    for i, q in enumerate(kept_quotes):
        lang_issues = needs_retranslation(q)
        if lang_issues:
            for lang, issues in lang_issues.items():
                jobs.append((i, lang, issues))
                translation_log.append({
                    "id": q["id"],
                    "author": q.get("author", ""),
                    "quote": q.get("quote", "")[:120],
                    "lang": lang,
                    "issues": issues,
                    "original_translation": ((q.get("translations") or {}).get(lang) or ""),
                    "new_translation": None,
                })

    print(f"  Translation issues found: {len(jobs)} (across {len(set(j[0] for j in jobs))} quotes)")

    # -----------------------------------------------------------------------
    # Phase 3: Re-translate (batch, with progress)
    # -----------------------------------------------------------------------
    if jobs:
        print(f"\n=== Phase 3: Re-translating {len(jobs)} items via Grok ===")
        log_idx = 0
        for idx_in_kept, lang, issues in tqdm(jobs, unit="item"):
            q = kept_quotes[idx_in_kept]
            en = (q.get("translations") or {}).get("en") or q.get("quote", "")
            current = (q.get("translations") or {}).get(lang, "")
            new_tr = retranslate(en, q.get("author", "Unknown"), lang, current, issues)

            # Update the quote in-place
            if "translations" not in q or q["translations"] is None:
                q["translations"] = {}
            q["translations"][lang] = new_tr

            # Update log
            translation_log[log_idx]["new_translation"] = new_tr
            log_idx += 1
    else:
        print("\n=== Phase 3: No re-translation needed ===")

    # -----------------------------------------------------------------------
    # Phase 4: Re-assign sequential IDs
    # -----------------------------------------------------------------------
    print("\n=== Phase 4: Reassigning IDs ===")
    old_to_new: dict[str, str] = {}
    for new_idx, q in enumerate(kept_quotes):
        new_id = f"q_{new_idx}"
        old_to_new[q["id"]] = new_id
        q["id"] = new_id
    print(f"  IDs reassigned: q_0 … q_{len(kept_quotes)-1}")

    # -----------------------------------------------------------------------
    # Phase 5: Split back into client / server (maintain ~31% / 69% split)
    # -----------------------------------------------------------------------
    print("\n=== Phase 5: Splitting into client / server files ===")
    total = len(kept_quotes)
    client_count = round(total * 0.32)  # approx 32% in client
    new_client = kept_quotes[:client_count]
    new_server = kept_quotes[client_count:]
    print(f"  Client: {len(new_client)} quotes (q_0 … q_{client_count-1})")
    print(f"  Server: {len(new_server)} quotes (q_{client_count} … q_{total-1})")

    # -----------------------------------------------------------------------
    # Phase 6: Write output files
    # -----------------------------------------------------------------------
    print("\n=== Phase 6: Writing output files ===")
    with open(CLIENT_JSON, "w", encoding="utf-8") as f:
        json.dump(new_client, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {CLIENT_JSON}")

    with open(SERVER_JSON, "w", encoding="utf-8") as f:
        json.dump(new_server, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {SERVER_JSON}")

    # -----------------------------------------------------------------------
    # Phase 7: Generate MD report
    # -----------------------------------------------------------------------
    print("\n=== Phase 7: Generating audit report ===")
    DOCS_DIR.mkdir(exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("# 명언 데이터 감사 및 수정 보고서\n\n")
        f.write(f"> 생성일: {time.strftime('%Y-%m-%d %H:%M:%S (KST)')}\n\n")
        f.write("---\n\n")

        # Summary
        f.write("## 요약\n\n")
        f.write(f"| 항목 | 수치 |\n|------|------|\n")
        f.write(f"| 원본 명언 수 | {len(all_quotes)} |\n")
        f.write(f"| 삭제된 명언 수 (민감 콘텐츠) | {len(deleted_log)} |\n")
        f.write(f"| 번역 수정 횟수 | {len(translation_log)} |\n")
        f.write(f"| 최종 명언 수 | {len(kept_quotes)} |\n")
        f.write(f"| 최종 클라이언트 배포 수 | {len(new_client)} |\n")
        f.write(f"| 최종 서버 배포 수 | {len(new_server)} |\n\n")

        # ID mapping note
        f.write("## ID 재부여\n\n")
        f.write("삭제 및 정리 후 전체 명언의 ID를 순차적으로 재부여하였습니다.\n\n")
        f.write("```\n")
        f.write("이전 ID → 새 ID (처음 20건)\n")
        for old, new in list(old_to_new.items())[:20]:
            f.write(f"  {old} → {new}\n")
        if len(old_to_new) > 20:
            f.write(f"  ... (총 {len(old_to_new)}건)\n")
        f.write("```\n\n")

        # Deleted quotes
        f.write("## 삭제된 명언 목록\n\n")
        if deleted_log:
            f.write("| 이전 ID | 저자 | 삭제 사유 | 원문 (처음 120자) |\n")
            f.write("|---------|------|-----------|-------------------|\n")
            for d in deleted_log:
                quote_safe = d["quote"].replace("|", "\\|")
                f.write(f"| {d['id']} | {d['author']} | {d['reason']} | {quote_safe} |\n")
        else:
            f.write("삭제된 명언 없음.\n")
        f.write("\n")

        # Translation fixes
        f.write("## 번역 수정 목록\n\n")
        if translation_log:
            for entry in translation_log:
                f.write(f"### [{entry['id']} → {old_to_new.get(entry['id'], '?')}] {entry['author']}\n\n")
                f.write(f"**원문 (EN):** {entry['quote']}\n\n")
                f.write(f"**언어:** `{entry['lang']}` | **문제:** {', '.join(entry['issues'])}\n\n")
                orig = (entry.get("original_translation") or "").replace("\n", " ")
                new_t = (entry.get("new_translation") or "").replace("\n", " ")
                f.write(f"| 구분 | 내용 |\n|------|------|\n")
                f.write(f"| 이전 번역 | {orig[:200]} |\n")
                f.write(f"| 수정 번역 | {new_t[:200]} |\n\n")
        else:
            f.write("번역 수정 없음.\n")

    print(f"  Report written to {REPORT_PATH}")
    print("\n✅ All done!")
    print(f"   Deleted: {len(deleted_log)} quotes")
    print(f"   Re-translated: {len(translation_log)} items")
    print(f"   Final total: {len(kept_quotes)} quotes")


if __name__ == "__main__":
    main()
