import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UsageKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { internalCostTiyin } from './model-pricing';
import type { User } from '@prisma/client';

/**
 * V3-P0 · P0-5 — FOYDALANISH O'LCHOVI.
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` P0-5 · ADR-023.
 *
 * MUAMMO (ADR-023): platforma har chaqiruvda qancha yo'qotayotganini
 * UMUMAN bilmaydi. Bu servis o'sha bo'shliqni yopadi — G0.1 (qamrov) va
 * G0.2 (marja raqami MAVJUD) shundan o'lchanadi.
 *
 * ⚠️ SHADOW REJIM. Bu servis HECH KIMNING balansiga tegmaydi va hech
 * qanday narxni o'zgartirmaydi (ADR-023 §5). U faqat O'LCHAYDI. Narx
 * qarori — V3-P1, va u aynan shu ma'lumot yig'ilgandan keyin qabul
 * qilinadi (PRICING §8 C3: "C3 dan oldin bironta narx e'lon qilinmaydi").
 *
 * ⚠️ FAIL-OPEN. Yozuv xatosi LLM javobini BUZMAYDI: o'lchov yo'qolgani
 * yomon, foydalanuvchi javobini yo'qotgani battar.
 */
@Injectable()
export class MeteringService {
  private readonly logger = new Logger(MeteringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * LLM chaqiruvini yozadi.
   *
   * `idempotencyKey` — `runId:stepId` (§2.2). Bir xil kalit ikki marta
   * kelsa (retry) ikkinchisi JIM o'tkazib yuboriladi: o'lchov ikkilanishi
   * marjani soxta yomon ko'rsatardi.
   */
  async recordLlm(input: {
    idempotencyKey: string;
    userId: string;
    agentId?: string | null;
    runId?: string | null;
    conversationId?: string | null;
    model?: string | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    toolCalls?: number;
    executionMs?: number;
  }): Promise<{ recorded: boolean; costTiyin?: bigint; costUnknown?: boolean }> {
    const tokens = {
      inputTokens: Math.max(0, Math.trunc(input.inputTokens || 0)),
      outputTokens: Math.max(0, Math.trunc(input.outputTokens || 0)),
      cacheReadTokens: Math.max(0, Math.trunc(input.cacheReadTokens || 0)),
    };
    const { tiyin, unknown } = internalCostTiyin(input.model, tokens);

    if (unknown) {
      // Jim 0 EMAS — aniq signal. Aks holda yangi model qo'shilganda
      // marja "yaxshilanib" ketardi va sabab topilmasdi.
      this.logger.warn(
        `Model narx jadvalida yo'q: "${input.model}" — internalCost ishonchsiz (costUnknown)`,
      );
    }

    try {
      await this.prisma.usageEvent.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
          agentId: input.agentId ?? null,
          runId: input.runId ?? null,
          conversationId: input.conversationId ?? null,
          kind: UsageKind.LLM,
          model: input.model ?? null,
          ...tokens,
          toolCalls: Math.max(0, Math.trunc(input.toolCalls || 0)),
          executionMs: Math.max(0, Math.trunc(input.executionMs || 0)),
          internalCostTiyin: tiyin,
          costUnknown: unknown,
        },
      });
      return { recorded: true, costTiyin: tiyin, costUnknown: unknown };
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Dublikat — retry. Bu XATO EMAS, kutilgan holat.
        return { recorded: false };
      }
      // Fail-open: o'lchov yo'qoldi, ijro davom etadi.
      this.logger.warn(`O'lchov yozilmadi (${input.idempotencyKey}): ${(e as Error)?.message}`);
      return { recorded: false };
    }
  }

  /**
   * Foydalanuvchining o'z xulosasi.
   *
   * ⚠️ `internalCostTiyin` QAYTARILMAYDI — u ichki ma'lumot (marja
   * tijorat siri). Faqat admin yo'lida ko'rinadi.
   */
  async summaryForUser(user: User, range: { from?: Date; to?: Date } = {}) {
    const where = {
      userId: user.id,
      ...(range.from || range.to
        ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
        : {}),
    };

    const agg = await this.prisma.usageEvent.aggregate({
      where,
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, toolCalls: true },
      _count: true,
    });

    return {
      calls: agg._count,
      tokensIn: agg._sum.inputTokens ?? 0,
      tokensOut: agg._sum.outputTokens ?? 0,
      cacheReadTokens: agg._sum.cacheReadTokens ?? 0,
      toolCalls: agg._sum.toolCalls ?? 0,
    };
  }

  /**
   * G0.2 — MARJA RAQAMI.
   *
   * Gate sharti: "real gross margin raqami MAVJUD — qiymati qanday
   * bo'lishidan qat'i nazar". Ya'ni bu yerda maqsad chiroyli raqam emas,
   * BILISH.
   *
   * Daromad `CreditLedger` dagi HAQIQATAN yechilgan summalardan olinadi
   * (`amount < 0`) — bugungi flat narx bilan. `internalCost` esa shu
   * servisdan. Ikkalasi ALOHIDA manbadan (ADR-023 §4).
   */
  async marginSummary(range: { from?: Date; to?: Date } = {}) {
    const createdAt =
      range.from || range.to
        ? { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) }
        : undefined;

    // @admin-scope: butun platforma bo'yicha iqtisod — `@Roles(OWNER, ADMIN)`
    // ortidagi yagona chaqiruv nuqtasi (`AdminEconomyController`).
    const cost = await this.prisma.usageEvent.aggregate({
      where: createdAt ? { createdAt } : {},
      _sum: { internalCostTiyin: true },
      _count: true,
    });
    // @admin-scope: ayni sabab.
    const unknownCount = await this.prisma.usageEvent.count({
      where: { costUnknown: true, ...(createdAt ? { createdAt } : {}) },
    });
    // @admin-scope: ayni sabab. Chiquvchi pul (`amount < 0`) — daromad.
    const revenue = await this.prisma.creditLedger.aggregate({
      where: { amount: { lt: 0 }, ...(createdAt ? { createdAt } : {}) },
      _sum: { amount: true },
    });

    const internal = cost._sum.internalCostTiyin ?? 0n;
    const revenueTiyin = -(revenue._sum.amount ?? 0n); // manfiydan musbatga

    // Marja faqat daromad bo'lganda ma'noli. Nol daromadda "−∞%" emas,
    // ochiq `null` — soxta raqam ko'rsatishdan ko'ra bilmaslik halolroq.
    const marginPct =
      revenueTiyin > 0n
        ? Number(((revenueTiyin - internal) * 10_000n) / revenueTiyin) / 100
        : null;

    return {
      calls: cost._count,
      internalCostTiyin: internal.toString(),
      revenueTiyin: revenueTiyin.toString(),
      marginPct,
      /** ⚠️ Shu qadar chaqiruvda model narxi noma'lum — marja ishonchsiz. */
      costUnknownCalls: unknownCount,
      /** G0.1 uchun: o'lchov qamrovi (foizda) — pastdagi izohga qarang. */
      note:
        unknownCount > 0
          ? 'Ba\'zi chaqiruvlarda model narxi jadvalda yo\'q — marja quyi baholangan'
          : null,
    };
  }
}
