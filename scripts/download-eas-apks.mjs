#!/usr/bin/env node
/**
 * Aguarda os builds EAS (Android) terminarem e baixa os .apk para ./apks/
 *
 * Uso:
 *   node scripts/download-eas-apks.mjs
 *
 * IDs padrão = últimos disparos (sobrescreva com env se precisar):
 *   EAS_BUILD_CLIENT_ID, EAS_BUILD_COMERCIO_ID, EAS_BUILD_ENTREGADOR_ID
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, createWriteStream, openSync, readSync, closeSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APKS = join(ROOT, 'apks');

const TARGETS = [
  {
    file: 'FastFud-cliente.apk',
    id: process.env.EAS_BUILD_CLIENT_ID || 'a132e5f9-1405-4199-b4d6-a8a7ea6279e4',
  },
  {
    file: 'FastFood-comercio.apk',
    id: process.env.EAS_BUILD_COMERCIO_ID || '161346d4-2ccc-4313-87f1-1a53c27f9450',
  },
  {
    file: 'FastFood-entregador.apk',
    id: process.env.EAS_BUILD_ENTREGADOR_ID || '915602fe-db8a-4f09-a56e-8f6a48481db7',
  },
];

function runEas(args) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(cmd, ['eas-cli', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return `${r.stdout || ''}\n${r.stderr || ''}`;
}

let buildListCache = { at: 0, list: null };
const LIST_TTL_MS = 5_000;

function fetchBuildList() {
  const out = runEas(['build:list', '--platform', 'android', '--limit', '40', '--json', '--non-interactive']);
  const i = out.indexOf('[');
  if (i === -1) throw new Error(`Sem JSON em build:list\n${out.slice(0, 800)}`);
  return JSON.parse(out.slice(i));
}

function getBuild(id) {
  const now = Date.now();
  if (!buildListCache.list || now - buildListCache.at > LIST_TTL_MS) {
    buildListCache.list = fetchBuildList();
    buildListCache.at = now;
  }
  const b = buildListCache.list.find((x) => x.id === id);
  if (!b) {
    buildListCache.list = fetchBuildList();
    buildListCache.at = now;
    return buildListCache.list.find((x) => x.id === id) ?? null;
  }
  return b;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** ZIP “End of central directory” — APK truncado costuma falhar na instalação (“analisar o pacote”). */
function assertApkZipLooksComplete(path) {
  const st = statSync(path);
  if (st.size < 1_000_000) throw new Error(`APK muito pequeno (${st.size} bytes) — download provavelmente falhou.`);
  const tail = Math.min(70_000, st.size);
  const buf = Buffer.alloc(tail);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, tail, st.size - tail);
  } finally {
    closeSync(fd);
  }
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let ok = false;
  for (let i = buf.length - sig.length; i >= 0; i--) {
    if (buf.subarray(i, i + sig.length).equals(sig)) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error('APK corrompido ou incompleto (ZIP sem diretório central final). Baixe de novo.');
}

/**
 * No Windows, `fetch`/`Invoke-WebRequest` às vezes grava APK incompleto após redirects do Expo.
 * `curl.exe --ssl-no-revoke -L` segue a cadeia até o binário completo (~200MB+).
 */
async function downloadFile(url, dest) {
  const token = process.env.EXPO_TOKEN;

  if (process.platform === 'win32') {
    const r = spawnSync(
      'curl.exe',
      ['--ssl-no-revoke', '-L', '-f', '-o', dest, ...(token ? ['-H', `Authorization: Bearer ${token}`] : []), url],
      { stdio: 'inherit' }
    );
    if (r.status !== 0) {
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
      throw new Error(`curl falhou (exit ${r.status}). Defina EXPO_TOKEN se pedir auth.`);
    }
    assertApkZipLooksComplete(dest);
    return;
  }

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { redirect: 'follow', headers });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  const body = Readable.fromWeb(res.body);
  await pipeline(body, createWriteStream(dest));
  assertApkZipLooksComplete(dest);
}

mkdirSync(APKS, { recursive: true });

const POLL_MS = 45_000;
const MAX_WAIT_MS = 3 * 60 * 60_000;
const start = Date.now();

console.log('Pasta de saída:', APKS);
for (const t of TARGETS) console.log(`  • ${t.file} <- build ${t.id}`);

const pending = new Map(TARGETS.map((t) => [t.id, t]));

while (pending.size > 0) {
  if (Date.now() - start > MAX_WAIT_MS) {
    console.error('Tempo máximo de espera atingido. Faltaram:', [...pending.values()].map((x) => x.file));
    process.exit(1);
  }

  for (const [id, t] of [...pending.entries()]) {
    let info;
    try {
      info = getBuild(id);
    } catch (e) {
      console.error(`[${t.file}] erro ao consultar build:`, e.message);
      await sleep(10_000);
      continue;
    }

    if (!info) {
      console.error(`[${t.file}] build ${id} não apareceu na lista EAS ainda.`);
      await sleep(15_000);
      continue;
    }

    const st = info.status;
    process.stdout.write(`[${t.file}] ${st}\n`);

    if (st === 'FINISHED') {
      const url = info.artifacts?.applicationArchiveUrl || info.artifacts?.buildUrl;
      if (!url) {
        console.error(`[${t.file}] FINISHED mas sem URL de artefato.`);
        pending.delete(id);
        continue;
      }
      const dest = join(APKS, t.file);
      process.stdout.write(` -> baixando...\n`);
      await downloadFile(url, dest);
      console.log(` -> salvo ${dest}`);
      pending.delete(id);
    } else if (st === 'ERRORED' || st === 'CANCELED') {
      console.error(`[${t.file}] build ${st}. Removendo da fila.`);
      pending.delete(id);
    }
  }

  if (pending.size > 0) await sleep(POLL_MS);
}

console.log('Concluido.');
