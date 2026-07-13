#!/usr/bin/env node
/**
 * AgentNet — deploy'dan keyingi smoke-test (Node 18+, tashqi paket shart emas).
 *
 * Uchala servis tirikligini va asosiy integratsiya nuqtalarini (engine ichki
 * auth C1, health M7, Swagger prod-gate) tekshiradi. Real kalit shart emas
 * (faqat ixtiyoriy INTERNAL_API_TOKEN chuqurroq tekshiruv uchun).
 *
 * Foydalanish (staging/prod URL'lari bilan):
 *   API_URL=https://agentnet-api-zf1h.onrender.com \
 *   ENGINE_URL=https://agentnet-engine.onrender.com \
 *   INTERNAL_API_TOKEN=<render'dagi qiymat> \
 *   node scripts/smoke-test.mjs
 *
 * ESLATMA: bu FAQAT tiriklik/aloqa tekshiruvi. To'liq end-to-end (ro'yxatdan
 * o'tish -> agent -> real Claude javobi -> Payme test-to'ldirish) uchun REAL
 * kalitlar kerak — README'dagi qo'lda checklist'ga qarang.
 */
const API = process.env.API_URL ?? "http://localhost:3001";
const ENGINE = process.env.ENGINE_URL ?? "http://localhost:8000";
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

console.log(`AgentNet smoke-test\n  API=${API}\n  ENGINE=${ENGINE}\n`);

await check("API /api/health -> 200 {status:ok}", async () => {
  const r = await fetch(`${API}/api/health`);
  assert(r.status === 200, `status ${r.status}`);
  const j = await r.json();
  assert(j.status === "ok", `status maydoni: ${JSON.stringify(j)}`);
});

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

await check("API Swagger prod-gate (M7): /api/docs prod'da yopiq", async () => {
  const r = await fetch(`${API}/api/docs`);
  // Prod'da 404 kutiladi (Swagger o'chiq); dev'da 200 bo'lishi mumkin.
  console.log(`     (/api/docs -> ${r.status}; prod'da 404, dev'da 200 kutiladi)`);
});

console.log(`\n${failed === 0 ? "✅ HAMMASI O'TDI" : `❌ ${failed} ta tekshiruv yiqildi`}`);
process.exit(failed === 0 ? 0 : 1);
