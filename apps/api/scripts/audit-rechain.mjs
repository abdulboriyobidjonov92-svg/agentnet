#!/usr/bin/env node
/**
 * A17 / ADR-008 — audit hash-zanjirini KANONIK formatga o'tkazish va tekshirish.
 *
 * Zanjir endi PER-ACTOR: har aktorning yozuvlari `seq` bo'yicha o'z zanjirini
 * hosil qiladi (`prevHash` = shu aktordagi oldingi yozuvning `entryHash`i,
 * birinchisi uchun `GENESIS`).
 *
 * Hash FAQAT saqlangan ustun qiymatlaridan hisoblanadi — logika
 * `apps/api/src/auth/audit-hash.ts` dan IMPORT qilinadi (nusxalanmaydi),
 * shuning uchun skript va ish-vaqti hech qachon ayrilib keta olmaydi.
 *
 * Foydalanish:
 *   node scripts/audit-rechain.mjs --verify   # faqat tekshiradi, yozmaydi
 *   node scripts/audit-rechain.mjs --apply    # qayta hisoblab yozadi
 *
 * `--apply` dan OLDIN `20260807140000_phase3_audit_chain_backup` migratsiyasi
 * qo'llanilgan bo'lishi SHART (eski hash'lar nusxasi — rollback uchun).
 */
import { PrismaClient } from '@prisma/client';
import { AUDIT_GENESIS, computeEntryHash } from '../dist/auth/audit-hash.js';

const mode = process.argv.includes('--apply') ? 'apply' : 'verify';
const prisma = new PrismaClient();

async function main() {
  if (mode === 'apply') {
    const backup = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name = 'AuditLogHashBackup'`,
    );
    if (!backup[0].n) {
      throw new Error(
        "Nusxa-jadval yo'q: avval `npx prisma migrate deploy` bilan " +
          '20260807140000_phase3_audit_chain_backup migratsiyasini qo\'llang.',
      );
    }
  }

  const actors = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "actorId" FROM "AuditLog" ORDER BY 1`,
  );

  let total = 0;
  let changed = 0;
  let broken = 0;

  for (const { actorId } of actors) {
    const rows = await prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { seq: 'asc' },
    });

    let prevHash = AUDIT_GENESIS;
    for (const row of rows) {
      total++;
      const entryHash = computeEntryHash(prevHash, row);

      if (mode === 'apply') {
        if (row.prevHash !== prevHash || row.entryHash !== entryHash) {
          await prisma.auditLog.update({
            where: { id: row.id },
            data: { prevHash, entryHash },
          });
          changed++;
        }
      } else if (row.prevHash !== prevHash || row.entryHash !== entryHash) {
        broken++;
        if (broken <= 5) {
          console.log(
            `  ✗ seq=${row.seq} actor=${actorId} action=${row.action} — ` +
              (row.prevHash !== prevHash ? 'prevHash mos emas' : 'entryHash mos emas'),
          );
        }
      }

      prevHash = entryHash;
    }
  }

  console.log(
    `\nAktorlar: ${actors.length} · yozuvlar: ${total} · ` +
      (mode === 'apply' ? `yangilandi: ${changed}` : `mos kelmadi: ${broken}`),
  );

  if (mode === 'verify' && broken > 0) {
    console.error('\n❌ Zanjir tasdiqlanmadi.');
    process.exitCode = 1;
  } else {
    console.log(mode === 'apply' ? '\n✅ Rechain tugadi — endi --verify bilan tasdiqlang.' : '\n✅ Zanjir butun.');
  }
}

main()
  .catch((e) => {
    console.error('XATO:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
