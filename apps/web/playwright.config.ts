import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * E2E — real Web (Next.js, :3000) + real API (NestJS, :3001) ustida ishlaydi.
 * Postgres oldindan ishga tushirilgan bo'lishi kerak (`docker compose up -d postgres`,
 * `npm run db:migrate --workspace=apps/api`). Agar dev serverlar allaqachon
 * ishlab turgan bo'lsa (`npm run dev`), webServer ularni qayta ishga tushirmay
 * shunchaki qayta ishlatadi (reuseExistingServer).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // bitta test foydalanuvchisi/DB holatiga tayanadi
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../api'),
      url: 'http://localhost:3001/api/docs', // Swagger UI — 2xx qaytaradigan yagona ochiq GET yo'l
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
