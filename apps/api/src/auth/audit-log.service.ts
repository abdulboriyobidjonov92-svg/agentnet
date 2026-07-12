/**
 * Audit Log — hash-chained, o'zgartirib bo'lmas jurnal.
 */
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Butun audit-zanjiri uchun yagona advisory-lock kaliti (ixtiyoriy bigint).
// Barcha audit yozuvlari shu kalit ustida seriyalashadi — zanjir chiziqli qoladi.
const AUDIT_CHAIN_LOCK = 4771n;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Audit-log hech qachon asosiy oqimni bloklamasligi kerak.
    try {
      // Hash-zanjir ketma-ket bo'lishi SHART: "oxirgi hash'ni o'qi → yangi yozuv"
      // atomik bo'lmasa, ikki parallel yozuv bir xil prevHash oladi va zanjir
      // ikkiga bo'linadi (buzilish-sezish kafolati yo'qoladi). Butun zanjir uchun
      // bitta transaksiya-doirasidagi advisory lock — audit yozuvlari o'zaro
      // seriyalashadi, boshqa jadvallarga esa ta'sir qilmaydi.
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK})`;

        const last = await tx.auditLog.findFirst({
          orderBy: { seq: 'desc' }, // monotonik — millisekund-teng holatida ham aniq
        });
        const prevHash = last?.entryHash ?? 'GENESIS';
        const entryHash = this.computeHash(prevHash, params);

        await tx.auditLog.create({
          data: {
            actorId: params.actorId,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId ?? null,
            metadata: (params.metadata ?? {}) as object,
            prevHash,
            entryHash,
          },
        });
      });
      this.logger.log(`AUDIT: ${params.actorId} -> ${params.action}`);
    } catch (e) {
      this.logger.warn(`Audit-log yozib bo'lmadi: ${(e as Error).message}`);
    }
  }

  private computeHash(prevHash: string, payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(prevHash + JSON.stringify(payload))
      .digest('hex');
  }
}
