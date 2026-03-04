/**
 * 크롤링된 명언 데이터 (Quotable, Wikiquote, Project Gutenberg)
 * 오프라인 및 기본 제공용
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require('./quotesClient.json') as { quote: string; author: string; source: string }[];

export interface CrawledQuote {
  quote: string;
  author: string;
  source: string;
}

export const clientQuotes: CrawledQuote[] = raw;
