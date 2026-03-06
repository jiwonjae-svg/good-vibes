/**
 * Uploads quotesServer.json to Firestore as chunked documents.
 *
 * Schema:
 *   Collection: quotes_catalog
 *   Documents:  chunk_0, chunk_1, chunk_2, ...
 *   Each doc:   { quotes: CrawledQuote[], count: number, updatedAt: number }
 *
 * Prerequisites:
 *   1. Firebase Console > Project Settings > Service Accounts
 *      > "Generate new private key" > save as  scripts/serviceAccount.json
 *   2. Run:  node scripts/upload-quotes-firebase.js
 *
 * After upload, delete serviceAccount.json or add it to .gitignore.
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccount.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`
ERROR: serviceAccount.json not found.

Steps:
  1. Firebase Console > Project Settings > Service Accounts
  2. Click "Generate new private key" > Download JSON
  3. Save as scripts/serviceAccount.json
  4. Run: node scripts/upload-quotes-firebase.js
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const quotesPath = path.join(__dirname, '..', 'data', 'quotesServer.json');
const quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));
console.log(`Loaded ${quotes.length} server quotes`);

const CHUNK_SIZE = 450;

async function uploadChunks() {
  const chunks = [];
  for (let i = 0; i < quotes.length; i += CHUNK_SIZE) {
    chunks.push(quotes.slice(i, i + CHUNK_SIZE));
  }
  console.log(`Uploading ${chunks.length} chunks...`);

  for (let ci = 0; ci < chunks.length; ci++) {
    await db.collection('quotes_catalog').doc(`chunk_${ci}`).set({
      quotes:    chunks[ci],
      count:     chunks[ci].length,
      updatedAt: Date.now(),
    });
    console.log(`  chunk_${ci}: ${chunks[ci].length} quotes`);
  }

  await db.collection('quotes_catalog').doc('_meta').set({
    totalQuotes: quotes.length,
    chunkCount:  chunks.length,
    chunkSize:   CHUNK_SIZE,
    updatedAt:   Date.now(),
  });

  console.log(`Done! ${quotes.length} quotes in ${chunks.length} chunks.`);
  process.exit(0);
}

uploadChunks().catch((e) => {
  console.error('Upload failed:', e.message);
  process.exit(1);
});
