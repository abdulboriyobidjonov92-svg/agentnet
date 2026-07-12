import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { POS_ADAPTER, type PosAdapter } from './pos-adapter';
import { RetailInventory } from './retail-inventory';
import { RetailAlertsSettings } from './retail-alerts-settings';
import { RetailVision } from './retail-vision';
import { RetailSales } from './retail-sales';
import type { User } from '@prisma/client';

/**
 * S4: Retail Intelligence — kamera + inventar FUZIYASI.
 *
 * Ushbu klass yupqa fasad: haqiqiy mantiq domen bo'yicha alohida
 * fayllarga bo'lingan — retail-inventory.ts, retail-vision.ts,
 * retail-sales.ts, retail-alerts-settings.ts. Kontroller va testlar
 * uchun ommaviy metod imzolari o'zgarmagan.
 */
@Injectable()
export class RetailService {
  private readonly logger = new Logger(RetailService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  private readonly inventory: RetailInventory;
  private readonly alertsSettings: RetailAlertsSettings;
  private readonly vision: RetailVision;
  private readonly sales: RetailSales;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
    @Inject(POS_ADAPTER) private readonly pos: PosAdapter,
  ) {
    this.inventory = new RetailInventory(this.prisma);
    this.alertsSettings = new RetailAlertsSettings(this.prisma);
    this.vision = new RetailVision(this.prisma, this.http, this.audit, this.connectors, this.engineUrl, this.logger);
    this.sales = new RetailSales(
      this.prisma, this.http, this.audit, this.connectors, this.pos,
      this.engineUrl, this.logger, this.vision, this.alertsSettings,
    );
  }

  // ---- Inventar ----

  listProducts(user: User) {
    return this.inventory.listProducts(user);
  }

  upsertProduct(user: User, dto: { sku: string; name: string; stock?: number; reorderLevel?: number; price?: number; shelfZone?: string }) {
    return this.inventory.upsertProduct(user, dto);
  }

  seedDemo(user: User) {
    return this.inventory.seedDemo(user);
  }

  // ---- POS savdo va bashorat ----

  recordSale(user: User, dto: { sku: string; qty?: number; total?: number }) {
    return this.sales.recordSale(user, dto);
  }

  listSales(user: User) {
    return this.sales.listSales(user);
  }

  forecast(user: User) {
    return this.sales.forecast(user);
  }

  reorderPlan(user: User) {
    return this.sales.reorderPlan(user);
  }

  confirmReorderDraft(user: User, draftId: string) {
    return this.sales.confirmReorderDraft(user, draftId);
  }

  cancelReorderDraft(user: User, draftId: string) {
    return this.sales.cancelReorderDraft(user, draftId);
  }

  // ---- Vision hodisalari va kamera ----

  ingestVisionEvent(
    user: User,
    dto: { camera?: string; type?: string; sku?: string; zone?: string; confidence?: number; raw?: any },
  ) {
    return this.vision.ingestVisionEvent(user, dto);
  }

  listEvents(user: User) {
    return this.vision.listEvents(user);
  }

  connectCamera(user: User, dto: { cameraId: string; rtspUrl: string; highValueZones?: any[] }) {
    return this.vision.connectCamera(user, dto);
  }

  disconnectCamera(user: User, cameraId: string) {
    return this.vision.disconnectCamera(user, cameraId);
  }

  cameraStatus(user: User, cameraId?: string) {
    return this.vision.cameraStatus(user, cameraId);
  }

  // ---- Alertlar va sozlamalar ----

  listAlerts(user: User) {
    return this.alertsSettings.listAlerts(user);
  }

  getSettings(user: User) {
    return this.alertsSettings.getSettings(user);
  }

  saveSettings(user: User, dto: { channel?: string; target?: string; autoNotify?: boolean }) {
    return this.alertsSettings.saveSettings(user, dto);
  }
}
