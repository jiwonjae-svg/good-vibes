/**
 * Audit and fix category weights for all quotes using Grok API.
 *
 * Issues to fix:
 * - Wrong categories (e.g. timeManagement for non-time-management quotes)
 * - Missing relevant categories
 * - Too few categories (should have 3-8 meaningful ones)
 * - Filler weight-1 categories that don't truly fit
 * - Incorrect weight values
 *
 * Usage: node scripts/audit-category-weights.js <quotesClient|quotesServer> [--dry-run]
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.x.ai/v1/chat/completions';
const API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GROK_MODEL || 'grok-4-1-fast-non-reasoning';
const BATCH_SIZE = 5; // smaller batches for more accurate category analysis
const DELAY_MS = 800;
const SAVE_EVERY = 20; // batches

if (!API_KEY) {
  console.error('Missing EXPO_PUBLIC_GROK_API_KEY in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--')) || 'quotesClient';
const dryRun = args.includes('--dry-run');

const filePath = path.join(__dirname, '..', 'data', `${target}.json`);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const VALID_CATEGORIES = [
  // Life & Growth
  'life','success','failure','effort','patience','challenge','growth','change',
  'dream','goal','passion','courage','determination','persistence',
  'selfImprovement','habit','timeManagement','focus','productivity','motivation',
  'positivity','gratitude','happiness','satisfaction','mindfulness','innerSelf',
  'selfRespect','confidence','overcomingFear','mistake','regret','choice',
  'destiny','opportunity','beginning','ending','journey','reflection',
  'realization','wisdom','experience','aging','death','meaningOfLife',
  'existence','freedom',
  // Emotion & Relationship
  'love','romance','breakup','friendship','family','parents','children',
  'marriage','loneliness','comfort','encouragement','trust','betrayal',
  'forgiveness','jealousy','anger','sadness','joy','peace','stress','anxiety',
  'fear','hope','despair','healing','empathy','communication','relationship',
  'consideration','respect','devotion','sacrifice','trueLove','selfLove',
  // Work & Business
  'work','career','startup','leadership','teamwork','competition','achievement',
  'money','wealth','investment','workLifeBalance','burnout','rest','dreamJob',
  'innovation','crisis','networking',
  // Nature & Philosophy
  'nature','spring','summer','autumn','winter','sea','mountain','sky','stars',
  'morning','sunset','travel','adventure','simplicity','minimalism','soul',
  'universe','time','eternity','present','youth','health','meditation',
  // Special
  'books','study','newYear','truth','art','music','writing','creativity',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGrok(messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function buildPrompt(batch) {
  const quotesData = batch.map((q) => ({
    id: q.id,
    quote: q.quote,
    author: q.author,
    currentCategories: q.categories,
  }));

  return [
    {
      role: 'system',
      content: `You are an expert at categorizing motivational and philosophical quotes. You will be given quotes with their current category assignments and weights, and you must evaluate and correct them.

VALID CATEGORIES (use ONLY these exact keys):
${VALID_CATEGORIES.join(', ')}

RULES:
1. Each quote should have 3-8 categories (no more, no fewer unless truly only 1-2 apply)
2. Weights are integers 1-10 where 10 = perfectly describes the quote's core theme
3. Primary theme(s) should be 8-10, secondary themes 5-7, tangentially related 3-4
4. Do NOT assign weight 1-2 as filler — only include categories that genuinely relate
5. "timeManagement" is about managing time/schedules/productivity, NOT about "time" in a philosophical sense. Use "time" category for philosophical concepts of time.
6. "youth" is about being young/youthful, NOT about learning or growth in general
7. Be precise: "friendship" vs "relationship" vs "love" have distinct meanings
8. Remove categories that don't genuinely fit the quote's meaning
9. Add missing categories that clearly fit

Return a JSON array of objects with "id" and "categories" (the corrected Record<string, number>).
Return ONLY the JSON array, no markdown fences, no explanation.`,
    },
    {
      role: 'user',
      content: JSON.stringify(quotesData),
    },
  ];
}

async function main() {
  const quotes = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${quotes.length} quotes from ${target}.json`);
  console.log(`Dry run: ${dryRun}`);

  const batches = [];
  for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
    batches.push(quotes.slice(i, i + BATCH_SIZE));
  }

  let totalFixed = 0;
  let totalUnchanged = 0;
  let errors = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const batchNum = bi + 1;

    if (batchNum % 10 === 0 || batchNum === 1 || batchNum === batches.length) {
      console.log(`Batch ${batchNum}/${batches.length} (${batch.length} quotes)...`);
    }

    try {
      const messages = buildPrompt(batch);
      const raw = await callGrok(messages);

      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const results = JSON.parse(cleaned);

      for (const result of results) {
        const quote = quotes.find((q) => q.id === result.id);
        if (!quote) continue;

        // Validate categories
        const validCats = {};
        for (const [key, weight] of Object.entries(result.categories)) {
          if (VALID_CATEGORIES.includes(key) && typeof weight === 'number' && weight >= 1 && weight <= 10) {
            validCats[key] = Math.round(weight);
          }
        }

        if (Object.keys(validCats).length === 0) continue;

        // Check if actually changed
        const oldStr = JSON.stringify(quote.categories);
        const newStr = JSON.stringify(validCats);
        if (oldStr === newStr) {
          totalUnchanged++;
        } else {
          totalFixed++;
          if (!dryRun) {
            quote.categories = validCats;
          }
        }
      }
    } catch (err) {
      console.error(`  Error in batch ${batchNum}: ${err.message}`);
      errors++;
    }

    // Save periodically
    if (!dryRun && batchNum % SAVE_EVERY === 0) {
      fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf-8');
      console.log(`[save at batch ${batchNum}, ${totalFixed} fixed so far]`);
    }

    if (bi < batches.length - 1) await sleep(DELAY_MS);
  }

  // Final save
  if (!dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), 'utf-8');
  }

  console.log(`\nDone! ${totalFixed} quotes updated, ${totalUnchanged} unchanged, ${errors} errors.`);
  console.log(`File: ${filePath}`);
}

main().catch(console.error);
