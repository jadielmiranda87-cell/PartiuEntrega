#!/usr/bin/env node
/**
 * Gera os 3 APKs (release) com Gradle e copia para ./apks/
 * Requer Android SDK / JDK (mesmo ambiente do Android Studio).
 *
 * Uso: node scripts/pack-local-apks.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ANDROID = join(ROOT, 'android');
const APKS = join(ROOT, 'apks');
const isWin = process.platform === 'win32';
const gradle = isWin ? join(ANDROID, 'gradlew.bat') : join(ANDROID, 'gradlew');

const STEPS = [
  { env: 'client', task: 'assembleClientRelease', src: join(ANDROID, 'app/build/outputs/apk/client/release/app-client-release.apk'), dest: 'FastFud-cliente.apk' },
  { env: 'business', task: 'assembleBusinessRelease', src: join(ANDROID, 'app/build/outputs/apk/business/release/app-business-release.apk'), dest: 'FastFood-comercio.apk' },
  { env: 'motoboy', task: 'assembleMotoboyRelease', src: join(ANDROID, 'app/build/outputs/apk/motoboy/release/app-motoboy-release.apk'), dest: 'FastFood-entregador.apk' },
];

function runGradle(appVariant, task) {
  const env = { ...process.env, APP_VARIANT: appVariant };
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

mkdirSync(APKS, { recursive: true });

/** Limpa bundles antigos para não reaproveitar JS do variant errado. */
const clean = spawnSync(gradle, ['clean', '--no-daemon'], {
  cwd: ANDROID,
  env: { ...process.env },
  stdio: 'inherit',
  shell: isWin,
});
if (clean.status !== 0) process.exit(clean.status ?? 1);

for (const s of STEPS) {
  console.log(`\n>>> APP_VARIANT=${s.env} ${s.task}\n`);
  runGradle(s.env, s.task);
  copyFileSync(s.src, join(APKS, s.dest));
  console.log(` -> ${join('apks', s.dest)}`);
}

console.log('\nConcluído. Pasta:', APKS);
