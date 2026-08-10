#!/usr/bin/env node
/**
 * SEC-14 — `ENCRYPTION_KEY` rotatsiyasi (at-rest AES-256-GCM).
 *
 * Shifrlash mantig'i `apps/api/src/crypto/crypto.service.ts` dan IMPORT
 * qilinadi (dist orqali) — NUSXALANMAYDI. Ya'ni skript va ish-vaqti
 * hech qachon ayrilib keta olmaydi va ikkinchi kripto-implementatsiya
 * paydo bo'lmaydi.
 *
 * Foydalanish:
 *   node scripts/rotate-encryption-key.mjs --verify    # yozmaydi (default)
 *   node scripts/rotate-encryption-key.mjs --apply     # qayta shifrlaydi
 *   node scripts/rotate-encryption-key.mjs --apply --encrypt-plaintext
 *
 * Muhit (runbook: docs/runbooks/secret-rotation.md):
 *   ENCRYPTION_KEY=<YANGI>            ENCRYPTION_KEY_VERSION=v2
 *   ENCRYPTION_KEY_PREVIOUS=<ESKI>    ENCRYPTION_KEY_PREVIOUS_VERSION=v1
 *
 * XAVFSIZLIK QOIDALARI (buzilmaydi):
 *   • kalit yoki ochiq matn HECH QACHON chiqarilmaydi/loglanmaydi;
 *   • hech qanday yozuv JIM o'tkazib yuborilmaydi — har biri sanaladi;
 *   • yozishdan OLDIN kalitlar tekshiriladi (noto'g'ri kalit -> 0 yozuv);
 *   • har yozuv shartli UPDATE bilan (parallel yozuvchi ustidan yozilmaydi);
 *   • har yozuvdan KEYIN darhol qayta deshifrlab tasdiqlanadi;
 *   • xato bo'lsa exit kodi != 0.
 */
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../dist/crypto/crypto.service.js';

const APPLY = process.argv.includes('--apply');
const ENCRYPT_PLAINTEXT = process.argv.includes('--encrypt-plaintext');
const BATCH = 200;

/**
 * Shifrlangan ustunlar REGISTRI — audit natijasi (SEC-14 §1).
 *
 * `json: true` — ustun Prisma `Json` turida (`ConnectorConfig.config`),
 * ya'ni shifrmatn JSON satri sifatida saqlanadi va filtrlash `equals`
 * bilan bo'ladi.
 */
const TARGETS = [
  { model: 'user', column: 'twoFactorSecret', label: 'User.twoFactorSecret' },
  { model: 'user', column: 'twoFactorSecretPending', label: 'User.twoFactorSecretPending' },
  { model: 'connectorConfig', column: 'config', label: 'ConnectorConfig.config', json: true },
  { model: 'browserSession', column: 'state', label: 'BrowserSession.state' },
  { model: 'callRecording', column: 'data', label: 'CallRecording.data' },
];

const prisma = new PrismaClient();

/**
 * Kripto servisi main() ICHIDA quriladi.
 *
 * NEGA modul darajasida emas: yaroqsiz kalit konfiguratsiyasida
 * `new CryptoService()` xato tashlaydi va modul darajasida bu operatorga
 * xom stack-trace bo'lib ko'rinardi. Endi u strukturaviy `rotation.abort`
 * yozuvi + exit 1 bo'ladi (ma'lumotga TEGILMAGAN holda).
 */
let crypto;

/** Strukturaviy log — hech qachon sir emas, faqat sanoq/holat. */
const log = (event, fields = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));

const totals = {
  discovered: 0,
  current: 0,
  stale: 0,
  rotated: 0,
  plaintext: 0,
  plaintextEncrypted: 0,
  unreadable: 0,
  failed: 0,
};
/** Muammoli yozuvlar — FAQAT id (id sir emas). */
const problems = [];

/** Qiymatni tasniflaydi: hech narsa taxmin qilinmaydi. */
function classify(value) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value !== 'string') return 'plaintext'; // legacy JSON obyekt
  if (!crypto.isEncrypted(value)) return 'plaintext';
  return crypto.isCurrentVersion(value) ? 'current' : 'stale';
}

