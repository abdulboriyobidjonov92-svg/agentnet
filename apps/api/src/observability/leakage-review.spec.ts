import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 5 (P5.8) — KUZATUV XAVFSIZLIGI REVIEW'i, REGRESSIYA sifatida.
 *
 * P5.8 "butun repozitoriyni sirlar sizishiga qarshi tekshir" deydi.
 * Bir martalik qo'lda ko'rik **eskiradi**: ertaga kimdir yangi
 * `logger.error(\`... ${process.env.ENCRYPTION_KEY}\`)` yozadi va uni
 * hech kim ushlamaydi. Shuning uchun ko'rikning O'ZI test sifatida
 * yozilgan — u har CI'da qaytadan bajariladi.
 *
 * QAMROV: `apps/api/src`, `apps/web/src` + web ildiz konfiguratsiyalari,
 * `apps/agent-engine` (Python). Test fayllari CHIQARILADI (ular ataylab
 * soxta sirlar bilan ishlaydi).
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');

function walk(dir: string, extensions: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    if (entry.name === '__pycache__' || entry.name === '.venv') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, acc);
    else if (extensions.some((ext) => entry.name.endsWith(ext))) acc.push(full);
  }
  return acc;
}

const isTestFile = (file: string) =>
  /\.spec\.ts$/.test(file) || /\.test\.ts$/.test(file) || /(^|[\\/])test_[^\\/]+\.py$/.test(file);

const sourceFiles = [
  ...walk(path.join(REPO_ROOT, 'apps/api/src'), ['.ts']),
  ...walk(path.join(REPO_ROOT, 'apps/web/src'), ['.ts', '.tsx']),
  ...walk(path.join(REPO_ROOT, 'apps/agent-engine'), ['.py']),
].filter((file) => !isTestFile(file));

const webRootConfigs = [
  'apps/web/next.config.ts',
  'apps/web/instrumentation.ts',
  'apps/web/instrumentation-client.ts',
  'apps/web/sentry.server.config.ts',
  'apps/web/sentry.edge.config.ts',
].map((rel) => path.join(REPO_ROOT, rel));

const allFiles = [...sourceFiles, ...webRootConfigs];

const rel = (file: string) => path.relative(REPO_ROOT, file).replace(/\\/g, '/');

/** Hech qachon telemetriyaga chiqmasligi kerak bo'lgan env NOMLARI. */
const FORBIDDEN_ENV_VALUES = [
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEY_PREVIOUS',
  'AUTH_JWT_SECRET',
  'INTERNAL_API_TOKEN',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'RESEND_API_KEY',
  'PAYME_SECRET_KEY',
  'CLICK_SECRET_KEY',
  'TELEGRAM_BOT_TOKEN',
  'ESKIZ_PASSWORD',
  'DATABASE_URL',
  'SENTRY_AUTH_TOKEN',
];

