import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import type { User } from '@prisma/client';

/**
 * Raqobatchi narx monitoringi — MVP: real-vaqt emas, kunlik bir marta cron
 * tekshiradi. Manba ikki turda: "manual" (foydalanuvchi qo'lda kiritgan narx,
 * URL yo'q) yoki ochiq e'lonlar sahifasi (URL + oddiy narx-regex, best-effort —
 * sayt tuzilishi murakkab bo'lsa `ok:false` bilan xatoni yozadi, tizim yiqilmaydi).
 */

const PRICE_REGEX = /(\d[\d\s.,]{2,})\s*(?:so'?m|сум|uzs)/i;
const UNDERCUT_THRESHOLD = 0.03; // raqobatchi 3%+ arzon bo'lsa ogohlantirish

@Injectable()
export class CompetitorPriceService {
  private readonly logger = new Logger(CompetitorPriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listSources(user: User) {
    return this.prisma.competitorSource.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addSource(
    user: User,
    dto: { sku: string; name: string; url?: string; manualPrice?: number },
  ) {
    if (!dto.url && dto.manualPrice == null) {
      throw new NotFoundException("URL yoki qo'lda narx kiritish shart");
    }
    return this.prisma.competitorSource.create({
      data: {
        userId: user.id,
        sku: dto.sku,
        name: dto.name,
        url: dto.url ?? null,
        manualPrice: dto.manualPrice != null ? Math.round(dto.manualPrice * 100) : null,
      },
    });
  }

  async removeSource(user: User, sourceId: string) {
    const source = await this.prisma.competitorSource.findFirst({ where: { id: sourceId, userId: user.id } });
    if (!source) throw new NotFoundException('Manba topilmadi');
    await this.prisma.competitorSource.update({ where: { id: source.id }, data: { active: false } });
    return { ok: true };
  }

  async listChecks(user: User) {
    return this.prisma.competitorPriceCheck.findMany({
      where: { userId: user.id },
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });
  }

  /** Bitta manbani tekshiradi: manual bo'lsa saqlangan narx, URL bo'lsa best-effort fetch. */
  private async checkOne(source: { id: string; userId: string; sku: string; url: string | null; manualPrice: number | null }) {
    if (!source.url) {
      return { price: source.manualPrice, ok: true, error: null };
    }
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return { price: null, ok: false, error: `HTTP ${res.status}` };
      const html = await res.text();
      const match = html.match(PRICE_REGEX);
      if (!match) return { price: null, ok: false, error: "Narx topilmadi (sahifa tuzilishi tanilmadi)" };
      const digits = match[1].replace(/[\s.,]/g, '');
      const som = Number(digits);
      if (!Number.isFinite(som) || som <= 0) return { price: null, ok: false, error: "Narxni o'qib bo'lmadi" };
      return { price: Math.round(som * 100), ok: true, error: null };
    } catch (e: any) {
      return { price: null, ok: false, error: e.message ?? "Manbaga ulanib bo'lmadi" };
    }
  }

  /** Foydalanuvchi qo'lda ham ishga tushira oladi ("hozir tekshirish"). */
  async runCheckForUser(user: User) {
    const sources = await this.prisma.competitorSource.findMany({ where: { userId: user.id, active: true } });
    const results = [];
    for (const source of sources) {
      const { price, ok, error } = await this.checkOne(source);
      const check = await this.prisma.competitorPriceCheck.create({
        data: { userId: user.id, sourceId: source.id, sku: source.sku, price, ok, error },
      });
      results.push(check);

      if (ok && price != null) {
        await this.flagIfUndercut(user, source.sku, source.name, price);
      }
    }
    return results;
  }

  private async flagIfUndercut(user: User, sku: string, sourceName: string, competitorPriceTiyin: number) {
    const product = await this.prisma.retailProduct.findUnique({
      where: { userId_sku: { userId: user.id, sku } },
    });
    if (!product || product.price <= 0) return;

    const diff = (product.price - competitorPriceTiyin) / product.price;
    if (diff < UNDERCUT_THRESHOLD) return; // raqobatchi sezilarli arzon emas

    await this.prisma.retailAlert.create({
      data: {
        userId: user.id,
        kind: 'competitor_price',
        severity: 'warning',
        title: `Raqobatchi arzonroq: ${product.name}`,
        body: `${sourceName} bu tovarni ${Math.round(competitorPriceTiyin / 100)} so'mga sotmoqda, sizda ${Math.round(product.price / 100)} so'm (${Math.round(diff * 100)}% qimmatroq).`,
        evidence: { sku, sourceName, competitorPriceTiyin, ownPriceTiyin: product.price },
        method: 'heuristic',
      },
    });
  }

  /** Har kuni soat 06:00 da barcha faol foydalanuvchilar manbalarini tekshiradi. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailyCheckAll() {
    const sources = await this.prisma.competitorSource.findMany({
      where: { active: true },
      include: { user: true },
    });
    const byUser = new Map<string, typeof sources>();
    for (const s of sources) {
      const arr = byUser.get(s.userId) ?? [];
      arr.push(s);
      byUser.set(s.userId, arr);
    }
    this.logger.log(`Cron: ${byUser.size} foydalanuvchi, ${sources.length} raqobatchi manbasi tekshirilmoqda`);
    for (const [, userSources] of byUser) {
      const user = userSources[0].user;
      for (const source of userSources) {
        try {
          const { price, ok, error } = await this.checkOne(source);
          await this.prisma.competitorPriceCheck.create({
            data: { userId: user.id, sourceId: source.id, sku: source.sku, price, ok, error },
          });
          if (ok && price != null) {
            await this.flagIfUndercut(user, source.sku, source.name, price);
          }
        } catch (e: any) {
          this.logger.warn(`Raqobatchi narx tekshiruvi xatosi (${source.id}): ${e.message}`);
        }
      }
    }
  }
}
