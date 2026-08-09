import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImpersonationStatus, type ImpersonationSession, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorService } from '../../auth/auth.service';
import { ImpersonationService } from '../../auth/impersonation.service';
import { canImpersonateRole, IMPERSONATION_MAX_DURATION_MS } from '../../auth/impersonation.policy';
import { AdminAlertService } from '../dangerous/admin-alert.service';
import { ImpersonationNotifierService } from './impersonation-notifier.service';
import type { StartImpersonationDto } from './dto/impersonation.dto';

/**
 * SEC-12 §6.6 — impersonation OPERATOR YUZASI.
 *
 * Bu qatlam "kim, kimni, qanday shart bilan" ga javob beradi; sessiyaning
 * o'zi (token, holat, har-so'rov auditi) `auth/impersonation.service.ts` da.
 *
 * NEGA SEC-11 XAVFLI-AMAL OQIMI TO'LIQ QO'LLANMADI (ataylab):
 * Contract §6.5 xavfli amallar ro'yxatida "impersonation (write)" turadi —
 * ya'ni FAQAT yozish rejimi xavfli deb tasniflangan. O'qish rejimini
 * ikki bosqichli `pending -> execute` mashinasiga solish qo'llab-quvvatlash
 * chaqirig'ini ishlamaydigan qiladi (operator mijoz bilan gaplashib turib
 * ikkinchi tasdiqni kutolmaydi) va §6.5(5) "bekor qilish oynasi" bu yerda
 * ma'nosiz (sessiya 30 daqiqada o'zi o'ladi).
 *
 * SHUNGA QARAMAY, §6.5 ning HIMOYA QILADIGAN QISMLARI olindi:
 *   • sabab, min 20 belgi — AYNAN bir xil konvensiya (DTO),
 *   • TOTP qayta-autentifikatsiya — Contract §6.6 talab QILMAYDI, biz
 *     MAJBURIY qildik (kuchaytirish): SUPPORT roli 2FA majburiyati ostida
 *     emas (`RolesGuard.ELEVATED_ROLES`), ya'ni usiz o'g'irlangan SUPPORT
 *     sessiyasi istalgan mijoz hisobini o'qiy olardi. Bu — SEC-12 dagi eng
 *     katta qoldiq risk edi,
 *   • ikkita audit yozuvi — `impersonation.start` va `impersonation.end`,
 *   • OWNER kanaliga signal — mavjud `AdminAlertService` orqali,
 *   • 10/soat throttle — controller darajasida.
 * Yozib tasdiqlash (`ROLE user_x`) OLINMADI: u qaytarib bo'lmaydigan amal
 * uchun "tasodifan bosib qo'yish"ga qarshi; impersonation qaytariladigan va
 * to'liq auditlanadigan o'qish sessiyasi.
 */
@Injectable()
export class ImpersonationAdminService {
  private readonly logger = new Logger(ImpersonationAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly impersonation: ImpersonationService,
    private readonly twoFactor: TwoFactorService,
    private readonly notifier: ImpersonationNotifierService,
    private readonly alerts: AdminAlertService,
  ) {}

  // ----------------------------------------------------------------
  // Boshlash
  // ----------------------------------------------------------------

