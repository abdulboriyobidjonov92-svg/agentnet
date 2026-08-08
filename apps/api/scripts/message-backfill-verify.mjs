#!/usr/bin/env node
/**
 * A15 — `Conversation.messages` (legacy JSON) va `Message` jadvali
 * MAZMUNAN bir xilligini tekshiradi (runbook: phase3-message-migration.md).
 *
 * Har suhbat uchun: soni, TARTIBI, role, content, halalFlag, demoMode va
 * timestamp (ms aniqlikda) solishtiriladi. Har qanday farq — chiqish kodi 1.
 *
 * Faqat O'QIYDI — hech narsani o'zgartirmaydi. Cutover'dan keyin yozilgan
 * yangi xabarlar legacy JSON'da YO'Q — shuning uchun solishtirish har suhbat
 * JSON'ining uzunligi bo'yicha PREFIKS ustida bajariladi (backfill'dan keyin
 * darhol ishga tushirilsa prefiks = to'liq to'plam).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fail(convId, index, field, expected, actual) {
  console.error(
    `  ✗ suhbat=${convId} xabar#${index} maydon=${field}: JSON=${JSON.stringify(expected)} jadval=${JSON.stringify(actual)}`,
  );
}

async function main() {
  const convs = await prisma.$queryRawUnsafe(
    `SELECT "id", "messages" FROM "Conversation" ORDER BY "id"`,
  );

  let convChecked = 0;
  let msgChecked = 0;
  let problems = 0;

  for (const conv of convs) {
    const json = Array.isArray(conv.messages) ? conv.messages : [];
    if (json.length === 0) continue;
    convChecked++;

    const rows = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: json.length,
    });

    if (rows.length < json.length) {
      console.error(`  ✗ suhbat=${conv.id}: JSON'da ${json.length} xabar, jadvalda ${rows.length}`);
      problems++;
      continue;
    }

    for (let i = 0; i < json.length; i++) {
      msgChecked++;
      const j = json[i];
      const r = rows[i];

      if (j.role !== r.role) { fail(conv.id, i, 'role', j.role, r.role); problems++; }
      if (j.content !== r.content) { fail(conv.id, i, 'content', j.content?.slice(0, 40), r.content?.slice(0, 40)); problems++; }
      if ((j.halalFlag ?? null) !== r.halalFlag) { fail(conv.id, i, 'halalFlag', j.halalFlag ?? null, r.halalFlag); problems++; }
      if (Boolean(j.demoMode) !== r.demoMode) { fail(conv.id, i, 'demoMode', Boolean(j.demoMode), r.demoMode); problems++; }

      const jsonMs = Date.parse(j.timestamp);
      if (jsonMs !== r.createdAt.getTime()) {
        fail(conv.id, i, 'timestamp', j.timestamp, r.createdAt.toISOString());
        problems++;
      }
    }
  }

  // Yetim xabarlar (FK buni imkonsiz qiladi — baribir isbotlaymiz)
  const orphans = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Message" m
     WHERE NOT EXISTS (SELECT 1 FROM "Conversation" c WHERE c."id" = m."conversationId")`,
  );
  if (orphans[0].n > 0) {
    console.error(`  ✗ ${orphans[0].n} ta yetim xabar (suhbatsiz)`);
    problems++;
  }

  // Dublikat backfill-id (qayta ishga tushirishga qarshi himoya isboti)
  const dups = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT "id" FROM "Message" GROUP BY "id" HAVING COUNT(*) > 1
     ) d`,
  );
  if (dups[0].n > 0) {
    console.error(`  ✗ ${dups[0].n} ta dublikat xabar id`);
    problems++;
  }

  console.log(
    `\nSuhbatlar: ${convChecked} · solishtirilgan xabarlar: ${msgChecked} · yetim: ${orphans[0].n} · dublikat: ${dups[0].n}`,
  );

  if (problems > 0) {
    console.error(`\n❌ ${problems} ta nomuvofiqlik — backfill TASDIQLANMADI.`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ Legacy JSON va Message jadvali mazmunan AYNAN mos.');
  }
}

main()
  .catch((e) => {
    console.error('XATO:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
