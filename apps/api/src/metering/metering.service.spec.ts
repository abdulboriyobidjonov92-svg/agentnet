/**
 * V3-P0 · P0-5 — o'lchov va ichki xarajat.
 *
 * Gate bog'lanishi: G0.1 (qamrov) va G0.2 (marja raqami MAVJUD).
 */

import { Prisma } from '@prisma/client';
import { MeteringService } from './metering.service';
import { internalCostTiyin, resolveRate } from './model-pricing';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeMockPrisma(opts: { duplicate?: boolean; fail?: boolean } = {}) {
  const rows: any[] = [];
  return {
    _rows: rows,
    usageEvent: {
      create: jest.fn(async ({ data }: any) => {
        if (opts.fail) throw new Error('DB down');
        if (opts.duplicate) {
          throw new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        rows.push(data);
        return data;
      }),
      aggregate: jest.fn(async () => ({
        _sum: {
          inputTokens: 100,
          outputTokens: 40,
          cacheReadTokens: 10,
          toolCalls: 2,
          internalCostTiyin: 5_000n,
        },
        _count: 3,
      })),
      count: jest.fn(async () => 0),
    },
    creditLedger: {
      aggregate: jest.fn(async () => ({ _sum: { amount: -20_000n } })),
    },
  };
}

// ---------------------------------------------------------------- narx

describe('model-pricing — ichki xarajat', () => {
  it('Anthropic modeli uchun narx topiladi', () => {
    expect(resolveRate('claude-sonnet-5')).not.toBeNull();
  });

  it('sana-suffiksli variant ham topiladi', () => {
    expect(resolveRate('claude-sonnet-5-20260101')).toEqual(resolveRate('claude-sonnet-5'));
  });

  it('har qanday `:free` model — marjinal xarajat NOL', () => {
    const { tiyin, unknown } = internalCostTiyin('yangi/model:free', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 0,
    });
    expect(unknown).toBe(false);
    expect(tiyin).toBe(0n);
  });

  it('⚠️ NOMA‘LUM model → `unknown` (jim 0 EMAS)', () => {
    const { tiyin, unknown } = internalCostTiyin('gpt-9-turbo', {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
    });
    expect(unknown).toBe(true);
    expect(tiyin).toBe(0n);
  });

  it('xarajat BigInt tiyinda (float YO‘Q — Konstitutsiya #20)', () => {
    const { tiyin } = internalCostTiyin('claude-sonnet-5', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
    });
    expect(typeof tiyin).toBe('bigint');
    // $3 × kurs × 100 tiyin — aniq qiymat kursga bog'liq, musbat bo'lishi shart.
    expect(tiyin).toBeGreaterThan(0n);
  });

  it('cache-read input tokendan ARZON (R4)', () => {
    const input = internalCostTiyin('claude-sonnet-5', {
      inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0,
    }).tiyin;
    const cached = internalCostTiyin('claude-sonnet-5', {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000,
    }).tiyin;
    expect(cached).toBeLessThan(input);
  });

  it('model berilmasa `unknown`', () => {
    expect(internalCostTiyin(null, { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }).unknown).toBe(true);
  });
});

// ---------------------------------------------------------------- yozish

describe('recordLlm', () => {
  const base = {
    idempotencyKey: 'run1:llm',
    userId: 'u1',
    agentId: 'a1',
    runId: 'run1',
    model: 'claude-sonnet-5',
    inputTokens: 1200,
    outputTokens: 340,
  };

  it('o‘lchovni yozadi va xarajatni hisoblaydi', async () => {
    const prisma = makeMockPrisma();
    const out = await new MeteringService(prisma as never).recordLlm(base);

    expect(out.recorded).toBe(true);
    expect(out.costTiyin).toBeGreaterThan(0n);
    expect(prisma._rows[0]).toMatchObject({
      kind: 'LLM',
      inputTokens: 1200,
      outputTokens: 340,
      costUnknown: false,
    });
  });

  it('⚠️ DUBLIKAT (retry) ikkinchi marta YOZILMAYDI', async () => {
    const prisma = makeMockPrisma({ duplicate: true });
    const out = await new MeteringService(prisma as never).recordLlm(base);
    expect(out.recorded).toBe(false);
  });

  it('⚠️ DB yiqilsa THROW QILMAYDI (fail-open — LLM javobi buzilmaydi)', async () => {
    const prisma = makeMockPrisma({ fail: true });
    await expect(new MeteringService(prisma as never).recordLlm(base)).resolves.toMatchObject({
      recorded: false,
    });
  });

  it('noma‘lum modelda `costUnknown` bayrog‘i yoziladi', async () => {
    const prisma = makeMockPrisma();
    await new MeteringService(prisma as never).recordLlm({ ...base, model: 'yoq-bunday-model' });
    expect(prisma._rows[0].costUnknown).toBe(true);
  });

  it('manfiy/kasr token qiymatlari tozalanadi', async () => {
    const prisma = makeMockPrisma();
    await new MeteringService(prisma as never).recordLlm({
      ...base, inputTokens: -5, outputTokens: 10.7,
    });
    expect(prisma._rows[0].inputTokens).toBe(0);
    expect(prisma._rows[0].outputTokens).toBe(10);
  });

  it('bepul tier ham O‘LCHANADI (G0.1 qamrovi)', async () => {
    const prisma = makeMockPrisma();
    const out = await new MeteringService(prisma as never).recordLlm({
      ...base, model: 'google/gemma-4-31b-it:free',
    });
    expect(out.recorded).toBe(true);
    expect(out.costTiyin).toBe(0n);
    expect(prisma._rows[0].costUnknown).toBe(false);
  });
});

// ---------------------------------------------------------------- o'qish

describe('summaryForUser — foydalanuvchi ko‘rinishi', () => {
  it('⚠️ `internalCostTiyin` QAYTARILMAYDI (marja — tijorat siri)', async () => {
    const out = await new MeteringService(makeMockPrisma() as never).summaryForUser(user);
    expect(out).not.toHaveProperty('internalCostTiyin');
    expect(out.tokensIn).toBe(100);
  });

  it('so‘rov userId bilan scope qilinadi', async () => {
    const prisma = makeMockPrisma();
    await new MeteringService(prisma as never).summaryForUser(user);
    expect(prisma.usageEvent.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    );
  });
});

describe('G0.2 — marja raqami MAVJUD', () => {
  it('marja hisoblanadi va BigInt satr sifatida chiqadi', async () => {
    const out = await new MeteringService(makeMockPrisma() as never).marginSummary();

    expect(out.internalCostTiyin).toBe('5000');
    expect(out.revenueTiyin).toBe('20000');
    // (20000 − 5000) / 20000 = 75%
    expect(out.marginPct).toBe(75);
  });

  it('⚠️ daromad NOL bo‘lsa marja `null` (soxta raqam emas)', async () => {
    const prisma = makeMockPrisma();
    prisma.creditLedger.aggregate = jest.fn(async () => ({ _sum: { amount: 0n } })) as never;

    const out = await new MeteringService(prisma as never).marginSummary();
    expect(out.marginPct).toBeNull();
  });

  it('noma‘lum narxli chaqiruvlar ochiq sanaladi', async () => {
    const prisma = makeMockPrisma();
    prisma.usageEvent.count = jest.fn(async () => 7) as never;

    const out = await new MeteringService(prisma as never).marginSummary();
    expect(out.costUnknownCalls).toBe(7);
    expect(out.note).toMatch(/quyi baholangan/);
  });
});