  async start(actor: User, dto: StartImpersonationDto) {
    // §15 — tekshiruvlar TARTIBI muhim: har rad etish auditlanadi, shuning
    // uchun avval "kim" (aktor huquqi), keyin "kimga" (nishon holati).
    this.impersonation.assertActorRoleAllowed(actor.role);
    await this.assertTotp(actor, dto);

    if (dto.targetUserId === actor.id) {
      await this.denied(actor, dto, 'self_impersonation_forbidden');
      throw new ForbiddenException({
        message: "O'zingizni impersonation qila olmaysiz",
        reason: 'self_impersonation_forbidden',
      });
    }

    const target = await this.impersonation.loadTarget(dto.targetUserId);
    if (!target) {
      await this.denied(actor, dto, 'target_not_found');
      throw new NotFoundException('Nishon foydalanuvchi topilmadi');
    }

    // §9 — IMTIYOZ OSHIRISH TO'SIG'I: nishon roli aktordan QAT'IY past
    // bo'lishi shart. OWNER hech kim tomonidan ko'rilmaydi (undan yuqori
    // rol yo'q), teng rollar bir-birini ko'rmaydi.
    if (!canImpersonateRole(actor.role, target.role)) {
      await this.denied(actor, dto, 'target_role_protected');
      throw new ForbiddenException({
        message: 'Bu foydalanuvchini impersonation qilib bo\'lmaydi (imtiyozli hisob)',
        reason: 'target_role_protected',
      });
    }

    // Bloklangan hisob: uning o'z sessiyalari o'lik, `AuthGuard` esa
    // bloklangan `dbUser` ni rad etadi — impersonation ochilsa, u har
    // so'rovda 403 beradigan "o'lik sessiya" bo'lardi. Fail-closed.
    if (target.blockedAt) {
      await this.denied(actor, dto, 'target_blocked');
      throw new BadRequestException({
        message: "Bloklangan hisobni impersonation qilib bo'lmaydi",
        reason: 'target_blocked',
      });
    }

    // Bir operatorda BIR VAQTDA bitta sessiya: aks holda audit jurnalida
    // parallel sessiyalar chalkashadi va "qaysi biri hali ochiq" savoli
    // noaniq bo'ladi (§13). Eskisi avval to'xtatiladi.
    const existing = await this.impersonation.findActiveByActor(actor.id);
    if (existing) {
      await this.stopSession(existing, 'manual');
    }

    const { session, token, expiresAt } = await this.impersonation.create({
      actor,
      target,
      reason: dto.reason,
    });

    // §12 — boshlanish auditi (sabab, muddat, rejim, sessiya id'si).
    await this.impersonation.recordStart({
      session,
      actorId: actor.id,
      targetUserId: target.id,
    });

    // §6.5(6) naqshi: nazorat kanaliga darhol signal. Mavjud servis.
    await this.alerts.impersonationStarted({
      actorEmail: actor.email,
      targetEmail: target.email,
      reason: dto.reason,
      sessionId: session.id,
      expiresAt,
    });

    return {
      impersonationId: session.id,
      token,
      mode: session.mode,
      expiresAt: expiresAt.toISOString(),
      maxDurationMs: IMPERSONATION_MAX_DURATION_MS,
      target: { id: target.id, email: target.email, name: target.name, role: target.role },
      actor: { id: actor.id, email: actor.email, role: actor.role },
    };
  }

  // ----------------------------------------------------------------
  // To'xtatish
  // ----------------------------------------------------------------

  /**
   * §17 — aniq to'xtatish.
   *
   * DIQQAT: bu endpoint HAQIQIY operator sessiyasi (oddiy admin tokeni)
   * bilan chaqiriladi, impersonation tokeni bilan EMAS — `@Roles(...)`
   * yo'llari impersonation uchun butunlay yopiq (`RolesGuard`). Shu tanlov
   * `ImpersonationGuard` da hech qanday "ruxsat etilgan yozish" istisnosi
   * qoldirmaydi: read-only qoidasi mutlaq bo'lib qoladi.
   */
  async stop(actor: User, sessionId: string) {
    const session = await this.impersonation.findById(sessionId);
    if (!session) throw new NotFoundException('Impersonation sessiyasi topilmadi');

    // Boshqa operatorning sessiyasini faqat undan YUQORI rol to'xtata
    // oladi... — ataylab SODDAROQ: faqat EGASI yoki OWNER. Nazorat
    // huquqi OWNER'da, kundalik ish esa egasida.
    if (session.actorId !== actor.id && actor.role !== 'OWNER') {
      throw new ForbiddenException({
        message: "Bu sessiyani to'xtatish huquqingiz yo'q",
        reason: 'impersonation_stop_forbidden',
      });
    }

    if (session.status !== ImpersonationStatus.active) {
      // Idempotent: allaqachon tugagan sessiyani "to'xtatish" xato emas —
      // frontend qayta yuborsa ham holat bir xil qoladi.
      return { id: session.id, status: session.status, alreadyEnded: true };
    }

    const ended = await this.stopSession(session, 'manual');
    return {
      id: session.id,
      status: ended?.status ?? ImpersonationStatus.ended,
      alreadyEnded: false,
    };
  }

  /** Tugatish + nishonga bildirishnoma (bitta yo'l — takrorlanmaydi). */
  private async stopSession(
    session: ImpersonationSession,
    reason: 'manual' | 'expired',
  ): Promise<ImpersonationSession | null> {
    const ended = await this.impersonation.end(session, reason);
    if (!ended) return null; // poygada boshqa chaqiruv yopgan

    await this.notifyTarget(ended);
    return ended;
  }

  private async notifyTarget(session: ImpersonationSession): Promise<void> {
    if (session.notifiedAt) return;
    const target = await this.impersonation.loadTarget(session.targetUserId);
    if (!target) return;

    const sent = await this.notifier.notifyEnded(target, session);
    if (sent) await this.impersonation.markNotified(session.id);
  }

