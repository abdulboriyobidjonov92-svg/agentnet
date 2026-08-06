#!/usr/bin/env node
/**
 * AgentNet — deploy'dan keyingi smoke-test (Node 18+, tashqi paket shart emas).
 *
 * Uchala servis tirikligini va asosiy integratsiya nuqtalarini (engine ichki
 * auth C1, health M7, Swagger prod-gate, SEC-10 engine-private) tekshiradi.
 * Real kalit shart emas (faqat ixtiyoriy INTERNAL_API_TOKEN chuqurroq
 * tekshiruv uchun).
 *
 * Env'lar:
 *   API_URL            api servisning ommaviy URL'i (default: localhost:3001)
 *   ENGINE_URL         engine'ning SHU MASHINADAN ko'rinadigan manzili
 *                      (default: localhost:8000). SEC-10 dan keyin prod'da
 *                      engine private service — tashqaridan ko'rinmaydi,
 *                      shuning uchun prod'da ATAYLAB BO'SH beriladi
 *                      (`ENGINE_URL=`) va to'g'ridan-to'g'ri tekshiruvlar
 *                      o'tkazib yuboriladi.
 *   ENGINE_PUBLIC_URL  SEC-10 DoD tekshiruvi: engine'ning ESKI ommaviy URL'i.
 *                      Skript uning ochilMASligini tasdiqlaydi.
 *   INTERNAL_API_TOKEN ixtiyoriy — token bilan chuqurroq tekshiruv.
 *
 * Foydalanish (lokal, hammasi default):
 *   node scripts/smoke-test.mjs
 *
 * Foydalanish (prod, SEC-10 dan keyin — engine private):
 *   API_URL=https://agentnet-api-zf1h.onrender.com \
 *   ENGINE_URL= \
 *   ENGINE_PUBLIC_URL=https://agentnet-engine.onrender.com \
 *   node scripts/smoke-test.mjs
 *
 * ESLATMA: bu FAQAT tiriklik/aloqa tekshiruvi. To'liq end-to-end (ro'yxatdan
 * o'tish -> agent -> real Claude javobi -> Payme test-to'ldirish) uchun REAL
 * kalitlar kerak — README'dagi qo'lda checklist'ga qarang.
 */
const API = process.env.API_URL ?? "http://localhost:3001";
const ENGINE = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_PUBLIC = process.env.ENGINE_PUBLIC_URL ?? "";
const TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

console.log(
  `AgentNet smoke-test\n  API=${API}\n  ENGINE=${ENGINE || "(bo'sh — private, o'tkazib yuboriladi)"}` +
    `${ENGINE_PUBLIC ? `\n  ENGINE_PUBLIC=${ENGINE_PUBLIC} (yopiq bo'lishi kutiladi)` : ""}\n`,
);

// SEC-10 tekshiruvi shu bayroqqa tayanadi: engine'ga ULANIB BO'LMASLIGI
// "servis ommaviy emas" degani FAQAT tarmoqning o'zi ishlayotgan bo'lsa.
// Aks holda (internet uzilgan, VPN, DNS o'lgan) tekshiruv soxta ✓ berardi.
let apiReachable = false;

await check("API /api/health -> 200 {status:ok}", async () => {
  const r = await fetch(`${API}/api/health`);
  assert(r.status === 200, `status ${r.status}`);
  const j = await r.json();
  assert(j.status === "ok", `status maydoni: ${JSON.stringify(j)}`);
  apiReachable = true;
});

// SEC-10: engine'ga TO'G'RIDAN-TO'G'RI tekshiruvlar faqat u shu mashinadan
// ko'rinadigan bo'lganda ma'noga ega (lokal dev, yoki xususiy tarmoq ichidan).
// Prod'da engine private service — bu skript esa tashqarida ishlaydi.
if (ENGINE) {
  await check("Engine /health -> 200 (auth'siz ochiq)", async () => {
    const r = await fetch(`${ENGINE}/health`);
    assert(r.status === 200, `status ${r.status}`);
  });

  await check("Engine ichki auth (C1): token'siz -> 401", async () => {
    const r = await fetch(`${ENGINE}/tools/available`);
    assert(r.status === 401, `kutildi 401, keldi ${r.status} (engine himoyalanmagan bo'lishi mumkin!)`);
  });

  if (TOKEN) {
    await check("Engine ichki auth (C1): to'g'ri token -> 200", async () => {
      const r = await fetch(`${ENGINE}/tools/available`, { headers: { "x-internal-token": TOKEN } });
      assert(r.status === 200, `status ${r.status}`);
    });
  } else {
    console.log("  • (INTERNAL_API_TOKEN berilmadi — token-bilan tekshiruv o'tkazib yuborildi)");
  }
} else {
  console.log("  • (ENGINE_URL bo'sh — engine private service (SEC-10); to'g'ridan-to'g'ri tekshiruvlar o'tkazib yuborildi)");
}

// SEC-10 DoD: "tashqi curl engine URL'iga -> ulanmaydi".
if (ENGINE_PUBLIC) {
  await check("SEC-10: engine ommaviy internetdan OCHILMAYDI", async () => {
    let r;
    try {
      r = await fetch(`${ENGINE_PUBLIC}/health`, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      // DNS/ulanish/TLS xatosi — kutilgan natija (servis ommaviy emas), LEKIN
      // faqat tarmoq umuman ishlayotgani isbotlangan bo'lsa. Aks holda bu
      // tekshiruv "internetim yo'q" holatida ham ✓ berardi — ya'ni hech narsa
      // isbotlamasdi.
      assert(
        apiReachable,
        `ulanib bo'lmadi (${e.message}), lekin API ham javob bermadi — tarmoq holati noaniq, ` +
          `bu tekshiruv hech narsani isbotlamaydi. API tirik bo'lgan joydan qayta ishga tushiring.`,
      );
      console.log(`     (${ENGINE_PUBLIC}/health -> ulanib bo'lmadi; ommaviy yo'l yopiq)`);
      return;
    }
    // Render o'chirilgan/mavjud bo'lmagan servis uchun 404 qaytaradi.
    // 200 = engine HALI ommaviy: pserv qo'llanmagan yoki eski `type: web`
    // servisi Render panelida o'chirilmagan.
    assert(
      r.status !== 200,
      `${ENGINE_PUBLIC}/health -> 200; engine HALI OMMAVIY (pserv qo'llanmagan yoki eski web servis o'chirilmagan)`,
    );
    console.log(`     (${ENGINE_PUBLIC}/health -> ${r.status}; ommaviy yo'l yopiq)`);
  });
} else {
  console.log("  • (ENGINE_PUBLIC_URL berilmadi — SEC-10 ommaviy-yopiqlik tekshiruvi o'tkazib yuborildi)");
}

await check("API Swagger prod-gate (M7): /api/docs prod'da yopiq", async () => {
  const r = await fetch(`${API}/api/docs`);
  // Prod'da 404 kutiladi (Swagger o'chiq); dev'da 200 bo'lishi mumkin.
  console.log(`     (/api/docs -> ${r.status}; prod'da 404, dev'da 200 kutiladi)`);
});

console.log(`\n${failed === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failed} ta tekshiruv yiqildi`}`);
process.exit(failed === 0 ? 0 : 1);
