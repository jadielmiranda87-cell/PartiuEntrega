#!/usr/bin/env node
/**
 * Envia GOOGLE_MAPS_API_KEY para o Supabase/OnSpace (secrets das Edge Functions:
 * maps-directions, maps-geocode, maps-places).
 *
 * Valor lido de (primeiro que existir): GOOGLE_MAPS_API_KEY ou EXPO_PUBLIC_GOOGLE_MAPS_KEY
 * nos arquivos .env e .env.{client|business|motoboy} (APP_VARIANT ou padrão client).
 *
 * Pré-requisito: `npx supabase login` e `npx supabase link` ao projeto certo
 * (ou variável SUPABASE_ACCESS_TOKEN + projeto linkado).
 *
 * Uso:
 *   npm run edge:sync-maps-key
 *   cross-env APP_VARIANT=business npm run edge:sync-maps-key
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadEnvFiles() {
  const variant = (process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_VARIANT || 'client').toLowerCase();
  const paths = [
    join(ROOT, '.env'),
    join(ROOT, `.env.${variant}`),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      dotenv.config({ path: p, override: true });
    }
  }
}

loadEnvFiles();

const key =
  (process.env.GOOGLE_MAPS_API_KEY || '').trim() ||
  (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '').trim();

if (!key) {
  console.error(
    '[sync-edge-maps-secret] Nenhuma chave encontrada.\n' +
      '  Defina no .env ou .env.client (etc.):\n' +
      '    EXPO_PUBLIC_GOOGLE_MAPS_KEY=AIza...\n' +
      '  ou\n' +
      '    GOOGLE_MAPS_API_KEY=AIza...\n'
  );
  process.exit(1);
}

const tmpFile = join(tmpdir(), `partiu-edge-maps-${Date.now()}.env`);
writeFileSync(tmpFile, `GOOGLE_MAPS_API_KEY=${key}\n`, 'utf8');

const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const extra = [];
const pref = (process.env.SUPABASE_PROJECT_REF || process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF || '').trim();
if (pref) {
  extra.push('--project-ref', pref);
}

const r = spawnSync(
  npx,
  ['supabase', 'secrets', 'set', '--env-file', tmpFile, ...extra],
  { cwd: ROOT, stdio: 'inherit', shell: isWin }
);

try {
  unlinkSync(tmpFile);
} catch {
  /* ignore */
}

if (r.status !== 0) {
  console.error(
    '\n[sync-edge-maps-secret] Falha ao rodar Supabase CLI.\n' +
      '  1) npm i -D supabase   (ou use npx)\n' +
      '  2) npx supabase login\n' +
      '  3) npx supabase link --project-ref SEU_REF (ou env SUPABASE_PROJECT_REF)\n' +
      '  Ou no OnSpace: Cloud → Edge Functions → Secrets → GOOGLE_MAPS_API_KEY = (mesma chave do Google Cloud)\n' +
      '  APIs necessárias na chave: Directions, Geocoding, Places (se usar autocomplete).\n'
  );
  process.exit(r.status ?? 1);
}

console.log('[sync-edge-maps-secret] OK — secret GOOGLE_MAPS_API_KEY aplicado no projeto linkado.');
console.log('  Redeploy das funções se o painel exigir: npx supabase functions deploy maps-directions maps-geocode maps-places');
