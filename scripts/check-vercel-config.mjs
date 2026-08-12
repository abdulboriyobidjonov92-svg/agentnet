#!/usr/bin/env node
/**
 * `npm run check:vercel-config`
 *
 * NEGA BU SKRIPT BOR: 2026-08-12 da Vercel build'i shu xato bilan yiqildi —
 *
 *     ./e2e/helpers/db.ts:1:30  Cannot find module '@prisma/client'
 *
 * va LOKALDA HECH QANDAY tekshiruv buni ushlay olmadi. Sabab: monorepo
 * ildizida npm hoisting `@prisma/client` ni (u `apps/api` niki) ildiz
 * `node_modules` ga qo'yadi, shuning uchun `apps/web` uni E'LON QILMASA
 * ham lokalda import qila olardi. Vercel `apps/web` ni alohida
 * o'rnatganda ildiz yo'q — va faqat o'sha yerda yiqilardi.
 *
 * Skript ayni shu SINF xatoni ushlaydi: "web build'i o'zi e'lon
 * qilmagan paketga tayanmasin".
 *
 * Uchta invariant tekshiriladi (hech biri tarmoqqa chiqmaydi):
 *   1. `apps/web` build tip-doirasi `e2e` ni O'Z ICHIGA OLMAYDI
 *      (Playwright testlari production build'ga kirmaydi).
 *   2. `turbo run build --filter=@agentnet/web...` grafi `@agentnet/api`
 *      ni TORTMAYDI (Vercel API'ni qurmasligi kerak).
 *   3. `apps/web` build doirasidagi HAR BIR tashqi import `apps/web`
 *      ning O'Z `package.json` ida e'lon qilingan (hoisting'ga tayanish
 *      YO'Q).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'apps', 'web');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const problems = [];
const ok = [];

// ---------------------------------------------------------------- 1
const tsconfig = JSON.parse(
  readFileSync(path.join(WEB, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
);
const excluded = tsconfig.exclude ?? [];
if (!excluded.some((e) => e === 'e2e' || e.startsWith('e2e/'))) {
  problems.push(
    'apps/web/tsconfig.json `exclude` da `e2e` YO\'Q — Playwright testlari\n' +
      '    production build typecheck\'iga kiradi va e\'lon qilinmagan\n' +
      '    paketlarni (@prisma/client, dotenv) tortadi.',
  );
} else {
  ok.push('apps/web build tip-doirasi `e2e` ni chiqarib tashlaydi');
}

// ---------------------------------------------------------------- 2
let graph;
try {
  // Buyruq BITTA satr sifatida beriladi (`execSync`): Windows'da `npx` —
  // `.cmd` va uni shell'siz chaqirib bo'lmaydi. Satr STATIK, foydalanuvchi
  // kiritmasi umuman yo'q, ya'ni injeksiya yuzasi yo'q.
  graph = JSON.parse(
    execSync(`${npx} turbo run build --filter=@agentnet/web... --dry=json`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
} catch {
  problems.push('`turbo ... --dry=json` ishlamadi — turbo grafi tekshirilmadi.');
}
if (graph) {
  const pkgs = graph.packages ?? [];
  const unexpected = pkgs.filter((p) => p !== '@agentnet/web');
  if (unexpected.length) {
    problems.push(
      `Vercel web build grafi ortiqcha paket tortadi: ${unexpected.join(', ')}.\n` +
        '    Vercel faqat @agentnet/web ni qurishi kerak.',
    );
  } else {
    ok.push('turbo grafi: web build faqat @agentnet/web ni quradi');
  }
}

// ---------------------------------------------------------------- 3
const webPkg = JSON.parse(readFileSync(path.join(WEB, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(webPkg.dependencies ?? {}),
  ...Object.keys(webPkg.devDependencies ?? {}),
]);
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

let files = [];
try {
  files = execSync(`${npx} tsc --noEmit -p tsconfig.json --listFiles`, {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('node_modules') && l.startsWith(WEB.replace(/\\/g, '/')));
} catch {
  // tsc chiqish kodi 0 bo'lmasa ham fayl ro'yxatini beradi; bermasa — o'tkazamiz.
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const undeclared = new Map();
for (const file of files) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) continue;
    if (builtins.has(spec)) continue;
    const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (builtins.has(root) || declared.has(root)) continue;
    if (!undeclared.has(root)) undeclared.set(root, path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}
if (undeclared.size) {
  const lines = [...undeclared].map(([p, f]) => `      ${p}  (${f})`).join('\n');
  problems.push(
    'apps/web build doirasi E\'LON QILINMAGAN paketlarni import qiladi\n' +
      '    (lokalda monorepo hoisting tufayli ishlaydi, Vercel\'da YIQILADI):\n' +
      lines,
  );
} else if (files.length) {
  ok.push(`apps/web build doirasidagi barcha importlar e'lon qilingan (${files.length} fayl)`);
}

// ---------------------------------------------------------------- natija
for (const o of ok) console.log(`  OK    ${o}`);
if (problems.length) {
  console.error('\nVERCEL KONFIGURATSIYA TEKSHIRUVI YIQILDI:\n');
  for (const p of problems) console.error(`  XATO  ${p}\n`);
  console.error('Batafsil: docs/status/sec15-audit.md — "Vercel operatori uchun".');
  process.exit(1);
}
console.log('\ncheck:vercel-config — hammasi joyida.');
