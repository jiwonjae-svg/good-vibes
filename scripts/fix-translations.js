/**
 * Fix truncated/wrong JA and ZH translations, and add missing ES translations
 * using the Grok (xAI) API.
 *
 * Usage: node scripts/fix-translations.js [--fix-truncated] [--add-es] [--dry-run]
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.x.ai/v1/chat/completions';
const API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const BATCH_SIZE = 10;
const DELAY_MS = 600; // delay between API calls to respect rate limits

if (!API_KEY) {
  console.error('Missing EXPO_PUBLIC_GROK_API_KEY in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const fixTruncated = args.includes('--fix-truncated') || args.length === 0;
const addEs = args.includes('--add-es') || args.length === 0;
const dryRun = args.includes('--dry-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGrok(messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function findTruncated(quotes) {
  const issues = [];
  for (const q of quotes) {
    if (!q.translations) continue;
    const en = q.translations.en || q.quote;
    if (!en || en.length <= 30) continue;
    for (const lang of ['ja', 'zh']) {
      const t = q.translations[lang];
      if (t && t.length < en.length * 0.25) {
        issues.push({ id: q.id, lang, en, current: t });
      }
    }
  }
  return issues;
}

function findMissingEs(quotes) {
  return quotes.filter((q) => !q.translations?.es).map((q) => ({
    id: q.id,
    en: q.translations?.en || q.quote,
  }));
}

async function translateBatch(items, targetLangs) {
  const langNames = { ja: 'Japanese', zh: 'Traditional Chinese', es: 'Spanish', ko: 'Korean' };
  const langList = targetLangs.map((l) => `${l} (${langNames[l]})`).join(', ');

  const quotesText = items
    .map((item, i) => `[${i}] "${item.en}"`)
    .join('\n');

  const prompt = `Translate each of the following English quotes into ${langList}. 
These are famous quotes/proverbs for a motivational quote app. Preserve the original meaning faithfully.
Do NOT substitute with a different quote. Translate the EXACT content.

Output ONLY a valid JSON array where each element is an object with keys: "index" (number), ${targetLangs.map((l) => `"${l}" (string)`).join(', ')}.

Quotes:
${quotesText}`;

  const response = await callGrok([
    { role: 'system', content: 'You are a professional translator. Output only valid JSON, no markdown fences.' },
    { role: 'user', content: prompt },
  ]);

  // Parse JSON from response (handle possible markdown fences)
  const jsonStr = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Grok response:', jsonStr.substring(0, 200));
    return null;
  }
}

async function processFile(filePath) {
  console.log(`\nProcessing ${path.basename(filePath)}...`);
  const quotes = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let modified = 0;

  // Phase 1: Fix truncated JA/ZH
  if (fixTruncated) {
    const truncated = findTruncated(quotes);
    console.log(`  Truncated translations found: ${truncated.length}`);

    // Group by quote ID (one quote might have both JA and ZH issues)
    const byId = {};
    for (const t of truncated) {
      if (!byId[t.id]) byId[t.id] = { id: t.id, en: t.en, langs: [] };
      byId[t.id].langs.push(t.lang);
    }
    const grouped = Object.values(byId);

    for (let i = 0; i < grouped.length; i += BATCH_SIZE) {
      const batch = grouped.slice(i, i + BATCH_SIZE);
      const allLangs = [...new Set(batch.flatMap((b) => b.langs))];
      console.log(`  Fixing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(grouped.length / BATCH_SIZE)} (${batch.length} quotes, langs: ${allLangs.join(',')})...`);

      if (dryRun) continue;

      const results = await translateBatch(batch, allLangs);
      if (!results) { console.error('  Batch failed, skipping'); continue; }

      for (const r of results) {
        const item = batch[r.index];
        if (!item) continue;
        const q = quotes.find((x) => x.id === item.id);
        if (!q) continue;
        for (const lang of allLangs) {
          if (r[lang]) {
            q.translations[lang] = r[lang];
            modified++;
          }
        }
      }
      await sleep(DELAY_MS);
    }
  }

  // Phase 2: Add missing ES translations
  if (addEs) {
    const missing = findMissingEs(quotes);
    console.log(`  Missing ES translations: ${missing.length}`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(missing.length / BATCH_SIZE);
      if (batchNum % 10 === 1 || batchNum === totalBatches) {
        console.log(`  ES batch ${batchNum}/${totalBatches}...`);
      }

      if (dryRun) continue;

      const results = await translateBatch(batch, ['es']);
      if (!results) { console.error(`  ES batch ${batchNum} failed, skipping`); continue; }

      for (const r of results) {
        const item = batch[r.index];
        if (!item) continue;
        const q = quotes.find((x) => x.id === item.id);
        if (q && r.es) {
          if (!q.translations) q.translations = {};
          q.translations.es = r.es;
          modified++;
        }
      }

      // Save incrementally every 50 batches
      if (batchNum % 50 === 0) {
        fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf-8');
        console.log(`  [incremental save at batch ${batchNum}]`);
      }

      await sleep(DELAY_MS);
    }
  }

  if (!dryRun && modified > 0) {
    fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf-8');
    console.log(`  Saved ${modified} translation fixes to ${path.basename(filePath)}`);
  } else if (dryRun) {
    console.log(`  [dry-run] Would fix translations in ${path.basename(filePath)}`);
  }
}

async function main() {
  console.log(`Translation audit & fix script`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Fix truncated: ${fixTruncated}`);
  console.log(`  Add ES: ${addEs}`);
  console.log(`  Dry run: ${dryRun}`);

  const clientPath = path.join(__dirname, '..', 'data', 'quotesClient.json');
  const serverPath = path.join(__dirname, '..', 'data', 'quotesServer.json');

  await processFile(clientPath);
  await processFile(serverPath);

  console.log('\nDone!');
}

main().catch((e) => { console.error(e); process.exit(1); });
