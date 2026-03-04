import { GROK_API_URL, GROK_MODEL, GROK_API_KEY } from '../constants/config';
import i18n from '../i18n';

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
