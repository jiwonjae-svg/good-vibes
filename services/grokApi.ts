import { GROK_API_URL, GROK_MODEL, GROK_API_KEY } from '../constants/config';
import i18n from '../i18n';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: { message: { content: string } }[];
}

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
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
      temperature: 0.9,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) throw new Error(`Grok API error: ${response.status}`);
  const data: GrokResponse = await response.json();
  return data.choices[0]?.message?.content ?? '';
}

export async function generateQuotes(
  count: number,
  selectedCategories: string[] = [],
): Promise<{ text: string; author: string; category?: string }[]> {
  const lang = i18n.language;
  const langName = LANG_NAMES[lang] ?? 'Korean';

  const categoryList =
    selectedCategories.length > 0
      ? selectedCategories.join(', ')
      : 'various topics (life, love, courage, happiness, growth, wisdom, etc.)';

  const systemPrompt = `You are a professional expert in generating touching and inspirational quotes.

Rules:
- Respond in ${langName}.
- Generate quotes based on [${categoryList}].
- For each quote, use only 1-4 relevant categories from the provided list, rather than mixing all of them.
- Length: 1-2 sentences per quote. Keep it natural and impactful.
- Output Format: Strictly JSON array only: [{ "text": "...", "author": "...", "category": "..." }]. No other text, explanations, or markdown outside the JSON.
- Quantity: Generate exactly ${count} quotes at once.
- Use real famous authors when possible, or use the appropriate "Unknown" translation for the language.`;

  const raw = await callGrok(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${count} inspiring quotes now.` },
    ],
    500,
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
  const langName = LANG_NAMES[lang] ?? 'Korean';
  const activityName =
    activityType === 'speak' ? 'read aloud' : activityType === 'write' ? 'handwrite' : 'type';

  const raw = await callGrok(
    [
      {
        role: 'system',
        content: `You are a warm, encouraging advisor. Give a short, heartfelt praise in ${langName}.`,
      },
      {
        role: 'user',
        content: `The user completed the "${activityName}" activity for the quote: "${quoteSample}". Give one sentence of warm praise in ${langName}.`,
      },
    ],
    150,
  );

  return raw.trim();
}
