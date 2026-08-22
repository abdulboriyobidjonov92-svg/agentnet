#!/usr/bin/env node
/**
 * V3-P0 EXIT GATE G0.3 — "Har 17 konnektorda sarf limiti VA rate limit
 * sozlangan: 17/17".
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` P0-6 §16.
 * Spetsifikatsiya: `docs/strategy/SAFETY_POLICY_LAYER.md` §3.1/§3.2.
 *
 * NEGA ALOHIDA SKRIPT (jest testi emas): bu **gate**, feature testi emas.
 * U CI'da va qo'lda bir xil buyruq bilan ishlaydi, chiqishi esa gate
 * hisobotiga tushadigan shaklda ("17/17 OK"). Jest natijasi bunday
 * o'qilmaydi.
 *
 * Manbani TypeScript'dan o'qimaymiz (kompilyatsiya kerak bo'lardi) —
 * konnektor fayllarini matn sifatida tekshiramiz. Bu ataylab: gate
 * build holatiga bog'liq bo'lmasligi kerak.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'src', 'connectors', 'connectors');
const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** SAFETY §3.2 — konnektor turi bo'yicha MINIMAL tier. Pastroq bo'lsa gate yiqiladi. */
const MIN_TIER_BY_CATEGORY = {
  payments: 'CRITICAL',
  government: 'CRITICAL',
  accounting: 'CRITICAL',
  messaging: 'HIGH',
  crm: 'HIGH',
  ecommerce: 'HIGH',
  logistics: 'LOW',
  data: 'LOW',
};

const files = readdirSync(DIR).filter((f) => f.endsWith('.connector.ts'));
const problems = [];
let checked = 0;

for (const file of files) {
  const src = readFileSync(join(DIR, file), 'utf8');
  const id = src.match(/\bid:\s*'([^']+)'/)?.[1] ?? file;
  const category = src.match(/\bcategory:\s*'([^']+)'/)?.[1];
  const fail = (msg) => problems.push(`${id}: ${msg}`);

  checked += 1;

  if (!/\blimits:\s*\{/.test(src)) {
    fail('`limits` bloki YO‘Q');
    continue;
  }

  // rateLimit — majburiy va musbat.
  const rl = src.match(/rateLimit:\s*\{\s*max:\s*(\d+),\s*windowSec:\s*(\d+)\s*\}/);
  if (!rl) fail('`rateLimit` yo‘q yoki shakli noto‘g‘ri');
  else if (Number(rl[1]) <= 0 || Number(rl[2]) <= 0) fail('`rateLimit` musbat bo‘lishi shart');

  // dailySpendCap — majburiy MAYDON (qiymati `null` bo'lishi mumkin, lekin
  // maydonning O'ZI bo'lishi shart: "e'tibordan chetda qolgan" holatni
  // "ataylab null" dan ajratish uchun).
  const capMatch = src.match(/dailySpendCap:\s*(null|\{[^}]*\})/);
  if (!capMatch) fail('`dailySpendCap` maydoni yo‘q');
  else if (capMatch[1] !== 'null') {
    const amount = capMatch[1].match(/amount:\s*([\d_]+)/)?.[1];
    const unit = capMatch[1].match(/unit:\s*'(tiyin|calls)'/)?.[1];
    if (!amount || Number(amount.replaceAll('_', '')) <= 0) fail('`dailySpendCap.amount` musbat bo‘lishi shart');
    if (!unit) fail("`dailySpendCap.unit` 'tiyin' yoki 'calls' bo‘lishi shart");
  }

  // riskTier — majburiy va §3.2 minimumidan past bo‘lmasin.
  const tier = src.match(/riskTier:\s*'([A-Z]+)'/)?.[1];
  if (!tier || !TIERS.includes(tier)) {
    fail('`riskTier` yo‘q yoki yaroqsiz');
  } else if (category && MIN_TIER_BY_CATEGORY[category]) {
    const min = MIN_TIER_BY_CATEGORY[category];
    if (TIERS.indexOf(tier) < TIERS.indexOf(min)) {
      fail(`riskTier=${tier}, lekin '${category}' uchun SAFETY §3.2 minimumi ${min}`);
    }
  }

  // killable — SAFETY §3.1: doim `true`.
  if (!/killable:\s*true/.test(src)) fail('`killable: true` bo‘lishi SHART (SAFETY §3.1)');

  // reversible — majburiy maydon (qiymati ikkalasi ham bo'lishi mumkin).
  if (!/reversible:\s*(true|false)/.test(src)) fail('`reversible` maydoni yo‘q');
}

const ok = problems.length === 0;
console.log(`G0.3 — konnektor limitlari: ${ok ? checked : checked - problems.length}/${checked} OK`);
if (!ok) {
  console.error('\nMuammolar:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    '\nSAFETY_POLICY_LAYER §3.1/§3.2 ga qarang. Yangi konnektor `limits` blokisiz ' +
      'qo‘shilmaydi (TypeScript ham majburlaydi).',
  );
  process.exit(1);
}
process.exit(0);
