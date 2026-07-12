import { Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import type { PosAdapter } from './pos-adapter';
import {
  forecastProduct,
  rankByUrgency,
  reorderMessage,
  defaultConfig,
  type ProductForecast,
  type SalePoint,
} from './retail-forecast';
import type { RetailVision } from './retail-vision';
import type { RetailAlertsSettings } from './retail-alerts-settings';
import type { User } from '@prisma/client';

/** POS savdo, bashorat (agent #1 flagship) va avtonom ta'minotchi buyurtma qoralamalari. */
export class RetailSales {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
    private readonly pos: PosAdapter,
    private readonly engineUrl: string,
    private readonly logger: Logger,
    private readonly vision: RetailVision,
    private readonly alertsSettings: RetailAlertsSettings,
  ) {}

  // ---- POS savdo ----

  async recordSale(user: User, dto: { sku: string; qty?: number; total?: number }) {
    const qty = Math.max(1, Number(dto.qty ?? 1));
    // PosAdapter orqali (hozircha "manual" — kelajakda haqiqiy kassa shu joyga ulanadi)
    const result = await this.pos.recordSale(user.id, { sku: dto.sku, qty, total: dto.total });

    const updated = await this.prisma.retailProduct.findUnique({
      where: { userId_sku: { userId: user.id, sku: dto.sku } },
    });
    // Savdo hodisaning o'zi ham solishtiriladi: zaxira chegaradan tushdimi?
    if (updated && updated.stock <= updated.reorderLevel) {
      await this.vision.reconcileAndAlert(user, { trigger: 'sale', product: updated, visionEvents: [] });
    }
    return { sale: result, stock: result.stock };
  }

  async listSales(user: User) {
    return this.prisma.retailSale.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  // ---- Bashorat qatlami (agent #1 flagship: tugash bashorati + avto-buyurtma) ----

  /** Har mahsulot uchun savdo trendidan bashorat hisoblaydi (DB → pure math). */
  private async computeForecasts(user: User): Promise<{ cfg: ReturnType<typeof defaultConfig>; forecasts: ProductForecast[] }> {
    const cfg = defaultConfig();
    const since = new Date(Date.now() - cfg.windowDays * 86_400_000);
    // PosAdapter orqali (hozircha "manual" — real POS ulanganda shu ikki chaqiruv
    // avtomatik haqiqiy kassa ma'lumotidan keladi, RetailService o'zgarmaydi)
    const [products, sales] = await Promise.all([
      this.pos.listProducts(user.id),
      this.pos.listSales(user.id, since),
    ]);

    const bySku = new Map<string, SalePoint[]>();
    for (const s of sales) {
      const arr = bySku.get(s.sku) ?? [];
      arr.push({ qty: s.qty, at: s.at });
      bySku.set(s.sku, arr);
    }

    const forecasts = products
      .map((p) => forecastProduct(p, bySku.get(p.sku) ?? [], cfg))
      .sort(rankByUrgency);
    return { cfg, forecasts };
  }

  /**
   * BASHORAT: "bu tovar necha kunda tugaydi" — har mahsulot bo'yicha, ustuvorlik
   * bilan. Engine (Claude) trend JSON'ini tahlil qilib qisqa xulosa qaytaradi
   * (LLM-first, kalitsiz oqilona heuristik fallback).
   */
  async forecast(user: User) {
    const { cfg, forecasts } = await this.computeForecasts(user);
    const summary = {
      windowDays: cfg.windowDays,
      critical: forecasts.filter((f) => f.urgency === 'critical').length,
      warning: forecasts.filter((f) => f.urgency === 'warning').length,
      ok: forecasts.filter((f) => f.urgency === 'ok').length,
      stale: forecasts.filter((f) => f.urgency === 'stale').length,
    };

    let narrative: any = null;
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.engineUrl}/retail/forecast`,
          { forecasts: forecasts.slice(0, 20), summary, language: user.preferredLanguage ?? 'uz' },
          { timeout: 30_000 },
        ),
      );
      narrative = data;
    } catch (e: any) {
      this.logger.warn(`Retail forecast engine xatosi: ${e.message}`);
    }

    return { generatedAt: new Date().toISOString(), summary, products: forecasts, narrative };
  }

  /**
   * AVTONOM harakat: tugashi bashorat qilingan mahsulotlar uchun ta'minotchi
   * buyurtma qoralamalarini avtomatik tayyorlaydi — LEKIN hech qachon o'zi
   * yubormaydi. Har sku uchun bitta faol (pending) yozuv saqlanadi
   * (ReorderDraft); egasi bir marta "Tasdiqlash"/"Bekor qilish" bosgach,
   * vaziyat davom etsa ham bir kun ichida qayta ko'tarilmaydi (spam qilmaslik).
   */
  async reorderPlan(user: User) {
    const { cfg, forecasts } = await this.computeForecasts(user);
    const lang = user.preferredLanguage ?? 'uz';
    const RESURFACE_MS = 24 * 3600_000;
    const candidates = forecasts.filter(
      (f) => (f.urgency === 'critical' || f.urgency === 'warning') && f.recommendedOrderQty > 0,
    );

    const drafts = [];
    for (const f of candidates) {
      const message = reorderMessage(f, lang);
      const data = {
        name: f.name,
        urgency: f.urgency,
        stock: f.stock,
        dailyVelocity: f.dailyVelocity,
        daysUntilStockout: f.daysUntilStockout,
        orderQty: f.recommendedOrderQty,
        message,
      };
      const existing = await this.prisma.reorderDraft.findUnique({
        where: { userId_sku: { userId: user.id, sku: f.sku } },
      });

      let draft;
      if (!existing) {
        draft = await this.prisma.reorderDraft.create({
          data: { userId: user.id, sku: f.sku, status: 'pending', ...data },
        });
      } else if (
        existing.status === 'pending' ||
        (existing.decidedAt && Date.now() - existing.decidedAt.getTime() > RESURFACE_MS)
      ) {
        draft = await this.prisma.reorderDraft.update({
          where: { id: existing.id },
          data: { status: 'pending', decidedAt: null, ...data },
        });
      } else {
        draft = existing; // bugun allaqachon qaror qilingan — qayta ko'rsatilmaydi
      }
      drafts.push(draft);
    }

    await this.audit.record({
      actorId: user.id,
      action: 'retail.reorder_plan',
      resourceType: 'retail',
      metadata: { drafts: drafts.length, leadTimeDays: cfg.leadTimeDays },
    });

    return {
      generatedAt: new Date().toISOString(),
      leadTimeDays: cfg.leadTimeDays,
      coverDays: cfg.coverDays,
      drafts,
    };
  }

  /** Egasi qoralamani ko'rib tasdiqlaydi — shundagina ta'minotchi kanaliga yuboriladi. */
  async confirmReorderDraft(user: User, draftId: string) {
    const draft = await this.prisma.reorderDraft.findFirst({ where: { id: draftId, userId: user.id } });
    if (!draft) throw new NotFoundException('Buyurtma qoralamasi topilmadi');
    if (draft.status !== 'pending') return draft; // idempotent — ikkinchi marta yubormaydi

    const updated = await this.prisma.reorderDraft.update({
      where: { id: draft.id },
      data: { status: 'approved', decidedAt: new Date() },
    });

    const settings = await this.alertsSettings.getSettings(user);
    let delivery = 'in_app';
    if (settings.target) {
      const res = await this.connectors.sendViaChannel(user, settings.channel, settings.target, draft.message);
      delivery = res.ok ? 'sent' : 'failed';
    }

    await this.audit.record({
      actorId: user.id,
      action: 'retail.reorder_approved',
      resourceType: 'reorder_draft',
      resourceId: draft.id,
      metadata: { sku: draft.sku, orderQty: draft.orderQty, delivery },
    });
    return { ...updated, delivery };
  }

  /** Egasi qoralamani rad etadi — hech narsa yuborilmaydi. */
  async cancelReorderDraft(user: User, draftId: string) {
    const draft = await this.prisma.reorderDraft.findFirst({ where: { id: draftId, userId: user.id } });
    if (!draft) throw new NotFoundException('Buyurtma qoralamasi topilmadi');
    if (draft.status !== 'pending') return draft; // idempotent

    const updated = await this.prisma.reorderDraft.update({
      where: { id: draft.id },
      data: { status: 'rejected', decidedAt: new Date() },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'retail.reorder_rejected',
      resourceType: 'reorder_draft',
      resourceId: draft.id,
      metadata: { sku: draft.sku },
    });
    return updated;
  }
}
