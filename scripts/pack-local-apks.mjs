#!/usr/bin/env node
/**
 * Gera APK(s) release com Gradle e copia para ./apks/
 * Requer Android SDK / JDK (mesmo ambiente do Android Studio).
 *
 * Uso:
 *   node scripts/pack-local-apks.mjs                    # clean + os 3 variants
 *   node scripts/pack-local-apks.mjs client             # só cliente (--clean opcional)
 *   node scripts/pack-local-apks.mjs business --clean
 *   node scripts/pack-local-apks.mjs motoboy
 *
 * Variants: client | business | motoboy
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadAppVariantEnv } = require('./load-app-variant-env.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ANDROID = join(ROOT, 'android');
const APKS = join(ROOT, 'apks');
const isWin = process.platform === 'win32';
const gradle = isWin ? join(ANDROID, 'gradlew.bat') : join(ANDROID, 'gradlew');

const STEPS = [
  { env: 'client', task: 'assembleClientRelease', src: join(ANDROID, 'app/build/outputs/apk/client/release/app-client-release.apk'), dest: 'FastFood-cliente.apk' },
  { env: 'business', task: 'assembleBusinessRelease', src: join(ANDROID, 'app/build/outputs/apk/business/release/app-business-release.apk'), dest: 'FastFood-comercio.apk' },
  { env: 'motoboy', task: 'assembleMotoboyRelease', src: join(ANDROID, 'app/build/outputs/apk/motoboy/release/app-motoboy-release.apk'), dest: 'FastFood-entregador.apk' },
];

const ALIASES = {
  client: 'client',
  business: 'business',
  comercio: 'business',
  motoboy: 'motoboy',
  entregador: 'motoboy',
};

function parseArgs(argv) {
  const rest = argv.filter((a) => a !== '--clean');
  const wantClean = argv.includes('--clean');
  const key = (rest[0] || '').toLowerCase();
  if (!key) return { mode: 'all', wantClean: true };
  const env = ALIASES[key];
  if (!env) {
    console.error(`Variant desconhecido: "${rest[0]}". Use: client | business | motoboy`);
    process.exit(1);
  }
  return { mode: 'one', env, wantClean };
}

/** Injeta EXPO_PUBLIC_GOOGLE_MAPS_KEY (e demais vars) do `.env` / `.env.{variant}` no Gradle — necessário para o meta-data do Maps no AndroidManifest. */
function gradleEnvForVariant(appVariant) {
  process.env.APP_VARIANT = appVariant;
  process.env.EXPO_PUBLIC_APP_VARIANT = appVariant;
  loadAppVariantEnv(ROOT);
  return { ...process.env };
}

function runGradle(appVariant, task) {
  const env = gradleEnvForVariant(appVariant);
  const r = spawnSync(gradle, [task, '--no-daemon'], {
    cwd: ANDROID,
    env,
    stdio: 'inherit',
    shell: isWin,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const { mode, env: onlyEnv, wantClean } = parseArgs(process.argv.slice(2));

mkdirSync(APKS, { recursive: true });

if (wantClean) {
  const clean = spawnSync(gradle, ['clean', '--no-daemon'], {
    cwd: ANDROID,
    env: { ...process.env },
    stdio: 'inherit',
    shell: isWin,
  });
  if (clean.status !== 0) process.exit(clean.status ?? 1);
} else if (mode === 'all') {
  /** Fluxo completo: sempre limpa para não misturar JS entre flavors. */
  const clean = spawnSync(gradle, ['clean', '--no-daemon'], {
    cwd: ANDROID,
    env: { ...process.env },
    stdio: 'inherit',
    shell: isWin,
  });
  if (clean.status !== 0) process.exit(clean.status ?? 1);
}

const steps = mode === 'all' ? STEPS : STEPS.filter((s) => s.env === onlyEnv);

for (const s of steps) {
  console.log(`\n>>> APP_VARIANT=${s.env} ${s.task}\n`);
  runGradle(s.env, s.task);
  if (!existsSync(s.src)) {
    console.error(`APK esperado não encontrado: ${s.src}`);
    process.exit(1);
  }
  copyFileSync(s.src, join(APKS, s.dest));
  console.log(` -> ${join('apks', s.dest)}`);
}

console.log('\nConcluído. Pasta:', APKS);
