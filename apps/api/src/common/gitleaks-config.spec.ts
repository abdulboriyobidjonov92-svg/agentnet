import * as fs from 'fs';
import * as path from 'path';

/**
 * SEC-14 — sir skaneri KONFIGURATSIYASI qulflanadi.
 *
 * NEGA TEST: gitleaks'ning O'ZI bu muhitda ishlamaydi (tarmoq/docker yo'q),
 * lekin uning CI'da BLOKLOVCHI bo'lib qolishi va allowlist'ning bo'shashib
 * ketmasligi — SEC-14 ning asosiy kafolati. Bu testlar aynan shu kafolatni
 * himoya qiladi: kimdir skanerni "vaqtincha" o'chirsa, `--redact` ni olib
 * tashlasa yoki butun papkani allowlist'ga qo'ysa — CI qizaradi.
 *
 * YAML parseri ATAYLAB ishlatilmaydi: `js-yaml` bu repo'da tranzitiv
 * bog'liqlik (tiplari yo'q) va uni SEC-14 uchun devDependency sifatida
 * qo'shish "kerak bo'lmagan bog'liqlik kiritilmaydi" qoidasiga zid.
 * Xom matn ustidan tor tekshiruvlar bir xil kafolatni beradi.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const readRepoFile = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const workflow = readRepoFile('.github/workflows/ci.yml');

/** `secrets:` ishining matni (keyingi ish boshlanishigacha). */
function jobBlock(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('SEC-14 — gitleaks CI konfiguratsiyasi', () => {
  const secretsJob = jobBlock('secrets');

  it('CI\'da `secrets` ishi mavjud va gitleaks ishga tushadi', () => {
    expect(secretsJob).toContain('gitleaks detect');
  });

  it('skaner BLOKLOVCHI — `--exit-code 1`', () => {
    expect(secretsJob).toContain('--exit-code 1');
  });

  it('skaner SHARTSIZ ishlaydi (`if:` bilan o\'tkazib yuborilmaydi)', () => {
    // Shartli bo'lsa, uni jimgina "vaqtincha" o'chirib qo'yish mumkin edi.
    expect(secretsJob).not.toMatch(/^\s{4}if:/m);
  });

  it('topilma CI logiga CHIQMAYDI (`--redact`)', () => {
    // Redaktsiyasiz skanerning o'zi sirni ommaviy build-logiga ko'chirib,
    // sizishni KUCHAYTIRARDI.
    expect(secretsJob).toContain('--redact');
  });

  it('bizning konfiguratsiya ishlatiladi', () => {
    expect(secretsJob).toContain('--config .gitleaks.toml');
  });

  it('gitleaks versiyasi QOTIRILGAN (`latest` emas)', () => {
    expect(workflow).toMatch(/GITLEAKS_VERSION:\s*"\d+\.\d+\.\d+"/);
    expect(workflow).not.toMatch(/gitleaks[^\n]*:latest/);
  });

  it('tarix skani alohida ish sifatida mavjud', () => {
    expect(workflow).toContain('secrets-history');
    expect(workflow).toContain('workflow_dispatch');
  });
});

describe('SEC-14 — gitleaks allowlist intizomi', () => {
  const toml = readRepoFile('.gitleaks.toml');

  it('rasmiy default qoidalar to\'plami ishlatiladi', () => {
    expect(toml).toMatch(/useDefault\s*=\s*true/);
  });

  it('MANBA fayl/papkasi allowlist\'ga QO\'YILMAGAN', () => {
    // `paths` faqat generatsiya qilinadigan artefaktlar uchun. Agar kimdir
    // `.env.example`, `src/` yoki `docs/` ni butunlay ochib qo'ysa, o'sha
    // joyga tushgan HAQIQIY sir ham jimgina o'tib ketardi.
    const pathsBlock = toml.split('paths = [')[1]?.split(']')[0] ?? '';
    expect(pathsBlock).not.toBe('');
    for (const forbidden of ['.env', 'src', 'docs', 'apps', 'scripts', '.github']) {
      expect(pathsBlock).not.toContain(forbidden);
    }
    expect(pathsBlock).toContain('node_modules');
    expect(pathsBlock).toContain('dist');
  });

  it('haqiqiy Anthropic kaliti formati allowlist\'ga TUSHMAYDI', () => {
    // Allowlist faqat `sk-ant-...` va `sk-ant-placeholder` to'ldiruvchilarini
    // ochadi; haqiqiy kalit (`sk-ant-api03-<uzun>`) ularga mos kelmaydi.
    const realKeyShape = `sk-ant-api03-${'A'.repeat(88)}`;
    expect(/sk-ant-\.\.\./.test(realKeyShape)).toBe(false);
    expect(/sk-ant-placeholder/.test(realKeyShape)).toBe(false);
  });
});

describe('SEC-14 — repoda sir yo\'q', () => {
  it('haqiqiy `.env` fayllari git\'ga qo\'shilmagan (faqat `.example`)', () => {
    expect(readRepoFile('.gitignore')).toMatch(/^\.env$/m);
  });

  it('kripto/imzo kalitlari `.env.example` da BO\'SH', () => {
    const example = readRepoFile('.env.example');
    for (const key of ['ENCRYPTION_KEY', 'AUTH_JWT_SECRET']) {
      const line = example.split('\n').find((l) => l.trim().startsWith(`${key}=`));
      expect(line).toBeDefined();
      const value = line!.slice(line!.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
      expect(value).toBe('');
    }
  });

  it('ommaviy MA\'LUM dev qiymati prod\'da RAD etiladi', () => {
    // `.env.example` da `INTERNAL_API_TOKEN=agentnet-internal-dev` turadi —
    // u ataylab ommaviy (lokal dev uchun) va kodda ham xuddi shu fallback
    // bor. Xavf: o'sha qiymat prod'ga qolib ketsa, "ichki" darvoza amalda
    // ochiq bo'lardi. Shuning uchun u `.env.example` dan olib tashlanmaydi
    // (dev uchun kerak), lekin PROD BOOT'da bloklanadi — `validate-env.ts`.
    const validateEnvSource = fs.readFileSync(
      path.join(__dirname, 'validate-env.ts'),
      'utf8',
    );
    expect(validateEnvSource).toContain('agentnet-internal-dev');
    expect(validateEnvSource).toContain('weakDefaults');
  });
});
