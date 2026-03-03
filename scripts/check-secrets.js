#!/usr/bin/env node
/**
 * check-secrets.js
 *
 * Pre-commit security scan: detects committed secrets or sensitive files.
 * Run automatically via husky pre-commit hook, or manually:
 *   node scripts/check-secrets.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasError = false;

function error(msg) {
  console.error(`${RED}✖ [secrets-check] ${msg}${RESET}`);
  hasError = true;
}

function warn(msg) {
  console.warn(`${YELLOW}⚠ [secrets-check] ${msg}${RESET}`);
}

function ok(msg) {
  console.log(`${GREEN}✔ [secrets-check] ${msg}${RESET}`);
}

// ---------------------------------------------------------------------------
// 1. Block sensitive file paths from being staged
// ---------------------------------------------------------------------------
const BLOCKED_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.staging',
  'google-services.json',
  'GoogleService-Info.plist',
  '.sentryclirc',
];

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedDeletions() {
  try {
    const output = execSync('git diff --cached --name-status', { encoding: 'utf8' });
    return output.trim().split('\n').filter((line) => line.startsWith('D\t')).map((line) => line.slice(2));
  } catch {
    return [];
  }
}

const staged = getStagedFiles();
const stagedDeletions = getStagedDeletions();

for (const file of staged) {
  const basename = path.basename(file);
  if (BLOCKED_FILES.includes(basename) && !stagedDeletions.includes(file)) {
    error(`Blocked file staged for commit: "${file}"\n  Remove it with: git reset HEAD "${file}"`);
  }
}

// ---------------------------------------------------------------------------
// 2. Scan staged file content for suspicious patterns
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  // Generic high-entropy keys
  { pattern: /AAAA[0-9A-Za-z+/]{60,}/, label: 'Possible RSA/SSH private key' },
  // Firebase apiKey (real ones start with AIzaSy)
  { pattern: /AIzaSy[0-9A-Za-z\-_]{33}/, label: 'Firebase API key' },
  // xAI / Grok key
  { pattern: /xai-[0-9A-Za-z]{30,}/, label: 'xAI Grok API key' },
  // Generic secret patterns
  { pattern: /secret[_\s]*[:=][_\s]*["']?[A-Za-z0-9+/]{16,}/, label: 'Generic secret value' },
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/, label: 'Bearer token' },
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
  // Private key block
  { pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'Private key block' },
];

for (const file of staged) {
  if (stagedDeletions.includes(file)) continue;

  const ext = path.extname(file).toLowerCase();
  const basename = path.basename(file);
  const skip = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.ttf', '.otf', '.woff', '.woff2'];
  if (skip.includes(ext)) continue;

  if (basename === '.env.example' || basename.endsWith('.example') || file.endsWith('.example')) continue;

  const absPath = path.join(process.cwd(), file);
  if (!fs.existsSync(absPath)) continue;

  const content = fs.readFileSync(absPath, 'utf8');

  for (const { pattern, label } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      error(`Possible secret found in "${file}": ${label}\n  Review the file before committing.`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Warn if .env.example is missing (new contributors won't know what to set)
// ---------------------------------------------------------------------------
if (!fs.existsSync(path.join(process.cwd(), '.env.example'))) {
  warn('.env.example file is missing — add it so contributors know which env vars are required.');
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
if (hasError) {
  console.error(`\n${RED}Pre-commit check FAILED. Fix the issues above before committing.${RESET}\n`);
  process.exit(1);
} else {
  ok('No secrets detected in staged files.');
}
