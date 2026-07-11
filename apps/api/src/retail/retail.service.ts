import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { POS_ADAPTER, type PosAdapter } from './pos-adapter';
import {
  forecastProduct,
  rankByUrgency,
  reorderMessage,
  defaultConfig,
  type ProductForecast,
  type SalePoint,
} from './retail-forecast';
import type { User } from '@prisma/client';

/**
 * S4: Retail Intelligence — kamera + inventar FUZIYASI.
 *
 * Naqsh (Lumana/ifactory/ECAM isbotlagan): vision-hodisa hech qachon o'zi
 * signal emas. Har hodisa POS savdolari va inventar yozuvlari bilan
 * SOLISHTIRILADI; faqat haqiqiy nomuvofiqlik alert bo'ladi va egaga
 * O'ZI XOHLAGAN KANALGA ("bu tovar tugadi") avtomatik boradi — dashboard
 * ochishni kutmaydi.
 */

const MATCH_WINDOW_MIN = 15;

@Injectable()
export class RetailService {
  private readonly logger = new Logger(RetailService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
    @Inject(POS_ADAPTER) private readonly pos: PosAdapter,
  ) {}

  // ---- Inventar ----

  async listProducts(user: User) {
    return this.prisma.retailProduct.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
  }

  async upsertProduct(user: User, dto: { sku: string; name: string; stock?: number; reorderLevel?: number; price?: number; shelfZone?: string }) {
    return this.prisma.retailProduct.upsert({
      where: { userId_sku: { userId: user.id, sku: dto.sku } },
      create: {
        userId: user.id, sku: dto.sku, name: dto.name,
        stock: dto.stock ?? 0, reorderLevel: dto.reorderLevel ?? 5,
        price: dto.price ?? 0, shelfZone: dto.shelfZone ?? null,
      },
      update: {
        name: dto.name,
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.shelfZone !== undefined && { shelfZone: dto.shelfZone }),
      },
    });
  }

  /** Demo do'kon — tez boshlash va sinov uchun. */
  async seedDemo(user: User) {
    const demo = [
      { sku: 'COLA-1L', name: 'Coca-Cola 1L', stock: 24, reorderLevel: 6, price: 1_500_000, shelfZone: 'A1' },
      { sku: 'NON-PATIR', name: 'Patir non', stock: 8, reorderLevel: 10, price: 500_000, shelfZone: 'B2' },
      { sku: 'SUT-1L', name: "Sut 1L (Nestle)", stock: 2, reorderLevel: 5, price: 1_400_000, shelfZone: 'C1' },
      { sku: 'YOG-5L', name: "O'simlik yog'i 5L", stock: 12, reorderLevel: 4, price: 9_500_000, shelfZone: 'C3' },
    ];
    for (const p of demo) await this.upsertProduct(user, p);
    return this.listProducts(user);
  }

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
      await this.reconcileAndAlert(user, { trigger: 'sale', product: updated, visionEvents: [] });
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

    const settings = await this.getSettings(user);
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

  // ---- Vision hodisalari (haqiqiy CV servis webhook'i shu yerga uradi) ----

  async ingestVisionEvent(
    user: User,
    dto: { camera?: string; type?: string; sku?: string; zone?: string; confidence?: number; raw?: any },
  ) {
    const knownTypes = ['shelf_empty', 'item_pickup', 'shelf_restocked', 'person_loitering'];
    const type = knownTypes.includes(dto.type ?? '') ? dto.type! : 'unknown';

    const event = await this.prisma.visionEvent.create({
      data: {
        userId: user.id,
        camera: dto.camera ?? 'cam-1',
        type,
        sku: dto.sku ?? null,
        zone: dto.zone ?? null,
        confidence: Math.min(1, Math.max(0, Number(dto.confidence ?? 0.8))),
        raw: dto.raw ?? undefined,
      },
    });

    // shelf_restocked — pozitiv signal, alert kerak emas
    if (type === 'shelf_restocked') {
      await this.prisma.visionEvent.update({ where: { id: event.id }, data: { status: 'reconciled' } });
      return { event, alert: null };
    }

    const product = await this.findProductForEvent(user.id, dto.sku, dto.zone);
    const alert = await this.reconcileAndAlert(user, { trigger: 'vision_event', product, visionEvents: [event] });
    return { event, alert };
  }

  async listEvents(user: User) {
    return this.prisma.visionEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  // ---- Haqiqiy IP-kamera (agent-engine camera_service.py'ni ishga tushiradi) ----

  async connectCamera(user: User, dto: { cameraId: string; rtspUrl: string; highValueZones?: any[] }) {
    if (!dto.cameraId || !dto.rtspUrl) {
      throw new BadRequestException('cameraId va rtspUrl majburiy');
    }
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.engineUrl}/camera/connect`,
        {
          camera_id: dto.cameraId,
          rtsp_url: dto.rtspUrl,
          user_id: user.id,
          high_value_zones: dto.highValueZones ?? [],
        },
        { timeout: 15_000 },
      ),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'retail.camera_connect',
      resourceType: 'camera',
      resourceId: dto.cameraId,
      metadata: { rtspUrl: dto.rtspUrl },
    });
    return data;
  }

  async disconnectCamera(user: User, cameraId: string) {
    if (!cameraId) throw new BadRequestException('cameraId majburiy');
    const { data } = await firstValueFrom(
      this.http.post(`${this.engineUrl}/camera/disconnect`, null, {
        params: { camera_id: cameraId },
        timeout: 10_000,
      }),
    );
    return data;
  }

  async cameraStatus(user: User, cameraId?: string) {
    const { data } = await firstValueFrom(
      this.http.get(`${this.engineUrl}/camera/status`, {
        params: cameraId ? { camera_id: cameraId } : {},
        timeout: 10_000,
      }),
    );
    return data;
  }

  // ---- Solishtirish (fuziya yadrosi) ----

  private async findProductForEvent(userId: string, sku?: string, zone?: string) {
    if (sku) {
      const bySku = await this.prisma.retailProduct.findUnique({ where: { userId_sku: { userId, sku } } });
      if (bySku) return bySku;
    }
    if (zone) {
      return this.prisma.retailProduct.findFirst({ where: { userId, shelfZone: zone } });
    }
    return null;
  }

  /**
   * Dalillarni yig'adi (kamera ⟷ POS ⟷ inventar), engine'dan kontekstli baho
   * oladi, faqat amalga undaydigan natijada alert yaratadi va YUBORADI.
   */
  private async reconcileAndAlert(
    user: User,
    input: { trigger: string; product: any; visionEvents: any[] },
  ) {
    const { product, visionEvents } = input;
    const since = new Date(Date.now() - MATCH_WINDOW_MIN * 60_000);

    const recentSales = await this.prisma.retailSale.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
        ...(product ? { sku: product.sku } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // item_pickup hodisalari POS cheklari bilan solishtiriladi
    let unmatchedPickups = 0;
    const pickups = visionEvents.filter((e) => e.type === 'item_pickup');
    if (pickups.length) {
      const soldQty = recentSales.reduce((s, x) => s + x.qty, 0);
      unmatchedPickups = Math.max(0, pickups.length - soldQty);
      // Oldingi solishtirilmagan pickup'lar ham hisobga olinadi (seriya bo'lsa jiddiyroq)
      const priorUnmatched = await this.prisma.visionEvent.count({
        where: {
          userId: user.id, type: 'item_pickup', status: 'alerted',
          createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
          ...(product ? { sku: product.sku } : {}),
        },
      });
      unmatchedPickups += priorUnmatched > 0 ? 1 : 0;
    }

    const evidence = {
      trigger: input.trigger,
      vision_events: visionEvents.map((e) => ({
        type: e.type, zone: e.zone, sku: e.sku, confidence: e.confidence, createdAt: e.createdAt,
      })),
      product: product
        ? { sku: product.sku, name: product.name, stock: product.stock, reorderLevel: product.reorderLevel, shelfZone: product.shelfZone }
        : null,
      recent_sales: recentSales.map((s) => ({ sku: s.sku, qty: s.qty, at: s.createdAt })),
      unmatched_pickups: unmatchedPickups,
      match_window_min: MATCH_WINDOW_MIN,
    };

    // Kontekstli baho — engine (LLM-first, heuristik fallback)
    let assessment: any;
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/retail/assess`, {
          evidence, language: user.preferredLanguage ?? 'uz',
        }, { timeout: 45_000 }),
      );
      assessment = data;
    } catch (e: any) {
      this.logger.warn(`Retail assess engine xatosi: ${e.message}`);
      return null;
    }

    for (const ev of visionEvents) {
      await this.prisma.visionEvent.update({
        where: { id: ev.id },
        data: { status: assessment.is_actionable ? 'alerted' : 'reconciled' },
      });
    }

    if (!assessment.is_actionable) return null;

    // Alert + avtonom yuborish
    const settings = await this.prisma.retailSettings.findUnique({ where: { userId: user.id } });
    const channel = settings?.channel ?? 'telegram';
    const target = settings?.target ?? null;
    const autoNotify = settings?.autoNotify ?? true;

    let delivery = 'in_app';
    if (autoNotify && target) {
      const res = await this.connectors.sendViaChannel(user, channel, target, `🏪 ${assessment.title}\n\n${assessment.message}`);
      delivery = res.ok ? 'sent' : 'failed';
      if (!res.ok) this.logger.warn(`Alert delivery failed (${channel}): ${res.error}`);
    } else if (autoNotify) {
      delivery = 'pending'; // kanal sozlanmagan — sozlansa yuboriladi
    }

    const alert = await this.prisma.retailAlert.create({
      data: {
        userId: user.id,
        kind: assessment.kind,
        severity: assessment.severity ?? 'info',
        title: assessment.title,
        body: assessment.message,
        evidence: { ...evidence, assessment: { reasoning: assessment.reasoning, method: assessment.method } },
        channel,
        delivery,
        method: assessment.method,
      },
    });

    await this.audit.record({
      actorId: user.id, action: 'retail.alert', resourceType: 'retail_alert', resourceId: alert.id,
      metadata: { kind: alert.kind, severity: alert.severity, delivery, method: assessment.method },
    });
    return alert;
  }

  // ---- Alertlar va sozlamalar ----

  async listAlerts(user: User) {
    return this.prisma.retailAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async getSettings(user: User) {
    return (
      (await this.prisma.retailSettings.findUnique({ where: { userId: user.id } })) ?? {
        channel: 'telegram', target: null, autoNotify: true,
      }
    );
  }

  async saveSettings(user: User, dto: { channel?: string; target?: string; autoNotify?: boolean }) {
    return this.prisma.retailSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        channel: dto.channel ?? 'telegram',
        target: dto.target ?? null,
        autoNotify: dto.autoNotify ?? true,
      },
      update: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.target !== undefined && { target: dto.target }),
        ...(dto.autoNotify !== undefined && { autoNotify: dto.autoNotify }),
      },
    });
  }
}