describe('P5.8 — sir QIYMATI log/telemetriyaga uzatilmaydi', () => {
  /**
   * Naqsh: `logger.error(...)` / `console.log(...)` / `capture*(...)`
   * chaqiruvining ICHIDA `process.env.<SIR>` yoki `os.getenv("<SIR>")`
   * bo'lsa — bu qiymatning O'ZI chiqishga ketayotgani.
   *
   * Kalit NOMINI yozish (`"ENCRYPTION_KEY yo'q"`) mumkin va kerak —
   * shu sababli naqsh aynan `process.env.X` KO'RINISHINI qidiradi.
   */
  const sinkCall = new RegExp(
    String.raw`(?:logger|console)\.(?:log|error|warn|info|debug)\(|capture(?:Message|Exception)\(`,
  );

  it('hech bir manba faylida sir qiymati log chaqiruviga uzatilmaydi', () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!sinkCall.test(line)) return;
        for (const key of FORBIDDEN_ENV_VALUES) {
          if (line.includes(`process.env.${key}`) || line.includes(`os.getenv("${key}")`)) {
            offenders.push(`${rel(file)}:${index + 1} — ${key}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('hech bir manba faylida DSN/kalit QOTIRILMAGAN', () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      // Haqiqiy Sentry DSN, Anthropic va Resend kalitlari shakli.
      if (/https:\/\/[a-f0-9]{16,}@[a-z0-9.-]*ingest/i.test(content)) {
        offenders.push(`${rel(file)} — Sentry DSN`);
      }
      if (/["'`]sk-ant-[A-Za-z0-9_-]{20,}["'`]/.test(content)) {
        offenders.push(`${rel(file)} — Anthropic kaliti`);
      }
      if (/["'`]re_[A-Za-z0-9_-]{24,}["'`]/.test(content)) {
        offenders.push(`${rel(file)} — Resend kaliti`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('P5.8 — Sentry PII sozlamasi hech qayerda yoqilmagan', () => {
  it('sendDefaultPii / send_default_pii = true yo‘q', () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/sendDefaultPii:\s*true/.test(content) || /send_default_pii\s*=\s*True/.test(content)) {
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('includeLocalVariables yoqilmagan (dekriptlangan qiymat frame‘da turadi)', () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (/includeLocalVariables:\s*true/.test(fs.readFileSync(file, 'utf8'))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('P5.8 — OTP kodi prod‘da hech qachon loglanmaydi (fail-closed)', () => {
  const emailService = fs.readFileSync(
    path.join(REPO_ROOT, 'apps/api/src/auth/email.service.ts'),
    'utf8',
  );

  it('DEV OTP logi FAQAT aniq development/test da ishlaydi', () => {
    // Ilgari shart `NODE_ENV === 'production'` edi — ya'ni NODE_ENV
    // umuman qo'yilmagan muhitda OTP ochiq matnda logga tushardi.
    expect(emailService).toContain("env === 'development' || env === 'test'");
    expect(emailService).toContain('if (!isExplicitDev)');
  });

  it('email manzili logga MASKALANGAN holda tushadi (ADR-014 PII)', () => {
    expect(emailService).toContain('maskEmail');
    // Xom `${email}` log chaqiruvida qolmagan.
    expect(emailService).not.toMatch(/logger\.(error|warn|log)\([^)]*\$\{email\}/);
  });
});

describe('P5.8 — sog‘liq endpointlari sir oshkor qilmaydi', () => {
  const healthService = fs.readFileSync(
    path.join(REPO_ROOT, 'apps/api/src/health/health.service.ts'),
    'utf8',
  );

  it('javobga ulanish satri/kalit qo‘yilmaydi', () => {
    // Javob quruvchi kod `process.env.<SIR>` ni O'QIB javobga solmaydi.
    for (const key of ['DATABASE_URL', 'ENCRYPTION_KEY', 'AUTH_JWT_SECRET', 'INTERNAL_API_TOKEN']) {
      // Faqat MAVJUDLIK tekshiruvi bo'lishi mumkin (`env[key]?.trim()`),
      // to'g'ridan-to'g'ri `process.env.X` orqali qiymat OLINMAYDI.
      expect(healthService).not.toContain(`process.env.${key}`);
    }
  });

  it('DB xato matni javobga emas, SERVER logiga ketadi', () => {
    expect(healthService).toContain("code: 'db_unreachable'");
    expect(healthService).toContain('this.logger.error');
  });

  it('yetishmayotgan kalit NOMI javobda oshkor qilinmaydi', () => {
    expect(healthService).toContain('config_missing_${missing.length}');
  });
});

describe('P5.8 — xato javoblari ichki tafsilotni sizdirmaydi', () => {
  const filter = fs.readFileSync(
    path.join(REPO_ROOT, 'apps/api/src/common/all-exceptions.filter.ts'),
    'utf8',
  );

  it('5xx javobi umumiy xabar beradi (stack/ichki matn yo‘q)', () => {
    expect(filter).toContain("message: 'Ichki server xatosi'");
    expect(filter).toContain("reason: 'internal_error'");
  });

  it('Sentry FAQAT 5xx uchun chaqiriladi (4xx shovqin emas, dublikat yo‘q)', () => {
    const block = filter.slice(filter.indexOf('if (status >= 500)'));
    const elseIndex = block.indexOf('} else {');
    expect(block.slice(0, elseIndex)).toContain('captureException');
    expect(block.slice(elseIndex)).not.toContain('captureException');
  });
});
