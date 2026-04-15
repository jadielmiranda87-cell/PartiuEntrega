/**
 * Carrega `.env.{client|business|motoboy}` para Metro, app.config.js e ferramentas Node.
 * No Android Studio / Gradle, defina APP_VARIANT no task de bundle (via plugin).
 */
const path = require('path');
const fs = require('fs');

const ALLOWED = new Set(['client', 'business', 'motoboy']);

function loadAppVariantEnv(projectRoot) {
  const dotenv = require('dotenv');
  let variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || 'client';
  if (!ALLOWED.has(variant)) variant = 'client';

  const specific = path.join(projectRoot, `.env.${variant}`);
  const fallback = path.join(projectRoot, '.env');

  if (fs.existsSync(specific)) {
    dotenv.config({ path: specific, override: true });
  } else if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback, override: false });
  }

  let resolved = process.env.EXPO_PUBLIC_APP_VARIANT || variant;
  if (!ALLOWED.has(resolved)) {
    process.env.EXPO_PUBLIC_APP_VARIANT = variant;
    resolved = variant;
  }
  return resolved;
}

module.exports = { loadAppVariantEnv, ALLOWED };
