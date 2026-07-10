import { test, expect, type Page } from '@playwright/test';
import { topUpBalance, disconnectPrisma } from './helpers/db';

/**
 * Ssenariy: foydalanuvchi tizimga kiradi (lokal dev-login, Clerk'siz) va
 * no-code interfeys orqali yangi AI-agent yaratadi.
 *
 * 1) /sign-up — email bilan ro'yxatdan o'tish (yangi foydalanuvchi)
 * 2) yangi hisob -> /onboarding'ga yo'naltiriladi -> "Skip for now"
 * 3) /agents/new — sahifaning pastki no-code formasini to'ldiradi
 *    (nom, system prompt, model, vositalar, xotira switch) -> "Create"
 * 4) /agents/{id}'ga yo'naltiriladi, yaratilgan agent nomi sahifada ko'rinadi
 *
 * MUHIM: agent yaratish HAQIQIY pul yechadi (AgentsService.create — Y4
 * narxlash). Yangi foydalanuvchi balansi 0'dan boshlanadi, to'lov shlyuzi
 * (Payme/Click) esa E2E'da simulyatsiya qilinmaydi — shu sabab login
 * qilingandan keyin balans to'g'ridan-to'g'ri DB orqali to'ldiriladi
 * (helpers/db.ts). Agent yaratishning o'zi — real API orqali, real UI bilan.
 */

function decodeSessionCookie(raw: string): { userId: string; email: string } {
  const json = Buffer.from(decodeURIComponent(raw), 'base64').toString('utf-8');
  return JSON.parse(json);
}

async function getSessionUserId(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === 'agentnet_user');
  if (!sessionCookie) throw new Error('Sessiya cookie topilmadi — login muvaffaqiyatsiz bo\'ldi');
  return decodeSessionCookie(sessionCookie.value).userId;
}

test.afterAll(async () => {
  await disconnectPrisma();
});

test('foydalanuvchi tizimga kiradi va no-code interfeysida yangi AI-agent yaratadi', async ({ page }) => {
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `e2e-${uniqueSuffix}@agentnet.test`;
  const agentName = `E2E sinov agenti ${uniqueSuffix}`;

  // --- 1. Ro'yxatdan o'tish (email bilan lokal dev-login) ---
  await page.goto('/sign-up');
  await page.getByLabel('Your name').fill('E2E Test User');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Yangi hisob -> adaptiv onboarding'ga yo'naltiriladi
  await page.waitForURL('**/onboarding');
  await expect(page).toHaveURL(/\/onboarding$/);

  // --- Balansni to'ldirish (real to'lov shlyuzisiz E2E uchun) ---
  const userId = await getSessionUserId(page);
  await topUpBalance(userId, 50_000_000); // 500,000 so'm — istalgan murakkablikdagi agentga yetarli

  // --- 2. Onboarding'ni o'tkazib yuborish ---
  await page.getByRole('link', { name: 'Skip for now' }).click();
  await page.waitForURL('**/dashboard');

  // --- 3. Sidebar orqali no-code agent yaratish sahifasiga o'tish ---
  await page.getByRole('link', { name: 'New agent' }).click();
  await page.waitForURL('**/agents/new');

  // Pastdagi no-code (qo'lda sozlash) formani to'ldiramiz — AI-composer emas
  await page.locator('#agent-name').fill(agentName);
  await page
    .locator('#agent-prompt')
    .fill('Siz mijozlarga mahsulotlar haqida savol-javob beruvchi yordamchisiz.');

  // Model — tezkor/arzon variantni tanlaymiz (default'dan farqli tanlov)
  await page.getByRole('button', { name: 'Claude Haiku 4.5' }).click();

  // Ikkita vositani yoqamiz — no-code konfiguratsiya interaksiyasi
  await page.getByRole('button', { name: 'Live knowledge' }).click();
  await page.getByRole('button', { name: 'Weather' }).click();

  // Xotira switch'ini o'chirib-yoqib ko'ramiz
  const memorySwitch = page.getByRole('switch');
  await memorySwitch.click();
  await expect(memorySwitch).toHaveAttribute('aria-checked', 'false');
  await memorySwitch.click();
  await expect(memorySwitch).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Create', exact: true }).click();

  // --- 4. Muvaffaqiyat: agent sahifasiga yo'naltiriladi, nomi ko'rinadi ---
  await page.waitForURL(/\/agents\/[^/]+$/, { timeout: 15_000 });
  await expect(page.locator('h1')).toHaveText(agentName);
});
