#!/usr/bin/env node
/**
 * setup-google-services.js
 *
 * Injects google-services.json and GoogleService-Info.plist from EAS Secrets
 * during cloud build. Run by eas-build-post-install.
 *
 * EAS Secrets to set (base64-encoded content):
 *   GOOGLE_SERVICES_JSON_B64
 *   GOOGLE_SERVICE_INFO_PLIST_B64
 *
 * Local builds: Keep the files in project root (gitignored). This script
 * is a no-op if files already exist.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const googleServicesPath = path.join(root, 'google-services.json');
const plistPath = path.join(root, 'GoogleService-Info.plist');

// If files already exist (local build), skip
if (fs.existsSync(googleServicesPath) && fs.existsSync(plistPath)) {
  console.log('[setup-google-services] Files exist, skipping injection.');
  process.exit(0);
}

// EAS cloud build: need secrets
const jsonB64 = process.env.GOOGLE_SERVICES_JSON_B64;
const plistB64 = process.env.GOOGLE_SERVICE_INFO_PLIST_B64;

const isEasBuild = process.env.EAS_BUILD === 'true';

if (isEasBuild) {
  if (!jsonB64 || !plistB64) {
    console.error(
      '[setup-google-services] EAS Build requires GOOGLE_SERVICES_JSON_B64 and GOOGLE_SERVICE_INFO_PLIST_B64 secrets.\n' +
      '  Run: eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value "$(base64 -w0 google-services.json)" --scope project\n' +
      '  Run: eas secret:create --name GOOGLE_SERVICE_INFO_PLIST_B64 --value "$(base64 -w0 GoogleService-Info.plist)" --scope project'
    );
    process.exit(1);
  }

  try {
    fs.writeFileSync(googleServicesPath, Buffer.from(jsonB64, 'base64').toString('utf8'));
    fs.writeFileSync(plistPath, Buffer.from(plistB64, 'base64').toString('utf8'));
    console.log('[setup-google-services] Injected config files from EAS secrets.');
  } catch (e) {
    console.error('[setup-google-services] Failed to write files:', e.message);
    process.exit(1);
  }
} else {
  console.error(
    '[setup-google-services] Missing google-services.json and/or GoogleService-Info.plist.\n' +
    '  Download from Firebase Console and place in project root.\n' +
    '  See docs/SECRETS-SETUP.md for details.'
  );
  process.exit(1);
}
