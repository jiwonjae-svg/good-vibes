#!/usr/bin/env node
/**
 * EAS 로컬 빌드 전: .env의 EXPO_PUBLIC_FIREBASE_API_KEY를 eas.json에 주입
 * EAS 로컬 빌드는 eas.json의 env만 사용. eas.json을 백업 후 패치하고, 빌드 후 복원 필요.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const envPath = path.join(root, '.env');
const easPath = path.join(root, 'eas.json');
const easBakPath = path.join(root, 'eas.json.bak');

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[m[1]] = val;
    }
  }
  return env;
}

const env = loadEnv(envPath);
const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

if (!apiKey) {
  console.error('ERROR: EXPO_PUBLIC_FIREBASE_API_KEY not found.');
  if (!fs.existsSync(envPath)) {
    console.error(`  .env not found at: ${envPath}`);
    console.error(`  cwd: ${root}`);
  } else {
    console.error(`  .env exists but key missing or empty. Check EXPO_PUBLIC_FIREBASE_API_KEY=... in .env`);
  }
  console.error('  Add it to .env (Firebase Console > Project Settings > General > Web API Key)');
  process.exit(1);
}

fs.copyFileSync(easPath, easBakPath);

const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
for (const profile of ['development', 'preview', 'production']) {
  if (eas.build && eas.build[profile] && eas.build[profile].env) {
    eas.build[profile].env.EXPO_PUBLIC_FIREBASE_API_KEY = apiKey;
  }
}

fs.writeFileSync(easPath, JSON.stringify(eas, null, 2), 'utf8');
console.log('Patched eas.json with EXPO_PUBLIC_FIREBASE_API_KEY. Run "cp eas.json.bak eas.json" after build to restore.');
