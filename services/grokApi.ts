import { GROK_API_URL, GROK_MODEL, GROK_API_KEY } from '../constants/config';
import i18n from '../i18n';
import { useUserStore } from '../stores/useUserStore';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: { message: { content: string } }[];
}

const LANG_MAP: Record<string, { name: string; author: string }> = {
  ko: { name: '한국어', author: '마음의 속삭임' },
  en: { name: 'English', author: 'Whisper of Heart' },
  ja: { name: '日本語', author: '心のささやき' },
  zh: { name: '中文', author: '心灵低语' },
};

export async function callGrok(messages: GrokMessage[], maxTokens = 500): Promise<string> {
  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      temperature: 0.95,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) throw new Error(`Grok API error: ${response.status}`);
  const data: GrokResponse = await response.json();
  return data.choices[0]?.message?.content ?? '';
}

function getRecentQuoteTexts(): string[] {
  const viewed = useUserStore.getState().todayViewedQuoteIds;
  return viewed.slice(-10).map((q) => q.split('|')[1] || '').filter(Boolean);
}

export async function generateQuotes(
  count: number,
  selectedCategories: string[] = [],
): Promise<{ text: string; author: string; category?: string }[]> {
  const lang = i18n.language;
  const langInfo = LANG_MAP[lang] ?? LANG_MAP.ko;
  const cats = selectedCategories.length > 0 ? selectedCategories.join(',') : 'life,love,courage,happiness,growth,wisdom';
  
  const recentQuotes = getRecentQuoteTexts();
  const avoidPart = recentQuotes.length > 0 
    ? `\nAvoid similar to: ${recentQuotes.slice(0, 5).map(q => q.slice(0, 30)).join('; ')}`
    : '';

  const systemPrompt = `Create ${count} original inspirational quotes.
STRICT: Write ONLY in ${langInfo.name}. No other language.
Topics: ${cats}
Author: "${langInfo.author}"
Format: JSON array only [{"text":"...","author":"${langInfo.author}","category":"..."}]${avoidPart}`;

  const raw = await callGrok(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate now.' },
    ],
    400,
  );

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse quotes from Grok response');
  }
}

export async function generatePraise(
  activityType: 'speak' | 'write' | 'type',
  quoteSample: string,
): Promise<string> {
  const lang = i18n.language;
  const langInfo = LANG_MAP[lang] ?? LANG_MAP.ko;
  const activity = activityType === 'speak' ? 'read aloud' : activityType === 'write' ? 'write' : 'type';

  const raw = await callGrok(
    [
      {
        role: 'system',
        content: `Give 1 short warm praise in ${langInfo.name} ONLY. No other language.`,
      },
      {
        role: 'user',
        content: `User completed ${activity}: "${quoteSample.slice(0, 50)}"`,
      },
    ],
    100,
  );

  return raw.trim();
}
