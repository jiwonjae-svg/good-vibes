/**
 * Crawled quote data (Quotable, Wikiquote, Project Gutenberg)
 * With translations and tag weights for offline use.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require('./quotesClient.json') as CrawledQuoteRaw[];

export interface CrawledQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  categories: Record<string, number>;
  translations: Record<string, string>;
}

interface CrawledQuoteRaw {
  id: string;
  quote: string;
  author: string;
  source: string;
  categories?: Record<string, number>;
  translations?: Record<string, string>;
}

export const clientQuotes: CrawledQuote[] = raw.map((q: CrawledQuoteRaw) => ({
  id: q.id,
  quote: q.quote,
  author: q.author,
  source: q.source || '',
  categories: q.categories || {},
  translations: q.translations || { en: q.quote },
}));
