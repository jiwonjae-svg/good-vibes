import { GROK_API_URL, GROK_MODEL, GROK_API_KEY } from '../constants/config';
import i18n from '../i18n';
import type { QuoteCategory } from '../stores/useUserStore';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: { message: { content: string } }[];
}

const LANG_NAMES: Record<string, string> = {
  ko: '한국어', en: 'English', ja: '日本語', zh: '中文',
};

const CATEGORY_PROMPTS: Record<QuoteCategory, string> = {
  all: '다양한 주제(사랑, 용기, 행복, 성장, 인내 등)',
  love: '사랑과 관계',
  growth: '자기계발과 성장',
  life: '인생과 삶의 지혜',
  morning: '아침에 어울리는 활력과 긍정',
  courage: '용기와 도전',
  happiness: '행복과 기쁨',
  patience: '인내와 끈기',
  wisdom: '지혜와 통찰',
  friendship: '우정과 사람',
  success: '성공과 목표',
};

export async function callGrok(messages: GrokMessage[]): Promise<string> {
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
      max_tokens: 2000,
    }),
  });

  if (!response.ok) throw new Error(`Grok API error: ${response.status}`);
  const data: GrokResponse = await response.json();
  return data.choices[0]?.message?.content ?? '';
}

export async function generateQuotes(
  count: number,
  category: QuoteCategory = 'all',
): Promise<{ text: string; author: string }[]> {
  const lang = i18n.language;
  const langName = LANG_NAMES[lang] ?? LANG_NAMES.ko;
  const catPrompt = CATEGORY_PROMPTS[category] ?? CATEGORY_PROMPTS.all;

  const raw = await callGrok([
    {
      role: 'system',
      content: `You are an expert at generating inspiring quotes. Generate quotes in ${langName}. Each quote should carry a positive, warm message about life.`,
    },
    {
      role: 'user',
      content: `Generate ${count} inspiring and warm quotes about "${catPrompt}" in ${langName}.

Respond ONLY with a JSON array, no other text:
[{"text": "quote content", "author": "author name"}]

Use real famous authors when possible, or "작자 미상" for unknown/original quotes.`,
    },
  ]);

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
  const langName = LANG_NAMES[lang] ?? LANG_NAMES.ko;
  const activityName =
    activityType === 'speak' ? 'read aloud' : activityType === 'write' ? 'handwrite' : 'type';

  const raw = await callGrok([
    {
      role: 'system',
      content: `You are a warm, encouraging advisor. Give a short, heartfelt praise in ${langName}.`,
    },
    {
      role: 'user',
      content: `The user completed the "${activityName}" activity for the quote: "${quoteSample}". Give one sentence of warm praise in ${langName}.`,
    },
  ]);

  return raw.trim();
}