  // ----------------------------------------------------------------
  // Muddati o'tganlarni tozalash (§13)
  // ----------------------------------------------------------------

  /**
   * Operator brauzerni yopib ketsa, qator muddatdan keyin ham `active`
   * bo'lib qolardi — §13 "noaniq faol sessiya qoldirilmaydi".
   *
   * Token BARIBIR o'lik (JWT `exp` + `resolve()` tekshiruvi), ya'ni bu
   * cron XAVFSIZLIK CHORASI EMAS — u JURNAL TOZALIGI uchun: tugash
   * yozuvi va foydalanuvchi bildirishnomasi so'rov kutmasdan chiqadi.
   *
   * Contract A24: cron leader-lock'i Phase 6 (Redis) ishi. Ko'p instansda
   * bu ish takrorlanishi mumkin — LEKIN `end()` shartli `updateMany`
   * bilan atomik, ya'ni ikkinchi instans `count: 0` oladi va na audit,
   * na bildirishnoma takrorlanadi.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireDueSessions(): Promise<void> {
    try {
      const expired = await this.impersonation.expireDue();
      for (const session of expired) {
        await this.notifyTarget(session);
      }
      if (expired.length) {
        this.logger.log(`Impersonation: ${expired.length} ta muddati o'tgan sessiya yopildi`);
      }
    } catch (e) {
      this.logger.error(`Impersonation muddat tozalashda xato: ${(e as Error).message}`);
    }
  }

  // ----------------------------------------------------------------
  // Yordamchi
  // ----------------------------------------------------------------

  /**
   * TOTP qayta-autentifikatsiya — SEC-11 dagi `assertTotp` bilan AYNAN bir
   * xil semantika: `verifyLogin()` 2FA o'chiq bo'lsa `true` qaytaradi
   * (login semantikasi), shuning uchun bayroq ALOHIDA tekshiriladi.
   */
  private async assertTotp(actor: User, dto: StartImpersonationDto): Promise<void> {
    if (!actor.twoFactorEnabled) {
      await this.denied(actor, dto, 'two_factor_required');
      throw new ForbiddenException({
        message: "Impersonation uchun 2FA yoqilgan bo'lishi SHART",
        reason: 'two_factor_required',
      });
    }
    const valid = await this.twoFactor.verifyLogin(actor.id, dto.totp);
    if (!valid) {
      await this.denied(actor, dto, 'invalid_totp');
      throw new UnauthorizedException({
        message: "TOTP kodi noto'g'ri",
        reason: 'invalid_totp',
      });
    }
  }

  /** Har rad etilgan urinish auditlanadi (§13). */
  private async denied(
    actor: User,
    dto: StartImpersonationDto,
    denyReason: string,
  ): Promise<void> {
    await this.impersonation.recordStartDenied({
      actorId: actor.id,
      targetUserId: dto.targetUserId,
      reason: dto.reason,
      denyReason,
    });
  }

  // ----------------------------------------------------------------
  // O'qish yuzasi (nazorat)
  // ----------------------------------------------------------------

  /** Operatorning HOZIR ochiq sessiyasi (banner/holat tiklash uchun). */
  async current(actor: User) {
    const session = await this.impersonation.findActiveByActor(actor.id);
    if (!session) return { active: null };

    const target = await this.impersonation.loadTarget(session.targetUserId);
    return {
      active: {
        impersonationId: session.id,
        mode: session.mode,
        expiresAt: session.expiresAt.toISOString(),
        startedAt: session.createdAt.toISOString(),
        requestCount: session.requestCount,
        target: target ? { id: target.id, email: target.email, name: target.name } : null,
      },
    };
  }

  /** §6.3 "Audit → impersonation tarixi" — kursorsiz oxirgi N ta yozuv. */
  async history(limit = 50) {
    // @admin-scope: nazorat ro'yxati — ataylab cross-tenant (`@Roles`
    // bilan himoyalangan yo'ldan chaqiriladi).
    const items = await this.prisma.impersonationSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        status: true,
        mode: true,
        reason: true,
        createdAt: true,
        expiresAt: true,
        endedAt: true,
        endedReason: true,
        requestCount: true,
        notifiedAt: true,
        actor: { select: { id: true, email: true, role: true } },
        targetUser: { select: { id: true, email: true, role: true } },
      },
    });
    return { items };
  }
}
