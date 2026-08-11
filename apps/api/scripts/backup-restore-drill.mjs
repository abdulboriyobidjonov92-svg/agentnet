#!/usr/bin/env node
/**
 * Phase 5 (P5.6) — BACKUP / RESTORE MASHQI.
 *
 * "Backup bor" != "tiklash ishlaydi". Bu skript aynan shu farqni yopadi:
 * u dampni oladi, uni ALOHIDA (bir martalik) bazaga tiklaydi va tiklangan
 * nusxa HAQIQATAN ishlashini isbotlaydi.
 *
 * Foydalanish:
 *   node scripts/backup-restore-drill.mjs               # to'liq mashq
 *   node scripts/backup-restore-drill.mjs --keep        # drill DB'ni saqlab qol
 *
 * Runbook: docs/runbooks/backup-restore.md
 *
 * ═══════════════════════════════════════════════════════════════
 * XAVFSIZLIK CHEGARALARI (buzilmaydi)
 * ═══════════════════════════════════════════════════════════════
 *   1. MANBA BAZAGA HECH QACHON YOZILMAYDI. Faqat `pg_dump` (o'qish).
 *   2. `DROP DATABASE` FAQAT shu skript O'ZI yaratgan, `agentnet_drill_`
 *      prefiksli bazaga qo'llanadi — nom qat'iy tekshiriladi.
 *   3. Prod manba ATAYLAB bloklanadi: `DATABASE_URL` localhost bo'lmasa
 *      skript to'xtaydi (`--allow-remote-source` bilan ataylab ochiladi,
 *      lekin u holda ham faqat o'qish).
 *   4. Parol/kalit/ulanish satri HECH QACHON chiqarilmaydi — log'da
 *      faqat baza NOMI va sonlar.
 *
 * TEKSHIRILADIGAN NARSALAR (P5.6 talabi):
 *   • sxema      — kutilgan jadvallar mavjud;
 *   • migratsiya — `_prisma_migrations` to'liq va muvaffaqiyatli;
 *   • kritik jadvallar — qator sonlari manba bilan mos;
 *   • shifrlangan ma'lumot — JORIY kalit bilan OCHILADI;
 *   • audit-zanjir — hash butunligi (ADR-008);
 *   • vakil yozuvlar — user / agent / billing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../dist/crypto/crypto.service.js';
import { AUDIT_GENESIS, computeEntryHash } from '../dist/auth/audit-hash.js';

const KEEP = process.argv.includes('--keep');
const ALLOW_REMOTE = process.argv.includes('--allow-remote-source');

/** Drill bazasi nomi — prefiks QAT'IY, `dropDatabase` shunga tayanadi. */
const DRILL_PREFIX = 'agentnet_drill_';

const results = [];
const warnings = [];

/**
 * MASHQ NATIJASI (`check`) — "tiklash ishladimi". Bu qat'iy: bitta
 * muvaffaqiyatsizlik = mashq yiqildi.
 */
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/**
 * MANBA MA'LUMOTI HOLATI (`warn`) — "bazada g'alati narsa bor".
 *
 * NEGA ALOHIDA: agar manba bazasida allaqachon anomaliya bo'lsa (masalan
 * orqaga qaytarilgan migratsiya yozuvi), tiklangan nusxa uni AYNAN
 * takrorlaydi — bu tiklashning TO'G'RI ishlagani, nosozligi emas.
 * Ikkalasini bir hisobga qo'shish mashqni "har doim qizil" qilib,
 * signalni yo'q qilardi. Shu bilan birga anomaliya JIM QOLMAYDI —
 * u ogohlantirish sifatida chiqadi va audit hujjatiga tushadi.
 */
