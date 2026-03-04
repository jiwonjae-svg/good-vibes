# 명언 시스템 변경 가이드 & Firebase/env 정리

## 1. Firebase iOS / Android 환경 변수

### 현재 구조
- **Web API Key** (`EXPO_PUBLIC_FIREBASE_API_KEY`): **Android·iOS 공통** — Firebase Web SDK용으로 하나의 키를 사용합니다.
- **App ID**: iOS/Android 각각 필요
  - `EXPO_PUBLIC_FIREBASE_APP_ID_IOS`
  - `EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID`
- eas.json에는 이미 **두 플랫폼 값이 모두** 들어가 있습니다.

### 결론
- **Android만 빌드**하면: iOS용 env는 그대로 두어도 됩니다. 추가 작업 불필요.
- **iOS도 빌드**할 예정이면: `GoogleService-Info.plist`를 프로젝트 루트에 두고, 현재 eas.json의 iOS env가 그대로 적용됩니다.
- **Web SDK로 전환 권장**: 이미 Web SDK 사용 중이므로 별도 전환 작업 없습니다.

---

## 2. 명언 시스템 변경 개요

### 제거
- AI(Grok) 명언 생성 방식 (`services/grokApi.ts` → `generateQuotes`)

### 추가
- 현실 명언 크롤링 → JSON 저장
- 번역 파이프라인 (ko, en, ja, zh)
- 태그별 가중치 (프로젝트 `data/categories.ts`의 태그 참조)
- 500~1000개 클라이언트 번들, 나머지 Firebase 서버
- 오프라인 시 클라이언트 명언만 사용
- 가중치 계산은 클라이언트 CPU에서 수행

---

## 3. Python 크롤러 스크립트

| 스크립트 | 출처 | 라이선스 | 출력 형식 |
|---------|------|---------|-----------|
| `fetch_quotable.py` | Quotable API | MIT | `{quote, author, source}` |
| `fetch_wikiquote.py` | Wikiquote (mwclient) | CC-BY-SA | `{quote, author, source}` |
| `fetch_gutenberg.py` | Project Gutenberg (Gutendex API) | Public Domain | `{quote, author, source}` |

### 실행 순서
```bash
cd scripts/quotes
pip install -r requirements.txt
python fetch_quotable.py   # -> data/quotable_raw.json
python fetch_wikiquote.py  # -> data/wikiquote_raw.json
python fetch_gutenberg.py  # -> data/gutenberg_raw.json
python merge_quotes.py     # -> data/quotes_merged.json (중복 제거, 통합)
```

---

## 4. 앱 변경이 필요한 부분

### 4-1. 제거·수정
- `services/grokApi.ts`: `generateQuotes` 제거 (또는 미사용 처리). `generatePraise`는 유지.
- `services/quoteService.ts`: `generateQuotes` 호출 제거, 크롤링 JSON 기반으로 변경.

### 4-2. 데이터 형식
```ts
interface CrawledQuote {
  quote: string;
  author: string;
  source: string;  // "quotable", "wikiquote", "gutenberg" 등
  tags?: Record<string, number>;  // 태그별 가중치
}
```

### 4-3. 새 파일/역할
- `data/quotesClient.ts` — 클라이언트 번들용 500~1000개 (번역 완료)
- `services/firestoreQuotesService.ts` — Firebase에서 추가 명언 페치
- `services/quoteService.ts` — 클라이언트 + 서버 통합, 오프라인 시 클라이언트만 사용
- 가중치 계산: 클라이언트에서 `selectedCategories`에 따라 필터/정렬

### 4-4. 번역 파이프라인
- 크롤링 데이터는 주로 영어. DeepL / Google Translate API 등으로 ko, ja, zh 번역 후 `data/quotesClient.ts` 또는 JSON에 저장.

### 4-5. 태그 가중치
- `data/categories.ts`의 `key` 목록을 기준으로 각 명언에 `Record<tagKey, weight>` 부여.
- 키워드 매칭 또는 간단한 ML 모델로 자동 부여 가능.

---

## 5. 디렉터리 구조

```
scripts/quotes/
  fetch_quotable.py
  fetch_wikiquote.py
  fetch_gutenberg.py
  merge_quotes.py
  requirements.txt
data/
  quotable_raw.json
  wikiquote_raw.json
  gutenberg_raw.json
  quotes_merged.json
  quotesClient.json (또는 .ts)  # 번역·가중치 적용 후 클라이언트용 500~1000개
```

## 6. 실행 순서 (한 번에)

```bash
cd scripts/quotes
pip install -r requirements.txt
python fetch_quotable.py
python fetch_wikiquote.py
python fetch_gutenberg.py
python merge_quotes.py
```

## 7. 태그 가중치 매핑

- `data/categories.ts`의 `ALL_CATEGORIES` 키 목록을 기준으로 각 명언에 `tags: Record<string, number>` 부여.
- 키워드 기반 휴리스틱: 명언 텍스트에 "gratitude", "motivation" 등이 포함되면 해당 태그 가중치 상승.
- 가중치 계산은 클라이언트에서 `selectedCategories`에 따라 수행 (서버 부하 없음).
