import * as fs from 'fs';
import * as path from 'path';

/**
 * SEC-15 — bog'liqlik xavfsizligi KONFIGURATSIYASI qulflanadi.
 *
 * NEGA TEST: `npm audit` va `pip-audit` ning O'ZI bu yerda emas, CI'da
 * ishlaydi. SEC-15 ning kafolati esa "skaner bloklovchi bo'lib qoladi va
 * jimgina bo'shashtirilmaydi" — aynan shu narsa testlanadi. Kimdir
 * `--audit-level` ni `critical` ga ko'tarsa, `|| true` qo'shsa yoki
 * `--omit=dev` ni olib tashlasa — CI qizaradi.
 *
 * SEC-14 dagi `gitleaks-config.spec.ts` bilan bir xil naqsh: YAML
 * parseri ishlatilmaydi (`js-yaml` tranzitiv, tiplari yo'q), xom matn
 * ustidan tor tekshiruvlar bir xil kafolatni beradi.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const workflow = readRepoFile('.github/workflows/ci.yml');

/** Ish (job) matni — keyingi ish boshlanishigacha. */
function jobBlock(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('SEC-15 — npm audit CI ishi', () => {
  const job = jobBlock('npm-audit');

  it('CI\'da `npm-audit` ishi mavjud', () => {
    expect(job).toContain('npm audit');
  });

  it('FAQAT prod bog\'liqliklari tekshiriladi (`--omit=dev`)', () => {
    expect(job).toContain('--omit=dev');
  });

  it('high/critical CI\'ni qizartiradi (`--audit-level=high`)', () => {
    expect(job).toContain('--audit-level=high');
  });

  it('bloklovchi qadam `|| true` bilan YUMSHATILMAGAN', () => {
    // Hisobot qadami (`Full audit report`) ataylab `|| true` — u
    // bloklamaydi. Bloklovchi qadam esa toza bo'lishi SHART.
    const blocking = job
      .split('\n')
      .find((l) => l.includes('npm audit --omit=dev --audit-level=high'));
    expect(blocking).toBeDefined();
    expect(blocking).not.toContain('|| true');
    expect(blocking).not.toContain('continue-on-error');
  });

  it('ish SHARTSIZ ishlaydi (`if:` bilan o\'tkazib yuborilmaydi)', () => {
    expect(job).not.toMatch(/^\s{4}if:/m);
  });
});

describe('SEC-15 — pip-audit CI ishi', () => {
  const job = jobBlock('pip-audit');

  it('CI\'da `pip-audit` ishi mavjud', () => {
    expect(job).toContain('pip-audit');
  });

  it('engine\'ning HAQIQIY dependency faylini tekshiradi', () => {
    expect(job).toContain('-r requirements.txt');
    expect(job).toContain('apps/agent-engine');
  });

  it('bloklovchi — `|| true` yoki `continue-on-error` yo\'q', () => {
    const scan = job.split('\n').find((l) => l.includes('pip-audit -r'));
    expect(scan).toBeDefined();
    expect(scan).not.toContain('|| true');
    expect(job).not.toContain('continue-on-error');
  });

  it('pip-audit versiyasi QOTIRILGAN', () => {
    expect(workflow).toMatch(/PIP_AUDIT_VERSION:\s*"\d+\.\d+\.\d+"/);
    expect(job).toContain('pip-audit==');
  });

  it('ish SHARTSIZ ishlaydi', () => {
    expect(job).not.toMatch(/^\s{4}if:/m);
  });
});

describe('SEC-15 — Dependabot konfiguratsiyasi', () => {
  const cfg = readRepoFile('.github/dependabot.yml');

  it('v2 formati', () => {
    expect(cfg).toMatch(/^version:\s*2$/m);
  });

  it('HAFTALIK jadval (Contract §7: weekly)', () => {
    const intervals = [...cfg.matchAll(/interval:\s*(\w+)/g)].map((m) => m[1]);
    expect(intervals.length).toBeGreaterThanOrEqual(3);
    expect(intervals.every((i) => i === 'weekly')).toBe(true);
  });

  it('uchala ekotizim ham qamrab olingan: npm, pip, github-actions', () => {
    expect(cfg).toContain('package-ecosystem: npm');
    expect(cfg).toContain('package-ecosystem: pip');
    expect(cfg).toContain('package-ecosystem: github-actions');
  });

  it('npm ILDIZDAN kuzatiladi (yagona lockfile)', () => {
    // Monorepo'da bitta `package-lock.json` ildizda; har workspace uchun
    // alohida yozuv bir xil faylga tegadigan ziddiyatli PR'lar yaratardi.
    expect(cfg).toMatch(/package-ecosystem:\s*npm\s*\n\s*directory:\s*"\/"/);
  });

  it('Python engine o\'z papkasidan kuzatiladi', () => {
    expect(cfg).toMatch(/package-ecosystem:\s*pip\s*\n\s*directory:\s*"\/apps\/agent-engine"/);
  });

  it('xavfsizlik yangilanishlari ALOHIDA guruhda (major ignore\'dan mustasno)', () => {
    expect(cfg).toContain('applies-to: security-updates');
    // Major ignore FAQAT `version-updates`ga tegishli bo'lishi uchun
    // xavfsizlik guruhi alohida e'lon qilingan.
    expect(cfg).toContain('version-update:semver-major');
  });
});

describe('SEC-15 — Snyk takrorlanmaydi', () => {
  it('repo\'da Snyk konfiguratsiyasi YO\'Q (ikkinchi vosita kiritilmadi)', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, '.snyk'))).toBe(false);
    expect(workflow.toLowerCase()).not.toContain('snyk');
  });
});

describe('SEC-15 — Python xavfsizlik poli', () => {
  const requirements = readRepoFile('apps/agent-engine/requirements.txt');

  it('`cryptography` uchun xavfsizlik poli qo\'yilgan (PYSEC-2026-3552)', () => {
    // Tranzitiv (google-genai -> google-auth) va ilgari PIN QILINMAGAN —
    // ya'ni zaif 49.0.0 ga tushib qolish mumkin edi.
    expect(requirements).toMatch(/^cryptography>=50\.0\.0$/m);
  });

  it('pol `>=` — qat\'iy pin EMAS (kelajakdagi yangilanishni to\'smaydi)', () => {
    expect(requirements).not.toMatch(/^cryptography==/m);
  });
});