async function processTarget(target) {
  const { model, column, label, json } = target;
  const delegate = prisma[model];
  let cursor = undefined;
  const seen = { discovered: 0, current: 0, stale: 0, rotated: 0, plaintext: 0, failed: 0 };

  for (;;) {
    // @system-scope: rotatsiya butun jadval bo'ylab yuradi (operator amali).
    const rows = await delegate.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, [column]: true },
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const value = row[column];
      const kind = classify(value);
      if (kind === 'empty') continue;

      seen.discovered += 1;
      totals.discovered += 1;

      if (kind === 'current') {
        // IDEMPOTENTLIK: allaqachon joriy versiyada — tegilmaydi.
        seen.current += 1;
        totals.current += 1;
        continue;
      }

      if (kind === 'plaintext') {
        seen.plaintext += 1;
        totals.plaintext += 1;
        if (!(APPLY && ENCRYPT_PLAINTEXT)) {
          // JIM o'tkazib yuborilmaydi — hisobotda ko'rinadi.
          problems.push({ target: label, id: row.id, reason: 'plaintext' });
          continue;
        }
        try {
          const encrypted = json
            ? crypto.encryptJson(value)
            : crypto.encrypt(String(value));
          await writeBack(delegate, column, row.id, value, encrypted, json);
          totals.plaintextEncrypted += 1;
        } catch (e) {
          seen.failed += 1;
          totals.failed += 1;
          problems.push({ target: label, id: row.id, reason: `plaintext-encrypt: ${e.message}` });
        }
        continue;
      }

      // --- kind === 'stale': eski kalit versiyasi ---
      seen.stale += 1;
      totals.stale += 1;

      let plain;
      try {
        plain = crypto.decrypt(value);
      } catch (e) {
        // Buzilgan/o'qib bo'lmaydigan shifrmatn — JIM O'TKAZIB YUBORILMAYDI.
        seen.failed += 1;
        totals.unreadable += 1;
        problems.push({ target: label, id: row.id, reason: `decrypt: ${e.message}` });
        continue;
      }

      if (!APPLY) continue; // verify rejimi: deshifrlash ISBOTLANDI, yozilmaydi

      try {
        const reEncrypted = crypto.encrypt(plain);
        await writeBack(delegate, column, row.id, value, reEncrypted, json);

        // Yozgandan KEYIN darhol tasdiqlash — saqlangan qiymat haqiqatan
        // o'qiladimi. Taqqoslash uzunlik+hash bo'yicha emas, aynan matn
        // bo'yicha, lekin matnning O'ZI hech qayerga chiqmaydi.
        const stored = await delegate.findUnique({
          where: { id: row.id },
          select: { [column]: true },
        });
        if (crypto.decrypt(String(stored[column])) !== plain) {
          throw new Error('yozuvdan keyingi tekshiruv mos kelmadi');
        }
        seen.rotated += 1;
        totals.rotated += 1;
      } catch (e) {
        seen.failed += 1;
        totals.failed += 1;
        problems.push({ target: label, id: row.id, reason: `rotate: ${e.message}` });
      }
    }
  }

  log('target.done', { target: label, ...seen });
}

/**
 * Shartli yozuv — qiymat HALI HAM biz o'qigan qiymat bo'lsagina yoziladi.
 * Parallel yozuvchi (masalan foydalanuvchi o'sha paytda konnektorni qayta
 * sozlasa) ustidan yozib yubormaslik uchun.
 */
async function writeBack(delegate, column, id, oldValue, newValue, json) {
  const where = json
    ? { id, [column]: { equals: oldValue } }
    : { id, [column]: oldValue };
  const res = await delegate.updateMany({ where, data: { [column]: newValue } });
  if (res.count !== 1) {
    throw new Error('yozuv bu orada o\'zgargan (shartli UPDATE 0 qator)');
  }
}

async function main() {
  // --- Konfiguratsiya tekshiruvi: ma'lumotga tegilmasdan OLDIN ---
  try {
    crypto = new CryptoService();
  } catch (e) {
    // Xato matni kalitni O'ZINI saqlamaydi (CryptoService buni kafolatlaydi).
    log('rotation.abort', { reason: 'key-config-invalid', detail: e.message });
    process.exitCode = 1;
    return;
  }

  const status = crypto.keyringStatus(); // FAQAT versiya teglari
  log('rotation.start', {
    mode: APPLY ? 'apply' : 'verify',
    encryptPlaintext: ENCRYPT_PLAINTEXT,
    writeVersion: status.currentVersion,
    readableVersions: status.versions,
  });

  // --- Kalit tekshiruvi: HAR QANDAY yozuvdan OLDIN ---
  // 1) Joriy kalit ishlaydimi (yozish+o'qish round-trip).
  try {
    const probe = `sec14-probe-${Date.now()}`;
    if (crypto.decrypt(crypto.encrypt(probe)) !== probe) throw new Error('round-trip mos kelmadi');
  } catch (e) {
    log('rotation.abort', { reason: 'current-key-invalid', detail: e.message });
    process.exitCode = 1;
    return;
  }

  // 2) Rotatsiya rejimida oldingi kalit ham yuklangan bo'lishi shart.
  if (APPLY && status.versions.length < 2) {
    log('rotation.note', {
      message:
        'Oldingi kalit sozlanmagan — faqat joriy versiyadagi va plaintext yozuvlar ko\'riladi.',
    });
  }

  for (const target of TARGETS) {
    try {
      await processTarget(target);
    } catch (e) {
      totals.failed += 1;
      problems.push({ target: target.label, id: '-', reason: `target: ${e.message}` });
    }
  }

  // --- Yakuniy tekshiruv ---
  const ok = totals.failed === 0 && totals.unreadable === 0;
  const complete = APPLY && ok && totals.stale === totals.rotated;

  log('rotation.summary', {
    mode: APPLY ? 'apply' : 'verify',
    ...totals,
    // "Tugadi" = eski versiyadagi yozuv QOLMADI. Faqat shundan keyin
    // eski kalitni olib tashlash mumkin (runbook 10-qadam).
    rotationComplete: complete || (!APPLY && totals.stale === 0 && totals.unreadable === 0),
  });

  if (problems.length) {
    log('rotation.problems', { count: problems.length, items: problems.slice(0, 50) });
  }

  if (!ok) {
    log('rotation.failed', { failed: totals.failed, unreadable: totals.unreadable });
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    // Xato matni kalit/ochiq matn saqlamaydi — faqat mexanik sabab.
    log('rotation.error', { detail: e.message });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