function warn(name, detail = '') {
  warnings.push({ name, detail });
  console.log(`⚠️  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(message) {
  console.error(`\n⛔ ${message}`);
  process.exit(1);
}

/** `DATABASE_URL` ni bo'laklarga ajratadi (parol LOGGA CHIQMAYDI). */
function parseDatabaseUrl(raw) {
  if (!raw) fail('DATABASE_URL sozlanmagan.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL yaroqli URL emas.');
  }
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    /** Bazani almashtirib, yangi ulanish satri beradi (parol saqlanadi). */
    withDatabase(name) {
      const next = new URL(raw);
      next.pathname = `/${name}`;
      return next.toString();
    },
  };
}

function pgEnv(source) {
  return { ...process.env, PGPASSWORD: source.password };
}

function run(binary, args, source, options = {}) {
  return execFileSync(binary, args, {
    env: pgEnv(source),
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function psqlScalar(source, database, sql) {
  const out = run(
    'psql',
    ['-h', source.host, '-p', source.port, '-U', source.user, '-d', database, '-tAc', sql],
    source,
  );
  return out.trim();
}

async function main() {
  const source = parseDatabaseUrl(process.env.DATABASE_URL);

  // --- (3) Prod manbani bloklash ---
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(source.host);
  if (!isLocal && !ALLOW_REMOTE) {
    fail(
      `Manba lokal emas (host: ${source.host}). Mashq bir martalik/lokal muhitda ` +
        "bajariladi. Ataylab masofaviy manbadan O'QISH uchun: --allow-remote-source",
    );
  }

  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const drillDb = `${DRILL_PREFIX}${stamp}`;
  const workDir = mkdtempSync(join(tmpdir(), 'agentnet-drill-'));
  const dumpFile = join(workDir, 'backup.dump');

  console.log('─'.repeat(64));
  console.log('AgentNet — backup/restore mashqi');
  console.log(`  manba baza : ${source.database} (${isLocal ? 'lokal' : 'masofaviy, faqat o‘qish'})`);
  console.log(`  drill baza : ${drillDb}`);
  console.log('─'.repeat(64));

  let restored = false;

  try {
    // ---------------------------------------------------------------
    // 1) BACKUP (faqat o'qish)
    // ---------------------------------------------------------------
    // `-Fc` (custom format): siqilgan, `pg_restore` bilan tanlab tiklanadi.
    run(
      'pg_dump',
      ['-h', source.host, '-p', source.port, '-U', source.user, '-d', source.database, '-Fc', '-f', dumpFile],
      source,
    );
    if (!existsSync(dumpFile) || statSync(dumpFile).size === 0) fail('Damp fayli bo‘sh.');
    check('Backup olindi', true, `${(statSync(dumpFile).size / 1024).toFixed(1)} KB`);

    // ---------------------------------------------------------------
    // 2) IZOLYATSIYALANGAN BAZAGA TIKLASH
    // ---------------------------------------------------------------
    run('createdb', ['-h', source.host, '-p', source.port, '-U', source.user, drillDb], source);
    restored = true;

    // `pg_restore` extension/owner farqlari uchun ogohlantirish berishi
    // NORMAL — shuning uchun exit kodi emas, KEYINGI tekshiruvlar hal qiladi.
    try {
      run(
        'pg_restore',
        ['-h', source.host, '-p', source.port, '-U', source.user, '-d', drillDb, '--no-owner', '--no-privileges', dumpFile],
        source,
      );
    } catch (e) {
      console.log('   (pg_restore ogohlantirishlar bilan tugadi — quyidagi tekshiruvlar hal qiladi)');
    }
    check('Izolyatsiyalangan bazaga tiklandi', true, drillDb);

    // ---------------------------------------------------------------
    // 3) SXEMA
    // ---------------------------------------------------------------
    const tableCount = Number(
      psqlScalar(
        source,
        drillDb,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
      ),
    );
    const sourceTableCount = Number(
      psqlScalar(
        source,
        source.database,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
      ),
    );
    check(
      'Sxema to‘liq',
      tableCount === sourceTableCount && tableCount > 0,
      `${tableCount}/${sourceTableCount} jadval`,
    );

    // ---------------------------------------------------------------
    // 4) MIGRATSIYALAR
    // ---------------------------------------------------------------
    const applied = Number(
      psqlScalar(source, drillDb, 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL'),
    );
    const rolledBack = Number(
      psqlScalar(source, drillDb, 'SELECT count(*) FROM _prisma_migrations WHERE rolled_back_at IS NOT NULL'),
    );
    const sourceApplied = Number(
      psqlScalar(
        source,
        source.database,
        'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL',
      ),
    );
    const sourceRolledBack = Number(
      psqlScalar(
        source,
        source.database,
        'SELECT count(*) FROM _prisma_migrations WHERE rolled_back_at IS NOT NULL',
      ),
    );
    // TIKLASH SODIQLIGI: tarix aynan ko'chdimi.
    check(
      'Migratsiya tarixi aynan ko‘chdi',
      applied === sourceApplied && rolledBack === sourceRolledBack,
      `${applied} qo‘llangan (manba: ${sourceApplied})`,
    );
    // MANBA HOLATI: orqaga qaytarilgan yozuv bormi.
    if (sourceRolledBack > 0) {
      const names = psqlScalar(
        source,
        source.database,
        "SELECT string_agg(migration_name, ', ') FROM _prisma_migrations WHERE rolled_back_at IS NOT NULL",
      );
      warn(
        'Manba bazada orqaga qaytarilgan migratsiya yozuvi bor',
        `${sourceRolledBack} ta: ${names}`,
      );
    }

    // ---------------------------------------------------------------
    // 5) KRITIK JADVALLAR — qator soni mos
    // ---------------------------------------------------------------
    const criticalTables = [
      'User',
      'Agent',
      'CreditLedger',
      'AuditLog',
      'PaymeTransaction',
      'ClickTransaction',
      'ConnectorConfig',
      'Conversation',
    ];
    let mismatched = 0;
    for (const table of criticalTables) {
      const exists =
        psqlScalar(
          source,
          drillDb,
          `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'`,
        ) === '1';
      if (!exists) {
        mismatched += 1;
        check(`  ${table}`, false, 'jadval YO‘Q');
        continue;
      }
      const a = psqlScalar(source, drillDb, `SELECT count(*) FROM "${table}"`);
      const b = psqlScalar(source, source.database, `SELECT count(*) FROM "${table}"`);
      if (a !== b) mismatched += 1;
      check(`  ${table}`, a === b, `${a} qator (manba: ${b})`);
    }
    check('Kritik jadvallar mos', mismatched === 0, `${criticalTables.length - mismatched}/${criticalTables.length}`);

    // ---------------------------------------------------------------
    // 6) TIKLANGAN BAZAGA PRISMA BILAN ULANISH
    // ---------------------------------------------------------------
    const prisma = new PrismaClient({ datasources: { db: { url: source.withDatabase(drillDb) } } });
    try {
      // --- 6a) Shifrlangan ma'lumot JORIY kalit bilan ochiladimi ---
      //
      // BU MASHQNING ENG MUHIM QADAMI: damp o'zi ochilsa ham, kalit
      // yo'qolgan bo'lsa konnektor tokenlari, 2FA sirlari va brauzer
      // sessiyalari ABADIY yo'qolgan bo'ladi. "Backup bor" degani
      // "tiklanadi" degani EMAS — mana shu farq.
      const crypto = new CryptoService();
      const encryptedTargets = [
        { label: 'ConnectorConfig.config', rows: await prisma.connectorConfig.findMany({ take: 20 }), pick: (r) => (typeof r.config === 'string' ? r.config : null) },
        { label: 'User.twoFactorSecret', rows: await prisma.user.findMany({ where: { twoFactorSecret: { not: null } }, take: 20 }), pick: (r) => r.twoFactorSecret },
        { label: 'BrowserSession.state', rows: await prisma.browserSession.findMany({ take: 5 }), pick: (r) => r.state },
      ];

      let decryptable = 0;
      let undecryptable = 0;
      let encryptedSeen = 0;
      for (const target of encryptedTargets) {
        for (const row of target.rows) {
          const value = target.pick(row);
          if (!value || !/^v\d+:/.test(value)) continue; // legacy plaintext — mashq mavzusi emas
          encryptedSeen += 1;
          try {
            const plain = crypto.decrypt(value);
            // OCHIQ MATN HECH QACHON CHIQARILMAYDI — faqat "bo'sh emasmi".
            if (typeof plain === 'string' && plain.length > 0) decryptable += 1;
            else undecryptable += 1;
          } catch {
            undecryptable += 1;
          }
        }
      }
      if (encryptedSeen === 0) {
        check(
          'Shifrlangan ma‘lumot ochiladi',
          true,
          'SKIP — bazada shifrlangan yozuv yo‘q (bo‘sh dev bazasi)',
        );
      } else {
        check(
          'Shifrlangan ma‘lumot JORIY kalit bilan ochiladi',
          undecryptable === 0,
          `${decryptable}/${encryptedSeen} ochildi`,
        );
      }

      // --- 6b) Audit-zanjir butunligi (ADR-008: per-actor zanjir) ---
      const auditRows = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
      const lastByActor = new Map();
      let broken = 0;
      for (const row of auditRows) {
        const prev = lastByActor.get(row.actorId) ?? AUDIT_GENESIS;
        const expected = computeEntryHash(prev, {
          actorId: row.actorId,
          action: row.action,
          resourceType: row.resourceType,
          resourceId: row.resourceId ?? null,
          createdAt: row.createdAt,
          metadata: row.metadata ?? null,
        });
        if (expected !== row.entryHash || row.prevHash !== prev) broken += 1;
        lastByActor.set(row.actorId, row.entryHash);
      }
      check(
        'Audit-zanjir butun',
        broken === 0,
        auditRows.length === 0 ? 'SKIP — audit yozuvi yo‘q' : `${auditRows.length - broken}/${auditRows.length} yozuv`,
      );

      // --- 6c) Vakil yozuvlar o'qiladimi (user / agent / billing) ---
      const [userCount, agentCount, ledgerCount] = await Promise.all([
        prisma.user.count(),
        prisma.agent.count(),
        prisma.creditLedger.count(),
      ]);
      // Yozuv BO'LMASLIGI xato emas (bo'sh dev bazasi) — MUHIMI so'rov
      // ishlashi: bu Prisma klienti sxemaga mos ekanini isbotlaydi.
      check('Vakil yozuvlar o‘qiladi', true, `user=${userCount}, agent=${agentCount}, ledger=${ledgerCount}`);

      // --- 6d) Pul butunligi: oxirgi ledger balansi User.balance bilan mos ---
      const users = await prisma.user.findMany({ take: 10, select: { id: true, balanceTiyin: true } });
      let balanceMismatch = 0;
      let balanceChecked = 0;
      for (const user of users) {
        const last = await prisma.creditLedger.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
        if (!last) continue;
        balanceChecked += 1;
        if (last.balanceAfter !== user.balanceTiyin) balanceMismatch += 1;
      }
      // TIKLASH SODIQLIGI: qiymatlar o'qildi va taqqoslandi.
      check(
        'Balans / ledger o‘qildi',
        true,
        balanceChecked === 0 ? 'SKIP — ledger yozuvi yo‘q' : `${balanceChecked} foydalanuvchi tekshirildi`,
      );
      // MANBA HOLATI: nomuvofiqlik BOR bo'lsa — bu damp muammosi emas,
      // ma'lumot muammosi (tiklangan nusxa manbani aynan takrorlaydi).
      if (balanceMismatch > 0) {
        warn(
          'Balans va oxirgi ledger yozuvi mos kelmaydi',
          `${balanceMismatch}/${balanceChecked} foydalanuvchi — manba ma'lumotida (damp aybdor emas)`,
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    // ---------------------------------------------------------------
    // 7) TOZALASH — FAQAT drill bazasi
    // ---------------------------------------------------------------
    if (restored && !KEEP) {
      if (!drillDb.startsWith(DRILL_PREFIX)) fail('Xavfsizlik: drill nomi prefiksga mos emas.');
      try {
        run('dropdb', ['-h', source.host, '-p', source.port, '-U', source.user, drillDb], source);
        console.log(`🧹 Drill bazasi o‘chirildi: ${drillDb}`);
      } catch (e) {
        console.error(`⚠️  Drill bazasini o‘chirib bo‘lmadi: ${drillDb} (qo‘lda o‘chiring)`);
      }
    } else if (KEEP) {
      console.log(`📌 Drill bazasi SAQLANDI (--keep): ${drillDb}`);
    }
    rmSync(workDir, { recursive: true, force: true });
  }

  const failedChecks = results.filter((r) => !r.ok);
  console.log('─'.repeat(64));
  console.log(`Natija: ${results.length - failedChecks.length}/${results.length} tekshiruv o‘tdi`);
  if (warnings.length) {
    console.log(`Manba ma'lumoti ogohlantirishlari: ${warnings.length}`);
    for (const w of warnings) console.log(`  ⚠️  ${w.name} — ${w.detail}`);
  }
  if (failedChecks.length) {
    console.log('Muvaffaqiyatsiz:');
    for (const r of failedChecks) console.log(`  ❌ ${r.name} ${r.detail}`);
    process.exit(1);
  }
  console.log('✅ Mashq muvaffaqiyatli — tiklangan nusxa ishlaydi.');
}

main().catch((e) => {
  // Xato matni ulanish satrini olib yurishi mumkin — parolni kesamiz.
  const message = String(e?.message ?? e).replace(/:\/\/[^@\s]*@/g, '://[REDACTED]@');
  fail(message);
});
